// @api ask Cloudflare whether the node's site is online right now
import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { requireRoles } from "@/lib/auth/require-roles"
import { envValue } from "@/lib/agi-items/element-delete"
import { accountOfZone, zoneByName } from "@/lib/domain/cloudflare"

// В СЕТИ ЛИ САЙТ — СПРОСИТЬ У CLOUDFLARE (шаг 386-1). Владелец 2026-10-04: «я совершенно не могу понять когда мой компьютер
// проснулся а когда ещё нет … Очевидно там должно быть кнопка спросить у Cloudflayer?». Мои замеры с другой машины этого не
// покажут: разные точки Cloudflare видят туннель по-разному. Поэтому спрашивает сам узел, двумя способами:
//   1. API Cloudflare — состояние туннеля (healthy · degraded · down · inactive) и его соединения (точки Cloudflare, когда открыты);
//   2. живой запрос несуществующего адреса главного домена ЧЕРЕЗ ИНТЕРНЕТ: копии такого файла нет, Worker спрашивает дом. Ответил
//      Next.js (404 с `x-powered-by`) — дом в сети; страница «не в сети» (`x-fractera-copy: offline`) или 5xx/530 — Cloudflare до
//      дома не достучался и отдаёт только статику.
// 🔒 Только по нажатию и при открытии страницы (полоса 386-2): таймеров нет. Ключ наружу не уходит.
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }
const DOWN = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]

type Tunnel = { status: string; connections: Array<{ colo: string; openedAt: string; pendingReconnect: boolean }> } | { error: string }
type Probe = { url: string; status: number | null; ms: number; verdict: "home" | "offline" | "error"; detail?: string }

async function askTunnel(key: string, zone: string, tunnelId: string): Promise<Tunnel> {
  const z = await zoneByName(key, zone)
  if (!z.ok || !z.result) return { error: "zone-not-visible" }
  const acc = await accountOfZone(key, z.result.id)
  if (!acc.ok) return { error: "account-not-visible" }
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.result}/cfd_tunnel/${tunnelId}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const j = (await r.json().catch(() => null)) as { success?: boolean; result?: { status?: string; connections?: Array<{ colo_name?: string; opened_at?: string; is_pending_reconnect?: boolean }> } } | null
    if (!r.ok || !j?.success || !j.result) return { error: `tunnel-${r.status}` }
    return {
      status: j.result.status ?? "unknown",
      connections: (j.result.connections ?? []).map((c) => ({ colo: c.colo_name ?? "?", openedAt: c.opened_at ?? "", pendingReconnect: !!c.is_pending_reconnect })),
    }
  } catch {
    return { error: "tunnel-unreachable" }
  }
}

async function probe(host: string): Promise<Probe> {
  const url = `https://${host}/__fractera-online-probe?t=${Date.now()}`
  const t0 = Date.now()
  try {
    const r = await fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20_000) })
    const ms = Date.now() - t0
    const copy = r.headers.get("x-fractera-copy")
    if (copy === "offline" || DOWN.includes(r.status)) return { url, status: r.status, ms, verdict: "offline", detail: copy ?? undefined }
    return { url, status: r.status, ms, verdict: "home", detail: r.headers.get("x-powered-by") ?? undefined }
  } catch (e) {
    return { url, status: null, ms: Date.now() - t0, verdict: "error", detail: e instanceof Error ? e.name : "fetch" }
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  let d: { zone?: string; tunnelId?: string; hostname?: string } = {}
  try { d = JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) } catch { /* своего домена нет */ }
  if (!d.zone || !d.tunnelId || !d.hostname) return NextResponse.json({ ok: true, domain: false, at: new Date().toISOString() }, noStore)
  const key = envValue("CLOUDFLARE_API_TOKEN")
  const [tunnel, live] = await Promise.all([
    key ? askTunnel(key, d.zone, d.tunnelId) : Promise.resolve<Tunnel>({ error: "no-key" }),
    probe(d.hostname),
  ])
  // Итог для полосы — по живому запросу: он и есть то, что видит посетитель; состояние туннеля — объяснение.
  const online = live.verdict === "home"
  return NextResponse.json({ ok: true, domain: true, host: d.hostname, online, tunnel, probe: live, at: new Date().toISOString() }, noStore)
}
