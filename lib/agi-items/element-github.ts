import "server-only"
import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import paths from "@/lib/agi-items/paths.cjs"
import { NODE_WRITES } from "@/lib/agi-items/element-code-state"
import { checkAccess } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/github.cjs"
import { SHAPE, storedToken } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/token.cjs"

// GITHUB РОЖДЁННОГО ЭЛЕМЕНТА (узел, шаг 319-5). Слово владельца 2026-09-27: «пользователь … сохранить его обновлённую версию
// на своем гит хаб … вводить название репозитории и токен … экспортом этого репозитория в свой GitHub» — выгрузка КНОПКОЙ.
//
// 🔒 КИРПИЧИ ЯДРА, А НЕ КОПИЯ: проверка ключа — `checkAccess` (кто вы, виден ли репозиторий, `permissions.push`, срок), форма
// ключа — `SHAPE` из пути GitHub ядра (273). Здесь только то, что у элемента своё: где лежит его ключ и какую папку слать.
// 🔒 КЛЮЧ — В ДАННЫХ УЗЛА (`data/services/<id>/github/.env`, права 0600, вне git), наружу — 4 последних знака. Сохраняется
// ТОЛЬКО при праве записи: ключ, которым нельзя писать, выглядел бы рабочим до первой выгрузки.
// 🔒 ТОКЕН В GIT — ТОЛЬКО РАЗОВЫМ АРГУМЕНТОМ `push <url>`, НИКОГДА В `git remote`: иначе он лёг бы в `.git/config` элемента в
// открытом виде. Вывод git наружу не отдаётся — в нём бывает адрес с ключом; наружу — машинное слово причины.
// 🔒 НЕЗАКОММИЧЕННЫЕ ПРАВКИ (слово владельца: «а and b need both with description in (?)»): по умолчанию выгрузка отказывает
// и называет число правок; коммит «export <дата>» узел делает только по отдельной кнопке человека.

const ROOT = process.cwd()
const dataDir = (id: string) => join(ROOT, "data", "services", id, "github")
const tokenFile = (id: string) => join(dataDir(id), ".env")
const stateFile = (id: string) => join(dataDir(id), "state.json")
const KEY = "GITHUB_TOKEN="

export type ElementGithubState = {
  repo: string | null
  login: string | null
  expires: string | null
  tokenTail: string | null
  lastPushedAt: string | null
  lastCommit: string | null
  dirty: number
  commit: string | null
  /** 374-3: каким ключом пойдёт выгрузка — своим элемента, общим узла или никаким. */
  tokenSource: TokenSource
  /** 384-2: 4 последних знака токена, которым пойдёт выгрузка (своего или общего) — для зелёной плашки. */
  activeTail: string | null
}

type Stored = { repo?: string; login?: string | null; expires?: string | null; lastPushedAt?: string; lastCommit?: string }

function readStored(id: string): Stored {
  try { return JSON.parse(readFileSync(stateFile(id), "utf8")) as Stored } catch { return {} }
}

function writeStored(id: string, next: Stored) {
  mkdirSync(dataDir(id), { recursive: true })
  writeFileSync(stateFile(id), JSON.stringify(next, null, 2) + "\n", "utf8")
}

function readToken(id: string): string | null {
  try {
    const line = readFileSync(tokenFile(id), "utf8").split(/\r?\n/).find((l) => l.startsWith(KEY))
    return line ? line.slice(KEY.length).trim() || null : null
  } catch { return null }
}

// 🛑 СЛЕД СБОРКИ — НЕ ПРАВКА АГЕНТА (закон 295-1, замерено 319-5): Next при каждой сборке переписывает `tsconfig.json`
// (дописывает .next-a/.next-b) и `next-env.d.ts`. Без этого исключения у каждого рождённого элемента всегда была бы
// «1 незакоммиченная правка», и выгрузка требовала бы автокоммита шума сборки.
const BUILD_OWNED = /(^|\/)(tsconfig\.json|next-env\.d\.ts)$/

/** Незакоммиченные правки, кроме следа сборки и файлов, которые пишет сам узел (377: тот же список, что у «Развёртываний»:
 *  `DESIGN-CONFIG/`, `.install-stamp.json` … — ✗ на Mac у auth, data, root стояла «1 правка», которой не было, и «Закоммитить и
 *  отправить» унесла бы машинные файлы узла в репозиторий элемента). */
function changes(dir: string): string[] {
  return git(dir, ["status", "--porcelain", "--untracked-files=all"]).out.split(/\r?\n/).filter(Boolean)
    .map((l) => l.slice(3).trim().replace(/^"|"$/g, ""))
    .filter((f) => !BUILD_OWNED.test(f) && !NODE_WRITES.some((re) => re.test(f)))
}

function git(dir: string, args: string[]) {
  // `credential.helper=` и без запроса в терминал: ключ приходит только адресом, а менеджер учётных данных Windows не должен
  // ни подставлять свой, ни открывать окно входа поверх экрана человека.
  const r = spawnSync("git", ["-C", dir, "-c", "credential.helper=", ...args], {
    encoding: "utf8", windowsHide: true, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })
  return { rc: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

type RegistryEntry = { id: string; kind?: string }

/** Род элемента по реестру (374: обязательные элементы сохраняются так же, как рождённые); нет записи — `user`. */
function kindOf(id: string): string {
  try {
    const reg = JSON.parse(readFileSync(paths.REGISTRY_FILE, "utf8")) as { services?: RegistryEntry[] }
    return reg.services?.find((e) => e.id === id)?.kind ?? "user"
  } catch { return "user" }
}

/** Папка элемента с git или null — у черновика и чужого имени её нет. 374: любой род, не только рождённые. */
export function elementDir(id: string): string | null {
  const dir = paths.itemDir(id, kindOf(id))
  return existsSync(join(dir, ".git")) ? dir : null
}

// 🔒 СВОЙ КЛЮЧ ЭЛЕМЕНТА СИЛЬНЕЕ ОБЩЕГО (374-3). Слово владельца 2026-10-02: собственное поле токена — «способ занести сюда любой
// другой Токен если вдруг пользователь отзовёт основной например для того, чтобы ограничить доступ ко всему проекту кроме одного
// AGI ITEM … возможность подключить сюда другой источник и его ключ». Порядок: ключ элемента → общий ключ узла (273) → нет.
export type TokenSource = "element" | "node" | null
export function tokenFor(id: string): { token: string | null; source: TokenSource } {
  const own = readToken(id)
  if (own) return { token: own, source: "element" }
  const node = storedToken() || null
  return node ? { token: node, source: "node" } : { token: null, source: null }
}

/** `owner/name` из `owner/name`, `https://github.com/owner/name` или `…/name.git`; иначе null. */
export function parseRepo(raw: string): { owner: string; repo: string } | null {
  const s = raw.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "")
  const m = s.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

export function elementGithubState(id: string): ElementGithubState {
  const st = readStored(id)
  const token = readToken(id)
  const dir = elementDir(id)
  const dirty = dir ? changes(dir).length : 0
  const commit = dir ? git(dir, ["rev-parse", "--short", "HEAD"]).out.trim() || null : null
  const active = tokenFor(id)
  return {
    repo: st.repo ?? null,
    login: st.login ?? null,
    expires: st.expires ?? null,
    tokenTail: token ? token.slice(-4) : null,
    lastPushedAt: st.lastPushedAt ?? null,
    lastCommit: st.lastCommit ?? null,
    dirty,
    commit,
    tokenSource: active.source,
    activeTail: active.token ? active.token.slice(-4) : null,
  }
}

/** Проверить ключ у GitHub и сохранить связь — только при праве записи. */
export async function connectElementGithub(id: string, rawRepo: string, rawToken: string) {
  const where = parseRepo(rawRepo)
  if (!where) return { ok: false as const, error: "bad-repo" }
  // 384-2 (владелец 2026-10-03: «можно использовать другой репозиторий в рамках этого же аккаунта и тогда ключ будет подставлена
  // автоматически»): пустое поле — токен по порядку `tokenFor` (свой элемента → общий узла); сохраняется только введённый.
  const typed = rawToken.trim()
  if (typed && !SHAPE.test(typed)) return { ok: false as const, error: "bad-token-shape" }
  const token = typed || tokenFor(id).token
  if (!token) return { ok: false as const, error: "no-token" }
  const access = await checkAccess(token, where.owner, where.repo)
  if (!access.ok) return { ok: false as const, error: access.error ?? "github-refused" }
  if (!access.canRead) return { ok: false as const, error: "repo-not-visible", login: access.login ?? null }
  // 🛑 `permissions.push` ИЗ ОТВЕТА О РЕПОЗИТОРИИ — ПРАВА АККАУНТА, А НЕ КЛЮЧА (замерено 319-5 на ключе владельца: GitHub
  // ответил push: true, а `git push` того же ключа — «Permission … denied, 403»: у тонкого ключа не было Contents: write).
  // Поэтому право записи проверяется НАСТОЯЩЕЙ пробной отправкой `git push --dry-run` — она проходит проверку прав GitHub и
  // ничего не пишет.
  const dir = elementDir(id)
  if (dir) {
    const probe = spawnSync("git", ["-C", dir, "-c", "credential.helper=", "push", "--dry-run", `https://x-access-token:${token}@github.com/${where.owner}/${where.repo}.git`, "HEAD:refs/heads/main"], {
      encoding: "utf8", windowsHide: true, timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    })
    if (probe.status !== 0) {
      const out = `${probe.stdout ?? ""}${probe.stderr ?? ""}`
      return { ok: false as const, error: /403|denied/i.test(out) ? "no-write" : /without `?workflow`? scope/i.test(out) ? "needs-workflow" : /non-fast-forward|fetch first/i.test(out) ? "rejected" : "push-failed", login: access.login ?? null }
    }
  }
  mkdirSync(dataDir(id), { recursive: true })
  if (typed) {
    writeFileSync(tokenFile(id), `${KEY}${token}\n`, { mode: 0o600 })
    try { chmodSync(tokenFile(id), 0o600) } catch { /* Windows: права файла задаёт профиль пользователя */ }
  }
  writeStored(id, { ...readStored(id), repo: `${where.owner}/${where.repo}`, login: access.login ?? null, expires: access.expires ?? null })
  return { ok: true as const }
}

export function forgetElementToken(id: string) {
  rmSync(tokenFile(id), { force: true })
}

// 401 (владелец 2026-10-05: «пытаюсь добавить собственный ключ тогда, когда основной ключ уже добавлен, но кнопка сохранить
// новый ключ не появляется … скопируй один-к-одному»): свой токен элемента живёт отдельно от репозитория — те же три действия,
// что у токена узла (`build/github/api/key`): сохранить и проверить, проверить доступ, забыть. ✗ До 401 свой токен вводился
// только вместе с репозиторием, и без репозитория кнопка была неактивна.
export type ElementTokenAccess = { login: string | null; expires: string | null; repo: string | null; canRead: boolean | null; canWrite: boolean | null }
type AccessAnswer = { ok: boolean; error?: string; login?: string | null; expires?: string | null; repo?: string | null; canRead?: boolean | null; canWrite?: boolean | null }
const accessOf = (a: AccessAnswer): ElementTokenAccess => ({ login: a.login ?? null, expires: a.expires ?? null, repo: a.repo ?? null, canRead: a.canRead ?? null, canWrite: a.canWrite ?? null })

/** Проверить у GitHub и сохранить свой токен элемента. Токен, которого GitHub не узнаёт, не хранится (как у узла). */
export async function saveElementToken(id: string, raw: string) {
  const token = raw.trim()
  if (!token) return { ok: false as const, error: "no-token" }
  if (!SHAPE.test(token)) return { ok: false as const, error: "bad-token-shape" }
  const where = parseRepo(readStored(id).repo ?? "")
  const a = (await checkAccess(token, where?.owner, where?.repo)) as AccessAnswer
  if (!a.ok) return { ok: false as const, error: a.error ?? "github-refused" }
  mkdirSync(dataDir(id), { recursive: true })
  writeFileSync(tokenFile(id), `${KEY}${token}\n`, { mode: 0o600 })
  try { chmodSync(tokenFile(id), 0o600) } catch { /* Windows: права файла задаёт профиль пользователя */ }
  return { ok: true as const, access: accessOf(a) }
}

/** Спросить GitHub о сохранённом своём токене элемента (кнопка «Проверить доступ»). */
export async function checkElementToken(id: string) {
  const token = readToken(id)
  if (!token) return { ok: false as const, error: "no-own-token" }
  const where = parseRepo(readStored(id).repo ?? "")
  const a = (await checkAccess(token, where?.owner, where?.repo)) as AccessAnswer
  return a.ok ? { ok: true as const, access: accessOf(a) } : { ok: false as const, error: a.error ?? "github-refused" }
}

/** Выгрузить папку элемента в его репозиторий. `commit` — сначала закоммитить правки (кнопка человека). */
export function pushElement(id: string, commit: boolean) {
  const dir = elementDir(id)
  if (!dir) return { ok: false as const, error: "not-born" }
  const { token } = tokenFor(id)
  const repo = readStored(id).repo
  if (!token || !repo) return { ok: false as const, error: "not-connected" }
  const pending = changes(dir)
  const dirty = pending.length
  if (dirty > 0 && !commit) return { ok: false as const, error: "dirty", dirty }
  if (dirty > 0) {
    const ident = ["-c", "user.name=Fractera node", "-c", "user.email=node@fractera.local"]
    // Коммитятся правки, но не след сборки (он остаётся незакоммиченным, как и был). 🛑 `next-env.d.ts` в пути НЕ
    // называть: он в `.gitignore` элемента, и одно его упоминание делает `git add` кодом 1 (замерено 319-5).
    if (git(dir, ["add", "-A", "--", ...pending]).rc !== 0) {
      return { ok: false as const, error: "commit-failed" }
    }
    if (git(dir, [...ident, "commit", "--quiet", "-m", `export ${new Date().toISOString()}`]).rc !== 0) {
      return { ok: false as const, error: "commit-failed" }
    }
  }
  const url = `https://x-access-token:${token}@github.com/${repo}.git`
  const r = git(dir, ["push", url, "HEAD:refs/heads/main"])
  if (r.rc !== 0) {
    // Причина — машинным словом; сам вывод остаётся здесь, в нём адрес с ключом.
    // 🛑 `[remote rejected]` — общее слово GitHub для ЛЮБОГО отказа; «другая история» — только non-fast-forward / fetch first
    // (замерено 319-5: пустой репозиторий, отказ из-за файла .github/workflows был ошибочно назван «другой историей»).
    const error = /without `?workflow`? scope/i.test(r.out) ? "needs-workflow"
      : /non-fast-forward|fetch first/i.test(r.out) ? "rejected"
      : /Authentication failed|403|could not read Username/i.test(r.out) ? "auth-failed"
      : /not found/i.test(r.out) ? "repo-not-found" : "push-failed"
    return { ok: false as const, error }
  }
  const head = git(dir, ["rev-parse", "--short", "HEAD"]).out.trim()
  writeStored(id, { ...readStored(id), lastPushedAt: new Date().toISOString(), lastCommit: head })
  return { ok: true as const, commit: head }
}

// ── РЕПОЗИТОРИЙ НА КАЖДЫЙ ЭЛЕМЕНТ (374-2) ───────────────────────────────────────────────────────────────────────────────────
// Слово владельца 2026-10-02: «как только произойдёт добавление общего токен … в его репозитории создаются классические
// репозитории под каждой AGI ITEMS» — «y, but privat as default». Путь человека — один форк, работа, токен потом: вся история,
// накопленная до ключа, выгружается задним числом. Права ключа (первоисточник docs.github.com): создание приватного — `repo` у
// классического, Administration: write у тонкого; запись — Contents: write; шаблон несёт `.github/workflows` — Workflows.

const API = "https://api.github.com"
async function gh(token: string, method: string, url: string, body?: unknown) {
  try {
    const res = await fetch(`${API}${url}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "fractera-agi-node",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
    const retry = Number(res.headers.get("retry-after"))
    const reset = Number(res.headers.get("x-ratelimit-reset"))
    const left = res.headers.get("x-ratelimit-remaining")
    // 379: когда можно повторять — по заголовкам GitHub; без них — минута (первоисточник: docs.github.com, «Best practices»).
    const retryAt = Number.isFinite(retry) && retry > 0 ? Date.now() + retry * 1000
      : left === "0" && Number.isFinite(reset) && reset > 0 ? reset * 1000
      : Date.now() + 60_000
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null, retryAt }
  } catch { return { status: 0, body: null, retryAt: Date.now() + 60_000 } }
}

/** Имя репозитория для адреса: `<имя форка узла>-<адрес>` (решение плана 374, названо владельцу). */
function repoNameFor(address: string): string {
  let project = "agi"
  try {
    const o = JSON.parse(readFileSync(join(ROOT, "logs", "origin.json"), "utf8")) as { slug?: string }
    const name = o.slug?.split("/")[1]
    if (name) project = name.toLowerCase()
  } catch { /* узел без отметки форка — «agi» */ }
  return `${project}-${address}`.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100)
}

/** Имя репозитория элемента по его нынешнему адресу. */
function repoName(id: string): string {
  let address = id
  try { address = (JSON.parse(readFileSync(join(ROOT, "data", "services", id, "address.json"), "utf8")) as { address?: string }).address || id } catch { /* адрес = id */ }
  return repoNameFor(address)
}

// ── ПЕРЕИМЕНОВАНИЕ РЕПОЗИТОРИЯ ВМЕСТЕ С ЭЛЕМЕНТОМ (384-4) ─────────────────────────────────────────────────────────────────────
// Слово владельца 2026-10-03: «если я меняю названия при существующем ключе я должен сохранить репозиторий с новым названием».
// 🔒 ТОЛЬКО ИМЯ, ДАННОЕ УЗЛОМ: репозиторий `<форк>-<прежний адрес>` переименовывается; подключённый человеком под своим именем
// (купленный сайт, «Другой репозиторий») — остаётся как есть (план 384, подтверждён).
// 🔒 ПЕРВОИСТОЧНИК (docs.github.com, «Renaming a repository»): «all git clone, git fetch, or git push operations targeting the previous
// location will continue to function as if made on the new location»; «do not reuse the original name of the renamed repository. If you
// do, redirects to the renamed repository will no longer work». Запрос — `PATCH /repos/{owner}/{repo}` с `name`, классическому
// токену нужна галочка `repo`.
// Переименование элемента от отказа GitHub НЕ откатывается: элемент уже переименован, репозиторий остаётся прежним, причина — в ответе.
export type RepoRename = { state: "none" | "kept" | "renamed" | "failed"; from?: string; to?: string; reason?: string }
export async function renameElementRepo(id: string, previousAddress: string, address: string): Promise<RepoRename> {
  const st = readStored(id)
  if (!st.repo) return { state: "none" }
  const [owner, name] = st.repo.split("/")
  const target = repoNameFor(address)
  if (!owner || !name || name.toLowerCase() !== repoNameFor(previousAddress).toLowerCase()) return { state: "kept", from: st.repo, reason: "custom-name" }
  if (name.toLowerCase() === target.toLowerCase()) return { state: "kept", from: st.repo, reason: "same-name" }
  const r = await renameRepoTo(id, target)
  return r.state === "failed" && r.reason ? { ...r, reason: `${r.reason}${r.detail ? `: ${r.detail}` : ""}` } : r
}

/** Новое имя репозитория: буквы, цифры, «.», «_», «-», до 100 знаков (правило имён GitHub). */
export const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/

// 384-7 (владелец 2026-10-03: «мне нужна карточка которая позволит мне переименовать репозиторий»): переименование человеком —
// любого подключённого репозитория элемента. Тот же путь, что вслед за элементом (384-4): GitHub → данные → карта → `origin`.
export async function renameRepoTo(id: string, newName: string): Promise<RepoRename & { detail?: string }> {
  const st = readStored(id)
  if (!st.repo) return { state: "failed", reason: "not-connected" }
  const [owner, name] = st.repo.split("/")
  const target = newName.trim()
  if (!REPO_NAME.test(target) || target === "." || target === "..") return { state: "failed", from: st.repo, reason: "bad-name" }
  if (name === target) return { state: "kept", from: st.repo, reason: "same-name" }
  const { token } = tokenFor(id)
  if (!token) return { state: "failed", from: st.repo, reason: "no-token" }
  const r = await gh(token, "PATCH", `/repos/${owner}/${name}`, { name: target })
  if (r.status !== 200) {
    const detail = typeof r.body?.message === "string" ? r.body.message.slice(0, 200) : `HTTP ${r.status}`
    const reason = r.status === 0 ? "github-unreachable" : r.status === 422 ? "name-taken" : r.status === 403 || r.status === 404 || r.status === 401 ? "no-rename-right" : "rename-failed"
    return { state: "failed", from: st.repo, to: `${owner}/${target}`, reason, detail }
  }
  const full = typeof r.body?.full_name === "string" ? r.body.full_name : `${owner}/${target}`
  writeStored(id, { ...readStored(id), repo: full })
  // `origin` папки элемента есть только после восстановления (установщик, 374-5) — переводится на новое имя, если указывал на старое.
  const dir = elementDir(id)
  if (dir) {
    const o = git(dir, ["remote", "get-url", "origin"])
    if (o.rc === 0 && o.out.trim().toLowerCase().includes(`${owner}/${name}`.toLowerCase())) git(dir, ["remote", "set-url", "origin", `https://github.com/${full}.git`])
  }
  return { state: "renamed", from: st.repo, to: full }
}

export type RepoResult = { id: string; ok: boolean; repo?: string; error?: string; created?: boolean; detail?: string; retryAt?: string }

/** Последние строки вывода git без ключа — на экран как есть (377: «отправка не удалась» без причины не лечится). */
function gitDetail(out: string, token: string): string {
  return out.split(token).join("***").replace(/x-access-token:[^@\s]+@/g, "x-access-token:***@")
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-3).join(" · ").slice(0, 400)
}

/** Создать приватный репозиторий элемента в аккаунте ключа и выгрузить туда всю историю. Уже связанный — пропуск. */
export type RepoPhase = "create" | "history" | "upload"
export async function createElementRepo(id: string, token: string, login: string, phase?: (p: RepoPhase) => void): Promise<RepoResult> {
  const dir = elementDir(id)
  if (!dir) return { id, ok: false, error: "no-folder" }
  const st = readStored(id)
  if (st.repo) return { id, ok: true, repo: st.repo, created: false }
  const name = repoName(id)
  const full = `${login}/${name}`
  phase?.("create")
  const made = await gh(token, "POST", "/user/repos", { name, private: true, auto_init: false, description: `AGI ITEM «${id}» of a Fractera node` })
  const created = made.status === 201
  if (!created) {
    const said = typeof made.body?.message === "string" ? made.body.message.slice(0, 300) : `HTTP ${made.status}`
    // 377: 403 бывает и вторичным пределом GitHub на создание («secondary rate limit»), а не только нехваткой прав.
    if ((made.status === 403 || made.status === 429) && /rate limit/i.test(said)) return { id, ok: false, error: "rate-limited", detail: said, retryAt: new Date(made.retryAt).toISOString() }
    if (made.status === 403 || made.status === 401) return { id, ok: false, error: "no-create-right", detail: said }
    if (made.status === 0) return { id, ok: false, error: "github-unreachable" }
    // 422 — имя занято: берём, только если репозиторий пуст (повтор после обрыва), иначе — отказ, чужое не трогаем.
    const have = await gh(token, "GET", `/repos/${full}`)
    if (have.status !== 200 || Number(have.body?.size ?? 1) !== 0) return { id, ok: false, error: "name-taken", repo: full, detail: said }
  }
  // Обязательные элементы установщик клонирует с глубиной 1 — мелкую историю GitHub в новый репозиторий не примет.
  if (git(dir, ["rev-parse", "--is-shallow-repository"]).out.trim() === "true") {
    phase?.("history")
    const u = git(dir, ["fetch", "--quiet", "--unshallow"])
    if (u.rc !== 0) return { id, ok: false, error: "unshallow-failed", repo: full, detail: gitDetail(u.out, token) }
  }
  if (git(dir, ["rev-parse", "--verify", "--quiet", "HEAD"]).rc !== 0) return { id, ok: false, error: "no-commits", repo: full }
  phase?.("upload")
  const r = git(dir, ["push", `https://x-access-token:${token}@github.com/${full}.git`, "HEAD:refs/heads/main"])
  if (r.rc !== 0) {
    const error = /without `?workflow`? scope/i.test(r.out) ? "needs-workflow" : /403|denied/i.test(r.out) ? "no-write" : /not found/i.test(r.out) ? "repo-not-found" : "push-failed"
    return { id, ok: false, error, repo: full, detail: gitDetail(r.out, token) }
  }
  const head = git(dir, ["rev-parse", "--short", "HEAD"]).out.trim()
  writeStored(id, { ...readStored(id), repo: full, login, lastPushedAt: new Date().toISOString(), lastCommit: head })
  return { id, ok: true, repo: full, created }
}

/** Все элементы реестра: создать недостающие репозитории (ключ — свой элемента, иначе общий узла). */
// 🔒 379 — ПЕРВОИСТОЧНИК (docs.github.com, «Best practices for using the REST API»): мутирующие запросы — «serially», «wait at least
// one second between each request»; отказ по пределу — не повторять раньше `retry-after` (иначе минута), и «Continuing to make
// requests while you are rate limited may result in the banning of your integration». ✗ Mac 2026-10-02: первый отказ «secondary rate
// limit», а узел постучался ещё пятью запросами. Теперь первый отказ по пределу останавливает запуск, остальным — «отложено».
export async function createAllElementRepos(onStep?: (id: string, done: number, total: number, phase: RepoPhase | null, results: RepoResult[]) => void, only?: string): Promise<{ ok: boolean; error?: string; results: RepoResult[]; retryAt?: string }> {
  let ids: string[] = []
  try {
    ids = ((JSON.parse(readFileSync(paths.REGISTRY_FILE, "utf8")) as { services?: RegistryEntry[] }).services ?? []).map((e) => e.id)
  } catch { return { ok: false, error: "registry-unreadable", results: [] } }
  // 381 (владелец 2026-10-02: «давай делать по одному репозиторию … шаг за шагом все по очереди»): кнопка в строке — один элемент.
  if (only) ids = ids.filter((x) => x === only)
  const results: RepoResult[] = []
  const logins = new Map<string, string | null>()
  for (const id of ids) {
    onStep?.(id, results.length, ids.length, null, results)
    const { token } = tokenFor(id)
    if (!token) { results.push({ id, ok: false, error: "no-token" }); continue }
    if (!logins.has(token)) {
      const me = await gh(token, "GET", "/user")
      logins.set(token, me.status === 200 && typeof me.body?.login === "string" ? me.body.login : null)
    }
    const login = logins.get(token)
    if (!login) { results.push({ id, ok: false, error: "token-rejected" }); continue }
    const st = readStored(id)
    const r = await createElementRepo(id, token, login, (p) => onStep?.(id, results.length, ids.length, p, results))
    results.push(r)
    if (r.error === "rate-limited") {
      for (const rest of ids.slice(results.length)) results.push({ id: rest, ok: false, error: "postponed", retryAt: r.retryAt })
      return { ok: false, results, retryAt: r.retryAt }
    }
    // Пауза между мутирующими запросами — только если запрос к GitHub был (уже связанный элемент пропускается без запроса).
    if (!st.repo) await new Promise((res) => setTimeout(res, 1500))
  }
  return { ok: results.every((r) => r.ok), results }
}
