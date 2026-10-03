// @api replace an element's code from another GitHub repository
import { spawnSync } from "node:child_process"
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { elementDir, parseRepo, tokenFor } from "@/lib/agi-items/element-github"
import { checkAccess } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/github.cjs"
import { SHAPE } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/token.cjs"

// ИМПОРТ НА МЕСТО ЭЛЕМЕНТА (шаг 374-6). Слово владельца 2026-10-02: «Приехал новый встал на место старого»; свой ключ элемента —
// «возможность подключить сюда другой источник и его ключ и начать работать с ним»; старая история — архив в прежнем репозитории.
// POST `{ repo, token }`: ключ проверяется у GitHub (виден ли репозиторий), прежний ключ элемента сохраняется как `.env.previous`
// (им выгружается архив), новый становится ключом элемента; работа — `scripts/element-import.mjs` вне дерева ядра. GET — ход.
// 🔒 Без прежнего репозитория — отказ ДО любых изменений: прежняя история пропала бы.

export const dynamic = "force-dynamic"

const ROOT = process.cwd()
const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }
const ghDir = (id: string) => join(ROOT, "data", "services", id, "github")

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const { id } = await params
  try { return NextResponse.json({ ok: true, ...JSON.parse(readFileSync(join(ROOT, "data", "services", id, "import.json"), "utf8")) }, noStore) }
  catch { return NextResponse.json({ ok: true, state: "none" }, noStore) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403 })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const { id } = await params
  if (!elementDir(id)) return NextResponse.json({ ok: false, error: "no-folder" }, { status: 404, ...noStore })
  const body = (await req.json().catch(() => null)) as { repo?: unknown; token?: unknown } | null
  const where = parseRepo(String(body?.repo ?? ""))
  // 384-5 (владелец 2026-10-03: «Для публичного репозитории ключ не потребуется»; план «отвязать» подтверждён): поле токена
  // необязательно — пусто: токен элемента по порядку `tokenFor` (свой → общий), а публичный репозиторий виден и без него.
  const typed = String(body?.token ?? "").trim()
  if (!where) return NextResponse.json({ ok: false, error: "bad-repo" }, { status: 400, ...noStore })
  if (typed && !SHAPE.test(typed)) return NextResponse.json({ ok: false, error: "bad-token-shape" }, { status: 400, ...noStore })
  let previous: string | null = null
  try { previous = (JSON.parse(readFileSync(join(ghDir(id), "state.json"), "utf8")) as { repo?: string }).repo ?? null } catch { /* нет */ }
  if (!previous) return NextResponse.json({ ok: false, error: "archive-first" }, { status: 409, ...noStore })
  const target = `${where.owner}/${where.repo}`
  if (previous === target) return NextResponse.json({ ok: false, error: "same-repo" }, { status: 409, ...noStore })
  const token = typed || tokenFor(id).token
  let visible = false
  if (token) {
    const access = await checkAccess(token, where.owner, where.repo)
    if (!access.ok) return NextResponse.json({ ok: false, error: access.error ?? "github-refused" }, { status: 409, ...noStore })
    visible = access.canRead === true
  }
  if (!visible) visible = await publicRepo(where.owner, where.repo)
  if (!visible) return NextResponse.json({ ok: false, error: "repo-not-visible" }, { status: 409, ...noStore })
  // 🔒 СОХРАНЯТЬ МОЖНО ТОЛЬКО ТУДА, КУДА ТОКЕН ПИШЕТ: право — настоящей пробной отправкой (`permissions.push` — права аккаунта, 319-5).
  // Нет права — после замены элемент отвязывается от источника, свой репозиторий — «Создать и выгрузить».
  const writable = token ? canPush(elementDir(id)!, token, target) : false
  mkdirSync(ghDir(id), { recursive: true })
  if (typed) {
    const own = join(ghDir(id), ".env")
    if (existsSync(own)) copyFileSync(own, join(ghDir(id), ".env.previous"))
    writeFileSync(own, `GITHUB_TOKEN=${typed}\n`, { mode: 0o600 })
    try { chmodSync(own, 0o600) } catch { /* Windows: права даёт профиль пользователя */ }
  }
  writeFileSync(join(ROOT, "data", "services", id, "import.json"), JSON.stringify({ state: "starting", target, at: new Date().toISOString() }, null, 2) + "\n", "utf8")
  const flags = [...(typed ? ["--typed"] : []), ...(writable ? [] : ["--detach"])]
  spawnSync(process.execPath, [join(ROOT, "scripts", "spawn-free.mjs"), join(ROOT, "scripts", "element-import.mjs"), id, target, ...flags], {
    cwd: ROOT, windowsHide: true, stdio: "ignore", timeout: 10_000,
  })
  return NextResponse.json({ ok: true, state: "starting", previous, writable }, noStore)
}

/** Публичный репозиторий виден без токена: GitHub отвечает 200 и `private: false` (для закрытого — 404). */
async function publicRepo(owner: string, repo: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "fractera-agi-node", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return false
    const d = (await r.json().catch(() => null)) as { private?: boolean } | null
    return d?.private === false
  } catch { return false }
}

/** Пробная отправка `git push --dry-run` — проходит проверку прав GitHub и ничего не пишет. */
function canPush(dir: string, token: string, target: string): boolean {
  const r = spawnSync("git", ["-C", dir, "-c", "credential.helper=", "push", "--dry-run", `https://x-access-token:${token}@github.com/${target}.git`, "HEAD:refs/heads/fractera-import-probe"], {
    encoding: "utf8", windowsHide: true, timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })
  return r.status === 0
}
