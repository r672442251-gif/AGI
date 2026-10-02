// @api report and create the GitHub repositories of every element
import { readFileSync } from "node:fs"
import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { tokenState } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/token.cjs"
import paths from "@/lib/agi-items/paths.cjs"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { elementDir, elementGithubState } from "@/lib/agi-items/element-github"
import { readReposJob, startReposJob } from "@/lib/agi-items/element-repos-job"
import { updateState } from "@/lib/agi-items/element-update"

// СОХРАНЯЕТСЯ ЛИ РАБОТА В GITHUB (шаг 374-9, 374-2, 374-3). Слово владельца 2026-10-02: «до тех пор пока пользователь не подключил
// Токен нужно показывать тревожный баннер»; «как только вёл сразу же в его репозитории создаются классические репозитории под
// каждой AGI ITEMS». GET — есть ли общий ключ (сам ключ не отдаётся), каждый элемент: репозиторий, каким ключом идёт выгрузка,
// незакоммиченные правки, последняя выгрузка; ход создания. POST `{ action: "create" }` — создать недостающие (кнопка человека).
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }

function elements() {
  let services: Array<{ id: string; kind?: string }> = []
  try { services = (JSON.parse(readFileSync(paths.REGISTRY_FILE, "utf8")) as { services?: typeof services }).services ?? [] } catch { /* пусто */ }
  return services.map((e) => ({ id: e.id, kind: e.kind ?? "user", address: addressOf(e.id), present: elementDir(e.id) !== null, ...elementGithubState(e.id), update: updateState(e.id) }))
}

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const full = req.nextUrl.searchParams.get("full") === "1"
  const token = tokenState().configured
  if (full) return NextResponse.json({ ok: true, token, elements: elements(), job: readReposJob() }, noStore)
  // 382 (владелец 2026-10-02: «пока есть хотя бы одна не завершенные репозиторий нам нужно показывать эту карточку»): полоса горит,
  // пока у элемента на диске нет своего репозитория; ответ — адреса таких элементов.
  const missing = elements().filter((e) => e.present && !e.repo).map((e) => e.address)
  return NextResponse.json({ ok: true, token, missing }, noStore)
}

export async function POST(req: NextRequest) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403 })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { action?: string; id?: string } | null
  if (body?.action !== "create") return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 })
  if (!tokenState().configured) return NextResponse.json({ ok: false, error: "no-token" }, { status: 409, ...noStore })
  // 381: `id` — только этот элемент (кнопка в его строке); без `id` — все недостающие (сохранение ключа, рождение элемента).
  const only = typeof body.id === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(body.id) ? body.id : undefined
  return NextResponse.json({ ok: true, job: startReposJob(only) }, noStore)
}
