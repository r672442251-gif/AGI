// @api list and refresh the Cloudflare copy of every node address
import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { listServices } from "@/lib/microservices/registry"
import { readStaticCopy } from "@/lib/agi-items/static-copy-state"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { envValue } from "@/lib/agi-items/element-delete"
import { accountOfZone, getIngress, zoneByName } from "@/lib/domain/cloudflare"
import { nodeHasDomain, startStaticCopyAll } from "@/lib/agi-items/static-copy-start.cjs"

// КОПИИ В CLOUDFLARE ПО КАЖДОМУ АДРЕСУ УЗЛА (шаг 385-3). Владелец 2026-10-04: «хотелось бы чтобы выпали список доменов которые будут
// обновлены», «А почему три? Разве другие такие как блоки, дизайн дата и прочее не участвуют».
// GET — строка на КАЖДЫЙ элемент узла: его адреса в интернете, измеренные в туннеле сейчас (нет адреса — так и сказано, копировать
// нечего), и итог последней копии (`data/services/<id>/static-copy.json`); плюс ход прохода `--all` (`logs/static-copy-all.json`:
// план, текущий элемент, фаза, сколько готово, итоги) — его рисует табло. POST — кнопка «Обновить копии».
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }

type Job = {
  pid?: number; running?: boolean; startedAt?: string; finishedAt?: string; error?: string
  plan?: Array<{ id: string; address: string; hosts: string[]; action: "copy" | "remove" | "skip" }>
  current?: string | null; phase?: string | null; done?: number; total?: number
  results?: Array<{ id: string; ok: boolean; removed?: boolean; files?: number | null; reason?: string | null; detail?: string | null }>
}

function readJob(): Job | null {
  try {
    const job = JSON.parse(readFileSync(join(process.cwd(), "logs", "static-copy-all.json"), "utf8")) as Job
    // Процесс умер посреди прохода (пересборка ядра, выключение) — работа не идёт, а прервана.
    if (job.running && job.pid) {
      try { process.kill(job.pid, 0) } catch { return { ...job, running: false, error: job.error ?? "interrupted" } }
    }
    return job
  } catch {
    return null
  }
}

/** Порт → адреса туннеля узла, как есть. Нет ключа или туннель не виден — null (адреса неизвестны, а не «нет»). */
async function tunnelHosts(): Promise<Map<number, string[]> | null> {
  try {
    const d = JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) as { zone?: string; tunnelId?: string }
    const key = envValue("CLOUDFLARE_API_TOKEN")
    if (!d.zone || !d.tunnelId || !key) return null
    const zone = await zoneByName(key, d.zone)
    if (!zone.ok || !zone.result) return null
    const account = await accountOfZone(key, zone.result.id)
    if (!account.ok) return null
    const rules = await getIngress(key, account.result, d.tunnelId)
    if (!rules.ok) return null
    const map = new Map<number, string[]>()
    for (const r of rules.result) {
      try { const p = Number(new URL(r.service).port); map.set(p, [...(map.get(p) ?? []), r.hostname]) } catch { /* не адрес */ }
    }
    return map
  } catch {
    return null
  }
}

function ownDomain(id: string): string | null {
  try {
    const d = JSON.parse(readFileSync(join(process.cwd(), "data", "services", id, "domain.json"), "utf8")) as { url?: string }
    return d.url ? new URL(d.url).host : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const domain = nodeHasDomain(process.cwd())
  const ports = domain ? await tunnelHosts() : null
  const rows = listServices().map((s) => {
    const own = ownDomain(s.id)
    const hosts = own ? [own] : ports && typeof s.port === "number" ? ports.get(s.port) ?? [] : null
    const c = readStaticCopy(s.id)
    const copy = c && !c.removed ? { ok: c.ok, at: c.at, files: c.files ?? null, reason: c.reason ?? null, detail: c.detail ?? null } : null
    return { id: s.id, address: addressOf(s.id) || s.id, hosts, copy }
  })
  return NextResponse.json({ ok: true, domain, hostsKnown: ports !== null, job: readJob(), rows }, noStore)
}

export async function POST(req: NextRequest) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403, ...noStore })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  if (readJob()?.running) return NextResponse.json({ ok: true, started: false, running: true }, noStore)
  const started = startStaticCopyAll(process.cwd())
  if (!started) return NextResponse.json({ ok: false, error: "no-domain" }, { status: 409, ...noStore })
  return NextResponse.json({ ok: true, started: true, running: true }, noStore)
}
