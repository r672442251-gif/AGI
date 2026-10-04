// @api measure and connect a service's address on the node's own domain
import { readFileSync, existsSync } from "node:fs"
import https from "node:https"
import { join } from "node:path"
import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/require-roles"
import { getService, serviceUrl } from "@/lib/microservices/registry"
import { accountOfZone, getIngress, hasDnsRecord, listZones, setIngress, upsertTunnelRecord } from "@/lib/domain/cloudflare"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { startStaticCopy } from "@/lib/agi-items/static-copy-start.cjs"

// АДРЕС СЛУЖБЫ В ИНТЕРНЕТЕ (шаг 289-2).
//
// Слово владельца 2026-09-24 (после `NXDOMAIN` на data.throughsongs.com): «что стал бы делать пользователь … на главной
// вкладке службы … нужна кнопка проверить подключение». GET меряет, POST дописывает недостающее.
//
// 🔒 РЕЖИМ — ИЗМЕРЕННЫЙ, А НЕ ОБЪЯВЛЕННЫЙ: у узла свой туннель Cloudflare (logs/domain.json пишет активация) — «Cloudflare»;
// нет — «только на этой машине». Имя: сайт (`root`) — корень зоны, прочие службы — `<id>.<зона>` (сертификат
// Cloudflare покрывает `*.<зона>`, но не `x.y.<зона>`).
// 🔒 МАРШРУТ ДОПИСЫВАЕТСЯ К ПРОЧИТАННЫМ ПРАВИЛАМ (PUT заменяет список целиком) и только если имени ещё нет.
// 🛑 ДВЕРИ СЛУЖБЫ ДАННЫХ НАРУЖУ НЕ ОТКРЫВАЮТСЯ её собственным сторожем (данные v1.3.2): имя публикует только страницу.
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const ROOT = process.cwd()

function envValue(name: string): string | null {
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

type Domain = { zone?: string; hostname?: string; tunnelId?: string; architectHostname?: string }
function readDomain(): Domain | null {
  try { return JSON.parse(readFileSync(join(ROOT, "logs", "domain.json"), "utf8")) as Domain } catch { return null }
}

// 325-8: поддомен элемента = его адрес (`address-file.mjs`), а не внутренний id.
const hostnameFor = (id: string, d: Domain) => (id === "root" ? d.hostname ?? d.zone ?? "" : `${addressOf(id)}.${d.zone}`)

// 🔒 ОТВЕЧАЕТ ЛИ АДРЕС — ИЗМЕРЯЕТСЯ МИМО DNS ЭТОЙ МАШИНЫ (289-6). ✗ Измерено: сразу после подключения имени DNS машины
// ещё помнил прежний ответ «имени нет» (отрицательный кэш), и дверь показала «адрес не отвечает», хотя из интернета он
// отвечал 200. Имя спрашивается у DNS Cloudflare (DoH), запрос идёт на полученный адрес с настоящим именем сервера.
async function publicIp(host: string): Promise<string | null> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    const j = (await r.json()) as { Answer?: Array<{ type: number; data: string }> }
    return j.Answer?.find((a) => a.type === 1)?.data ?? null
  } catch {
    return null
  }
}

async function answers(url: string): Promise<number | null> {
  const host = new URL(url).hostname
  const ip = await publicIp(host)
  if (!ip) return null
  return new Promise((done) => {
    const req = https.request(
      {
        host,
        servername: host,
        path: "/",
        method: "GET",
        timeout: 8000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lookup: ((_h: string, opts: { all?: boolean }, cb: (...a: any[]) => void) =>
          opts?.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4)) as unknown as https.RequestOptions["lookup"],
      } as https.RequestOptions,
      (res) => {
        done(res.statusCode ?? null)
        res.resume()
      },
    )
    req.on("error", () => done(null))
    req.on("timeout", () => {
      req.destroy()
      done(null)
    })
    req.end()
  })
}

type Cf = { key: string; zoneId: string; accountId: string; tunnelId: string }
async function cloudflare(d: Domain): Promise<Cf | { reason: string }> {
  const key = envValue("CLOUDFLARE_API_TOKEN")
  if (!key) return { reason: "no-key" }
  if (!d.zone || !d.tunnelId) return { reason: "no-tunnel" }
  const zones = await listZones(key)
  if (!zones.ok) return { reason: zones.reason }
  const zone = zones.result.find((z) => z.name === d.zone)
  if (!zone) return { reason: "zone-not-found" }
  const account = await accountOfZone(key, zone.id)
  if (!account.ok) return { reason: account.reason }
  return { key, zoneId: zone.id, accountId: account.result, tunnelId: d.tunnelId }
}

async function measure(id: string) {
  const local = serviceUrl(id)
  const port = local ? Number(new URL(local).port) : null
  const d = readDomain()
  if (!d?.zone || !d.tunnelId) return { ok: true, service: id, port, mode: "local" as const }
  const hostname = hostnameFor(id, d)
  const url = `https://${hostname}`
  const cf = await cloudflare(d)
  if ("reason" in cf) return { ok: true, service: id, port, mode: "cloudflare" as const, zone: d.zone, hostname, url, reason: cf.reason }
  const [rules, dns, status] = await Promise.all([getIngress(cf.key, cf.accountId, cf.tunnelId), hasDnsRecord(cf.key, cf.zoneId, hostname), answers(url)])
  return {
    ok: true,
    service: id,
    port,
    mode: "cloudflare" as const,
    zone: d.zone,
    hostname,
    url,
    routed: rules.ok ? rules.result.some((r) => r.hostname === hostname) : null,
    dns: dns.ok ? dns.result : null,
    answers: status,
  }
}

function serviceId(raw: string | null): string | null {
  const id = (raw ?? "").trim()
  return /^[a-z][a-z0-9-]{0,31}$/.test(id) && getService(id) ? id : null
}

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const id = serviceId(req.nextUrl.searchParams.get("service"))
  if (!id) return NextResponse.json({ ok: false, reason: "unknown-service" }, { status: 400 })
  return NextResponse.json(await measure(id), { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  let body: { service?: string } = {}
  try { body = await req.json() } catch { /* пусто */ }
  const id = serviceId(body.service ?? null)
  if (!id) return NextResponse.json({ ok: false, reason: "unknown-service" }, { status: 400 })
  const local = serviceUrl(id)
  if (!local) return NextResponse.json({ ok: false, reason: "not-installed" }, { status: 409 })
  const d = readDomain()
  if (!d?.zone || !d.tunnelId) return NextResponse.json({ ok: false, reason: "no-tunnel" }, { status: 409 })
  const cf = await cloudflare(d)
  if ("reason" in cf) return NextResponse.json({ ok: false, reason: cf.reason }, { status: 409 })
  const hostname = hostnameFor(id, d)

  const rules = await getIngress(cf.key, cf.accountId, cf.tunnelId)
  if (!rules.ok) return NextResponse.json({ ok: false, reason: rules.reason }, { status: 502 })
  if (!rules.result.some((r) => r.hostname === hostname)) {
    const put = await setIngress(cf.key, cf.accountId, cf.tunnelId, [...rules.result, { hostname, service: local }])
    if (!put.ok) return NextResponse.json({ ok: false, reason: put.reason }, { status: 502 })
  }
  const dns = await hasDnsRecord(cf.key, cf.zoneId, hostname)
  if (dns.ok && !dns.result) {
    const rec = await upsertTunnelRecord(cf.key, cf.zoneId, hostname, cf.tunnelId)
    if (!rec.ok) return NextResponse.json({ ok: false, reason: rec.reason }, { status: 502 })
  }
  startStaticCopy(process.cwd(), id) // 385-3: поддомен элемента подключён — копия его статических страниц в Cloudflare
  return NextResponse.json(await measure(id))
}
