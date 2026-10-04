import "server-only"
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { isDnsLabel } from "@/lib/agi-items/dns-label.mjs"
import { envValue } from "@/lib/agi-items/element-delete"
import { nodeZone } from "@/lib/agi-items/drafts"
import { accountOfZone, deleteAddressRecords, deleteTunnelRecord, getIngress, listZones, setIngress, upsertTunnelRecord, zoneByName, type IngressRule } from "@/lib/domain/cloudflare"
import { serviceUrl } from "@/lib/microservices/registry"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { extraDomains } from "@/lib/domain/node-domains"
import { startStaticCopy } from "@/lib/agi-items/static-copy-start.cjs"

// ВТОРОЙ СОБСТВЕННЫЙ ДОМЕН В КОРНЕ AGI ЭЛЕМЕНТА (шаг 324). Слово владельца 2026-09-27: «подключение второго своего
// собственного домена который у меня куплен … второй основной домен который подключается к корню … с редиректом на основной
// домен в корне». Выборы: 301 старого поддомена — отвечает ядро; `www.<домен>` — 301 на корень.
//
// 🔒 ДОМЕН ЛЕЖИТ У ЭЛЕМЕНТА — `data/services/<id>/domain.json` (как адрес 325-3): удаление элемента стирает папку.
// 🔒 ФОРМА ИМЕНИ — ПО ПРАВИЛАМ DNS (325-7): каждая метка — `isDnsLabel`, не меньше двух меток, имя целиком ≤253 знаков
// (RFC 1035: 255 октетов в передаче, из них два — служебные), последняя метка не число. Вводится корень домена: `www.` и
// поддомены зоны узла — отдельные отказы со словом.
// 🔒 ЗОНА — ТОЛЬКО В АККАУНТЕ КЛЮЧА УЗЛА (решение плана 324: второй аккаунт = второй туннель). Ключ не показывается нигде.

export type DomainShape = "ok" | "bad-shape" | "with-www" | "node-zone"
export type DomainState =
  | { state: "ready"; zone: string; nameServers: string[] }
  | { state: "pending"; zone: string; status: string; nameServers: string[] }
  | { state: "not-visible" }
  | { state: "no-key" }
  | { state: "taken"; by: string }
  | { state: "cloudflare-error"; reason: string }
  | { state: DomainShape }

const DATA = join(process.cwd(), "data", "services")

/** Привести ввод к имени: строчные, без пробелов по краям и без точки в конце. */
export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "")
}

export function domainShape(name: string): DomainShape {
  const labels = name.split(".")
  if (name.length > 253 || labels.length < 2 || !labels.every((l) => isDnsLabel(l))) return "bad-shape"
  if (!/[a-z]/.test(labels[labels.length - 1])) return "bad-shape"
  if (labels[0] === "www") return "with-www"
  const zone = nodeZone()
  if (zone && (name === zone || name.endsWith(`.${zone}`))) return "node-zone"
  return "ok"
}

/** Подключённый домен элемента (`null` — нет). */
export function domainOf(id: string): string | null {
  try {
    const d = (JSON.parse(readFileSync(join(DATA, id, "domain.json"), "utf8")) as { domain?: unknown }).domain
    return typeof d === "string" ? d : null
  } catch { return null }
}

/** Элемент, у которого этот домен уже подключён (кроме `forId`). */
function holderOf(name: string, forId: string): string | null {
  let ids: string[] = []
  try { ids = readdirSync(DATA) } catch { return null }
  return ids.find((id) => id !== forId && domainOf(id) === name) ?? null
}

/** Что с доменом: форма, занятость, зона в Cloudflare и её статус. Ничего не пишет. */
export async function checkDomain(input: string, forId: string): Promise<DomainState & { name: string }> {
  const name = normalizeDomain(input)
  const shape = domainShape(name)
  if (shape !== "ok") return { state: shape, name }
  const by = holderOf(name, forId)
  if (by) return { state: "taken", by, name }
  const key = envValue("CLOUDFLARE_API_TOKEN")
  if (!key) return { state: "no-key", name }
  const z = await zoneByName(key, name)
  if (!z.ok) return { state: "cloudflare-error", reason: z.reason, name }
  if (!z.result) return { state: "not-visible", name }
  const nameServers = z.result.name_servers ?? []
  return z.result.status === "active"
    ? { state: "ready", zone: z.result.name, nameServers, name }
    : { state: "pending", zone: z.result.name, status: z.result.status, nameServers, name }
}

// «ПОДКЛЮЧИТЬ» — ВЫБОР ИЗ СПИСКА ДОМЕНОВ УЗЛА (324-3). Слово владельца 2026-09-27: «вместо того чтобы вводить свой домен я
// тебя просил сделать выпадающий список и указать какие домены уже прикреплены а какие ещё свободны». Домен добавляется и
// доводится до активной зоны на странице «Активация домена»; здесь — выбор и маршрут.
// 🔒 ЗАМЕР В МОМЕНТ НАЖАТИЯ: список показывает последнее, что узел видел; подключение спрашивает Cloudflare заново и берёт
// только свободный домен с активной зоной.
// 🔒 МАРШРУТ — ТЕМ ЖЕ ТУННЕЛЕМ УЗЛА (план 324: второй аккаунт = второй туннель, здесь не строится). ГЛАВНЫЙ АДРЕС (324-5,
// решение владельца 2026-09-28: «с каким доменом по умолчанию работать: … третьего уровня либо … двух уровневый»):
//   домен главный   — `<домен>` → порт элемента; `www.<домен>` и поддомен элемента → ядро → 301 на домен;
//   поддомен главный — поддомен → порт элемента; `<домен>` и `www.<домен>` → ядро → 301 на поддомен.
// Записи DNS `<домен>` и `www.<домен>` — CNAME на туннель в зоне домена. PUT правил заменяет список целиком — правила
// дописываются к прочитанным. Запись `domain.json` (`domain`, `primary`, `url` главного адреса — его читает элемент для
// canonical) пишется только после того, как маршрут принят. После каждого нажатия ядро зовёт `revalidate` элемента по
// петле машины — страницы называют себя новым адресом без пересборки. Выбор другого домена сначала снимает прежний.

export type Primary = "domain" | "subdomain"
export type ElementDomainRecord = { domain: string; primary: Primary; url: string; subdomain: string | null }
type NodeTunnel = { key: string; zone: string; tunnelId: string; core: string; accountId: string }
type Fail = { ok: false; error: string }

function readNodeDomain(): { zone?: string; tunnelId?: string; service?: string } | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) } catch { return null }
}

/** Запись домена элемента целиком (главный адрес и поддомен) или `null`. */
export function domainRecord(id: string): ElementDomainRecord | null {
  let raw: { domain?: unknown; primary?: unknown }
  try { raw = JSON.parse(readFileSync(join(DATA, id, "domain.json"), "utf8")) } catch { return null }
  if (typeof raw.domain !== "string" || !raw.domain) return null
  const zone = readNodeDomain()?.zone
  const subdomain = zone ? `${addressOf(id)}.${zone}` : null
  const primary: Primary = raw.primary === "subdomain" && subdomain ? "subdomain" : "domain"
  return { domain: raw.domain, primary, url: `https://${primary === "subdomain" ? subdomain : raw.domain}`, subdomain }
}

async function nodeTunnel(): Promise<NodeTunnel | Fail> {
  const key = envValue("CLOUDFLARE_API_TOKEN")
  if (!key) return { ok: false, error: "no-key" }
  const d = readNodeDomain()
  if (!d?.zone || !d.tunnelId || !d.service) return { ok: false, error: "no-tunnel" }
  const zones = await listZones(key)
  if (!zones.ok) return { ok: false, error: "cloudflare-error" }
  const primary = zones.result.find((z) => z.name === d.zone)
  if (!primary) return { ok: false, error: "no-tunnel" }
  const account = await accountOfZone(key, primary.id)
  if (!account.ok) return { ok: false, error: "cloudflare-error" }
  return { key, zone: d.zone, tunnelId: d.tunnelId, core: d.service, accountId: account.result }
}

/** Правила туннеля: убрать всё о `drop`, дописать `add` впереди. */
async function putRules(t: NodeTunnel, drop: Set<string>, add: IngressRule[]): Promise<boolean> {
  const rules = await getIngress(t.key, t.accountId, t.tunnelId)
  if (!rules.ok) return false
  const put = await setIngress(t.key, t.accountId, t.tunnelId, [...add, ...rules.result.filter((r) => !drop.has(r.hostname))])
  return put.ok
}

/** Поддомен элемента (`<адрес>.<зона узла>`), если он есть в правилах туннеля. */
async function hasSubdomain(t: NodeTunnel, id: string): Promise<string | null> {
  const host = `${addressOf(id)}.${t.zone}`
  const rules = await getIngress(t.key, t.accountId, t.tunnelId)
  return rules.ok && rules.result.some((r) => r.hostname === host) ? host : null
}

/** Правила для домена по главному адресу. */
async function routeDomain(t: NodeTunnel, id: string, name: string, primary: Primary, sub: string | null): Promise<boolean> {
  const element = serviceUrl(id)
  if (!element) return false
  const www = `www.${name}`
  const add: IngressRule[] = primary === "subdomain" && sub
    ? [{ hostname: sub, service: element }, { hostname: name, service: t.core }, { hostname: www, service: t.core }]
    : [{ hostname: name, service: element }, { hostname: www, service: t.core }, ...(sub ? [{ hostname: sub, service: t.core }] : [])]
  return putRules(t, new Set([name, www, ...(sub ? [sub] : [])]), add)
}

function writeDomainFile(id: string, name: string, primary: Primary): boolean {
  const zone = readNodeDomain()?.zone
  const url = `https://${primary === "subdomain" && zone ? `${addressOf(id)}.${zone}` : name}`
  const file = join(DATA, id, "domain.json")
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    mkdirSync(join(DATA, id), { recursive: true })
    writeFileSync(tmp, JSON.stringify({ domain: name, primary, url, attachedAt: new Date().toISOString() }, null, 2) + "\n", "utf8")
    renameSync(tmp, file)
    return true
  } catch { return false }
}

/** Перерисовать страницы элемента сейчас: его дверь `revalidate` по петле машины (хозяин за машиной — архитектор). */
export async function redrawElement(id: string): Promise<boolean> {
  const element = serviceUrl(id)
  if (!element) return false
  try {
    const r = await fetch(`${element}/api/revalidate`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000) })
    return r.ok
  } catch { return false }
}

export async function attachDomain(id: string, input: string): Promise<{ ok: true; domain: string } | Fail> {
  const name = normalizeDomain(input)
  if (!extraDomains().some((d) => d.name === name)) return { ok: false, error: "not-in-list" }
  const s = await checkDomain(name, id)
  if (s.state !== "ready") return { ok: false, error: s.state }
  if (!serviceUrl(id)) return { ok: false, error: "no-port" }
  const t = await nodeTunnel()
  if ("error" in t) return t
  const previous = domainOf(id)
  if (previous && previous !== name) {
    const off = await detachDomain(id)
    if (!off.ok) return off
  }
  const zone = await zoneByName(t.key, name)
  if (!zone.ok || !zone.result) return { ok: false, error: "cloudflare-error" }
  const zoneAccount = await accountOfZone(t.key, zone.result.id)
  if (!zoneAccount.ok || zoneAccount.result !== t.accountId) return { ok: false, error: "other-account" }
  const sub = await hasSubdomain(t, id)
  if (!(await routeDomain(t, id, name, "domain", sub))) return { ok: false, error: "tunnel-failed" }
  for (const host of [name, `www.${name}`]) {
    const clear = await deleteAddressRecords(t.key, zone.result.id, host)
    if (!clear.ok) return { ok: false, error: "dns-failed" }
    const rec = await upsertTunnelRecord(t.key, zone.result.id, host, t.tunnelId)
    if (!rec.ok) return { ok: false, error: "dns-failed" }
  }
  if (!writeDomainFile(id, name, "domain")) return { ok: false, error: "write-failed" }
  await redrawElement(id)
  startStaticCopy(process.cwd(), id) // 344-3: копия публичных страниц в Cloudflare — сама, при подключении домена
  return { ok: true, domain: name }
}

/** «Главный адрес»: переставить, кто раздаёт сайт, а кто переадресует; записать и перерисовать элемент. */
export async function setPrimary(id: string, primary: Primary): Promise<{ ok: true } | Fail> {
  const rec = domainRecord(id)
  if (!rec) return { ok: false, error: "no-domain" }
  const t = await nodeTunnel()
  if ("error" in t) return t
  const sub = await hasSubdomain(t, id)
  if (primary === "subdomain" && !sub) return { ok: false, error: "no-subdomain" }
  if (!(await routeDomain(t, id, rec.domain, primary, sub))) return { ok: false, error: "tunnel-failed" }
  if (!writeDomainFile(id, rec.domain, primary)) return { ok: false, error: "write-failed" }
  await redrawElement(id)
  startStaticCopy(process.cwd(), id) // 344-3: главный адрес сменился — копия переезжает на него
  return { ok: true }
}

/** «Отключить»: имя домена и www уходят из туннеля и DNS, поддомен снова ведёт на элемент, запись стирается. */
export async function detachDomain(id: string): Promise<{ ok: true } | Fail> {
  const name = domainOf(id)
  if (!name) return { ok: true }
  const element = serviceUrl(id)
  const t = await nodeTunnel()
  if ("error" in t) return t
  const www = `www.${name}`
  const host = `${addressOf(id)}.${t.zone}`
  const rules = await getIngress(t.key, t.accountId, t.tunnelId)
  if (!rules.ok) return { ok: false, error: "tunnel-failed" }
  const hadSub = rules.result.some((r) => r.hostname === host)
  const add: IngressRule[] = hadSub && element ? [{ hostname: host, service: element }] : []
  if (!(await putRules(t, new Set([name, www, host]), add))) return { ok: false, error: "tunnel-failed" }
  const zone = await zoneByName(t.key, name)
  if (zone.ok && zone.result) for (const h of [name, www]) await deleteTunnelRecord(t.key, zone.result.id, h, t.tunnelId)
  try { rmSync(join(DATA, id, "domain.json"), { force: true }) } catch { return { ok: false, error: "write-failed" } }
  await redrawElement(id)
  // 344-3 → 385-3: домен отключён. Поддомен остался — копия переезжает на него (прежний маршрут снимается самим скриптом); нет —
  // копия и её маршрут снимаются.
  startStaticCopy(process.cwd(), id, hadSub ? [] : ["--remove"])
  return { ok: true }
}
