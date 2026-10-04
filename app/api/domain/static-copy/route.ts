// @api list and refresh the Cloudflare copy of every node address
import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { listServices } from "@/lib/microservices/registry"
import { readStaticCopy } from "@/lib/agi-items/static-copy-state"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
import { nodeHasDomain, startStaticCopyAll } from "@/lib/agi-items/static-copy-start.cjs"

// КОПИИ В CLOUDFLARE ПО КАЖДОМУ АДРЕСУ УЗЛА (шаг 385-3). Владелец 2026-10-04: «на «Активации домена» появятся строка и кнопка».
// GET — строка на каждый элемент, у которого копия была или есть (`data/services/<id>/static-copy.json`): адреса, время, файлов,
// отказ с причиной; `running` — идёт ли проход `--all` (замок с pid, `logs/static-copy-all.lock.json`). POST — кнопка «Обновить
// копии»: один проход по всем адресам вне дерева ядра. Таймеров и опроса нет: страница спрашивает при открытии и по кнопке.
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }

function running(): boolean {
  try {
    const lock = JSON.parse(readFileSync(join(process.cwd(), "logs", "static-copy-all.lock.json"), "utf8")) as { pid?: number }
    if (!lock.pid) return false
    process.kill(lock.pid, 0)
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const rows = listServices()
    .map((s) => ({ s, c: readStaticCopy(s.id) }))
    .filter(({ c }) => c && !(c.removed && !c.ok))
    .map(({ s, c }) => ({
      id: s.id,
      address: addressOf(s.id) || s.id,
      hosts: (c as { hosts?: string[] }).hosts ?? (c!.host ? [c!.host] : []),
      ok: c!.ok,
      at: c!.at,
      files: c!.files ?? null,
      reason: c!.reason ?? null,
      detail: c!.detail ?? null,
    }))
  return NextResponse.json({ ok: true, domain: nodeHasDomain(process.cwd()), running: running(), rows }, noStore)
}

export async function POST(req: NextRequest) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403, ...noStore })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  if (running()) return NextResponse.json({ ok: true, started: false, running: true }, noStore)
  const started = startStaticCopyAll(process.cwd())
  if (!started) return NextResponse.json({ ok: false, error: "no-domain" }, { status: 409, ...noStore })
  return NextResponse.json({ ok: true, started: true, running: true }, noStore)
}
