import "server-only"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { accountOfZone, deleteTunnelRecord, getIngress, listZones, setIngress, upsertTunnelRecord } from "@/lib/domain/cloudflare"
import { envValue } from "@/lib/agi-items/element-delete"
import { serviceUrl } from "@/lib/microservices/registry"
import { domainRecord } from "@/lib/agi-items/element-domain"
import { startStaticCopy } from "@/lib/agi-items/static-copy-start.cjs"

// ПОДДОМЕН ПЕРЕЕЗЖАЕТ ВМЕСТЕ С АДРЕСОМ ЭЛЕМЕНТА (решение владельца 2026-10-01: «Да, переноси поддомен при переименовании и убери
// старый dhndy»). 🪦 Отменяет «поддомен не трогается» шага 325-3: с 325-8 поддомен элемента = его адрес, и после переименования
// Preview и «Адрес в интернете» искали новое имя без записи DNS — Preview падал на 127.0.0.1, браузер на https его не грузит.
//
// 🔒 ПЕРЕНОСИТСЯ ТОЛЬКО ПОДКЛЮЧЁННОЕ: у старого имени нет правила туннеля — ничего не создаётся (подключение — кнопка человека).
// 🔒 СНИМАЕТСЯ ТОЛЬКО СВОЁ: правила туннеля старых имён элемента в зоне узла и записи CNAME, ведущие на туннель этого узла;
// свой домен элемента (`domain.json`) и чужие записи не трогаются.

type Step = { step: string; ok: boolean; detail?: string }

export async function moveSubdomain(id: string, from: string, to: string): Promise<{ moved: boolean; steps: Step[] }> {
  const steps: Step[] = []
  let domain: { zone?: string; tunnelId?: string } | null = null
  try { domain = JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) } catch { /* узел без домена */ }
  const key = envValue("CLOUDFLARE_API_TOKEN")
  const local = serviceUrl(id)
  if (!domain?.zone || !domain.tunnelId || !key || !local || from === to) return { moved: false, steps: [{ step: "subdomain", ok: true, detail: "nothing-to-move" }] }
  const zoneName = domain.zone
  const newHost = `${to}.${zoneName}`
  // Старые имена: прежний адрес и id (имя до первого переименования); новое имя в них не входит.
  const oldHosts = new Set([`${from}.${zoneName}`, `${id}.${zoneName}`].filter((h) => h !== newHost))
  const own = domainRecord(id)?.domain ?? null
  if (own) oldHosts.delete(own)

  const zones = await listZones(key)
  const zone = zones.ok ? zones.result.find((z) => z.name === zoneName) : null
  const account = zone ? await accountOfZone(key, zone.id) : null
  if (!zone || !account?.ok) return { moved: false, steps: [{ step: "subdomain", ok: false, detail: "cloudflare-unreachable" }] }
  const rules = await getIngress(key, account.result, domain.tunnelId)
  if (!rules.ok) return { moved: false, steps: [{ step: "tunnel", ok: false, detail: rules.reason }] }
  const connected = rules.result.some((r) => !!r.hostname && (oldHosts.has(r.hostname) || r.hostname === newHost))
  if (!connected) return { moved: false, steps: [{ step: "subdomain", ok: true, detail: "not-connected" }] }

  const kept = rules.result.filter((r) => !(r.hostname && (oldHosts.has(r.hostname) || r.hostname === newHost)))
  const put = await setIngress(key, account.result, domain.tunnelId, [...kept, { hostname: newHost, service: local }])
  steps.push({ step: "tunnel", ok: put.ok, detail: put.ok ? `${newHost} (removed ${[...oldHosts].join(",")})` : put.reason })
  if (!put.ok) return { moved: false, steps }
  const rec = await upsertTunnelRecord(key, zone.id, newHost, domain.tunnelId)
  steps.push({ step: "dns-new", ok: rec.ok, detail: rec.ok ? newHost : rec.reason })
  for (const h of oldHosts) {
    const del = await deleteTunnelRecord(key, zone.id, h, domain.tunnelId)
    steps.push({ step: "dns-old", ok: del.ok, detail: del.ok ? `${h}:${del.result}` : del.reason })
  }
  if (rec.ok) startStaticCopy(process.cwd(), id) // 385-3: адрес переехал — копия встаёт на новый, маршрут прежнего снимается
  return { moved: rec.ok, steps }
}
