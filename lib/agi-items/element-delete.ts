import "server-only"
import { execFile, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { rename, rm } from "node:fs/promises"
import { join } from "node:path"
import paths from "@/lib/agi-items/paths.cjs"
import { deleteDraft } from "@/lib/agi-items/drafts"
import { startStaticCopy } from "@/lib/agi-items/static-copy-start.cjs"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { accountOfZone, deleteDnsRecords, getIngress, listZones, setIngress } from "@/lib/domain/cloudflare"

// УДАЛЕНИЕ РОЖДЁННОГО AGI ЭЛЕМЕНТА НАСОВСЕМ (узел, шаг 325-5). Решение владельца 2026-09-27: «Удалить насовсем».
//
// 🔒 ТОЛЬКО РОЖДЁННЫЙ (`born` в реестре, `kind: user`). Встроенные службы узла (вход, данные, сайт…) этой дверью не удаляются
// никогда: у них нет черновика и у них свой путь замены.
// 🔒 ПОРЯДОК — ОТ ЖИВОГО К МЁРТВОМУ: процесс (pm2) → адрес в интернете (маршрут туннеля и DNS) → запись реестра → черновик →
// данные элемента (ключ GitHub, состояние) → журналы рождения → папка с кодом. Сначала останавливается то, что держит файлы и
// отвечает людям, иначе Windows не отдаст папку (EBUSY), а поддомен вёл бы в пустоту.
// 🔒 КАЖДЫЙ ЭТАП — В ОТВЕТЕ. Сбой этапа называется; то, что уже снято, молча не возвращается. Репозиторий владельца на GitHub
// не трогается: удаляется копия на узле.
// 🛑 ВТОРАЯ КОПИЯ ЧТЕНИЯ КЛЮЧА CLOUDFLARE И `logs/domain.json` — в двери `/api/node/reach` (289). Названа вслух; вынести в
// общий модуль — отдельная правка.
// 🛑 НИ ОДНОЙ БЛОКИРУЮЩЕЙ ОПЕРАЦИИ ДОЛЬШЕ МГНОВЕНИЯ (325-6). Дверь работает внутри сервера ядра: `spawnSync` pm2 и `rmSync`
// папки с `node_modules` (десятки тысяч файлов) останавливали ВЕСЬ сайт — кнопка висела на «Удаляю…» ~20 с, а у dso94 стирание
// шло дольше 90 с, сторож ядра счёл сайт мёртвым и перезапустил его посреди удаления: папка осталась стёртой наполовину.
// Поэтому pm2 — асинхронно, папка — ПЕРЕИМЕНОВАНИЕМ в `AGI-ITEMS/.trash/` (мгновенно: элемента больше нет), а стирание корзины
// идёт без ожидания и без блокировки (`fs/promises`, пул потоков). Корзина стирается целиком — так дочищаются и остатки
// прерванных прежде удалений. Корзина вне git и вне проверки типов (вся `AGI-ITEMS` исключена).

const ROOT = process.cwd()
const IS_WIN = process.platform === "win32"

type Step = { step: string; ok: boolean; detail?: string }

const TRASH_DIR = join(paths.ITEMS_DIR, ".trash")
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Значение из `.env.local`/`.env` узла (ключ Cloudflare и т. п.); 324 зовёт его отсюда же. */
export function envValue(name: string): string | null {
  for (const file of [".env.local", ".env"]) {
    const p = join(ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && m[1] === name && m[2].trim()) return m[2].trim()
    }
  }
  return process.env[name]?.trim() || null
}

type Registry = { services: Array<{ id: string; kind?: string; born?: unknown; port?: number }> }
const readRegistry = (): Registry => JSON.parse(readFileSync(paths.REGISTRY_FILE, "utf8")) as Registry

/** Рождённый ли это элемент — только такие удаляются. */
export function isBornElement(id: string): boolean {
  try {
    const e = readRegistry().services.find((s) => s.id === id)
    return !!e && e.kind === "user" && !!e.born
  } catch { return false }
}

function git(dir: string, args: string[]) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true, timeout: 10_000 })
  return { rc: r.status ?? 1, out: (r.stdout ?? "").trim() }
}

/** Что потеряется: коммиты, которых нет в GitHub (null — связь не подключена, выгрузок не было). */
export function deletionRisk(id: string): { commits: number; unexported: number | null } {
  const dir = paths.itemDir(id, "user")
  const commits = Number(git(dir, ["rev-list", "--count", "HEAD"]).out) || 0
  let last: string | null = null
  try { last = (JSON.parse(readFileSync(join(ROOT, "data", "services", id, "github", "state.json"), "utf8")) as { lastCommit?: string }).lastCommit ?? null } catch { /* нет */ }
  if (!last) return { commits, unexported: null }
  const ahead = git(dir, ["rev-list", "--count", `${last}..HEAD`])
  return { commits, unexported: ahead.rc === 0 ? Number(ahead.out) || 0 : commits }
}

export async function deleteElement(id: string): Promise<{ ok: boolean; steps: Step[] }> {
  const steps: Step[] = []
  // 🔒 ПАПКА ВЫЧИСЛЯЕТСЯ ДО ЭТАПА 5 (узел, 2026-10-01). С 343 папка = адрес, а адрес живёт в `data/services/<id>/address.json`,
  // который этап 5 стирает. ✗ Замерено на roman-2 (hea7z): вычисленная после этапа 5 папка шла по id (`user/hea7z`, её нет) —
  // этап 7 отчитывался «ok», а настоящая `user/roman-2` оставалась на диске целиком.
  const dir = paths.itemDir(id, "user")
  const pm2 = (args: string[]) => new Promise<boolean>((resolve) => {
    execFile(IS_WIN ? "pm2.cmd" : "pm2", args, { cwd: ROOT, shell: IS_WIN, windowsHide: true, timeout: 30_000 }, (err) => resolve(!err))
  })

  // 1. Процесс и сторож.
  for (const name of [`fractera-svc-${id}`, `fractera-svc-${id}-watch`]) await pm2(["delete", name])
  await pm2(["save"])
  steps.push({ step: "pm2", ok: true })

  // 1а. Свой домен элемента (324-10): снимается до поддомена — имя и www уходят из туннеля и DNS, переадресация исчезает с
  // записью; домен остаётся в списке узла свободным. Импорт на месте: модуль домена сам берёт отсюда чтение ключа.
  const { detachDomain, domainOf } = await import("@/lib/agi-items/element-domain")
  const ownDomain = domainOf(id)
  if (ownDomain) {
    const off = await detachDomain(id)
    steps.push({ step: "domain", ok: off.ok, detail: off.ok ? ownDomain : off.error })
  }

  // 2. Адрес в интернете (если узел на своём домене).
  let domain: { zone?: string; tunnelId?: string } | null = null
  try { domain = JSON.parse(readFileSync(join(ROOT, "logs", "domain.json"), "utf8")) } catch { /* узел без домена */ }
  const key = envValue("CLOUDFLARE_API_TOKEN")
  if (domain?.zone && domain.tunnelId && key) {
    // 325-8: имён у элемента может быть несколько — по id (до переименования) и по адресу; снимаются оба и всякое правило,
    // ведущее на порт элемента (так уходят и промежуточные имена после нескольких переименований).
    const names = new Set([`${id}.${domain.zone}`, `${addressOf(id)}.${domain.zone}`])
    const port = (() => { try { return readRegistry().services.find((s) => s.id === id)?.port ?? null } catch { return null } })()
    const zones = await listZones(key)
    const zone = zones.ok ? zones.result.find((z) => z.name === domain!.zone) : null
    const account = zone ? await accountOfZone(key, zone.id) : null
    if (!zone || !account?.ok) {
      steps.push({ step: "tunnel", ok: false, detail: "cloudflare-unreachable" })
    } else {
      const rules = await getIngress(key, account.result, domain.tunnelId)
      const ours = (r: { hostname?: string; service?: string }) =>
        (!!r.hostname && names.has(r.hostname)) || (port !== null && !!r.hostname && /:(\d+)\/?$/.exec(r.service ?? "")?.[1] === String(port))
      if (rules.ok) for (const r of rules.result) if (ours(r) && r.hostname) names.add(r.hostname)
      if (rules.ok && rules.result.some(ours)) {
        const put = await setIngress(key, account.result, domain.tunnelId, rules.result.filter((r) => !ours(r)))
        steps.push({ step: "tunnel", ok: put.ok, detail: put.ok ? [...names].join(",") : put.reason })
      } else {
        steps.push({ step: "tunnel", ok: rules.ok, detail: rules.ok ? "no-route" : rules.reason })
      }
      let removed = 0
      let dnsOk = true
      for (const n of names) {
        if (!n.endsWith(`.${domain.zone}`)) continue
        const dns = await deleteDnsRecords(key, zone.id, n)
        if (dns.ok) removed += Number(dns.result) || 0
        else dnsOk = false
      }
      steps.push({ step: "dns", ok: dnsOk, detail: `removed:${removed}` })
    }
  } else {
    steps.push({ step: "tunnel", ok: true, detail: "no-domain" })
  }

  // 3. Запись реестра (рабочий файл узла).
  try {
    const reg = readRegistry()
    reg.services = reg.services.filter((s) => s.id !== id)
    writeFileSync(paths.REGISTRY_FILE, JSON.stringify(reg, null, 2) + "\n", "utf8")
    steps.push({ step: "registry", ok: true })
  } catch (e) {
    steps.push({ step: "registry", ok: false, detail: String(e) })
  }

  // 4. Черновик, 5. данные элемента, 6. журналы рождения.
  steps.push({ step: "draft", ok: deleteDraft(id) })
  // 385-3: копия в Cloudflare уходит вместе с элементом — иначе его адрес продолжал бы отдавать страницы удалённого. Состояние
  // копии передаётся файлом: папка данных стирается следующей строкой, раньше, чем выкладка успеет её прочитать.
  try {
    const copy = join(ROOT, "data", "services", id, "static-copy.json")
    if (existsSync(copy) && (JSON.parse(readFileSync(copy, "utf8")) as { ok?: boolean }).ok) {
      const keep = join(ROOT, "logs", `static-copy-removal-${id}.json`)
      writeFileSync(keep, readFileSync(copy))
      startStaticCopy(ROOT, id, ["--remove", `--state=${keep}`])
    }
  } catch { /* копии не было или файл битый — снимать нечего */ }
  rmSync(join(ROOT, "data", "services", id), { recursive: true, force: true })
  steps.push({ step: "data", ok: !existsSync(join(ROOT, "data", "services", id)) })
  // Журналы рождения и журналы процесса элемента (pm2 закрыл их на этапе 1).
  for (const f of [`birth-${id}.log`, `birth-${id}-live.log`, `birth-${id}.json`, `svc-${id}-out.log`, `svc-${id}-err.log`, `svc-${id}-watch.log`]) {
    try { rmSync(join(ROOT, "logs", f), { force: true }) } catch { /* занят — останется строкой журнала */ }
  }
  steps.push({ step: "logs", ok: true })

  // 7. Папка с кодом — переименованием в корзину (Windows может держать файлы остановленного процесса мгновение — повторы).
  for (let i = 0; i < 10 && existsSync(dir); i++) {
    try {
      mkdirSync(TRASH_DIR, { recursive: true })
      await rename(dir, join(TRASH_DIR, `${id}-${Date.now()}`))
    } catch { await pause(500) }
  }
  steps.push({ step: "folder", ok: !existsSync(dir), detail: existsSync(dir) ? "busy" : undefined })
  void rm(TRASH_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }).catch(() => { /* дочистится следующим удалением */ })

  return { ok: steps.every((s) => s.ok), steps }
}
