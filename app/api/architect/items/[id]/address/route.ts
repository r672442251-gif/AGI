// @api check and set the core address of a born AGI element
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { isBornElement } from "@/lib/agi-items/element-delete"
import { addressOf, checkAddress, setAddress } from "@/lib/agi-items/element-address"
import { moveSubdomain } from "@/lib/agi-items/element-subdomain"
import { renameElementRepo } from "@/lib/agi-items/element-github"
import { saveNodeMap } from "@/lib/agi-items/node-map"

// «ПЕРЕИМЕНОВАТЬ АДРЕС» (325-3). GET `?name=` — свободно ли имя (занято — варианты); POST `{ address }` — записать, id не
// меняется. Только рождённые элементы; ворота architect/admin; на временном публичном адресе — отказ. 🪦 «Поддомен не трогается»
// отменено 2026-10-01: подключённый поддомен переезжает на новое имя (`lib/agi-items/element-subdomain.ts`).

export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }
const ROOT = process.cwd()

async function gate(req: NextRequest, id: string) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403 })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  if (!isBornElement(id)) return NextResponse.json({ ok: false, error: "not-a-born-element" }, { status: 404 })
  return null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await gate(req, id)
  if (g) return g
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim()
  return NextResponse.json({ current: addressOf(id), ...checkAddress(name, id) }, noStore)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await gate(req, id)
  if (g) return g
  const body = (await req.json().catch(() => null)) as { address?: unknown } | null
  const name = typeof body?.address === "string" ? body.address.trim() : ""
  const r = setAddress(id, name)
  if (!r.ok) return NextResponse.json(r, { status: 409, ...noStore })
  // 2026-10-01 (владелец: «переноси поддомен при переименовании»): подключённый поддомен переезжает на новое имя, старый снимается.
  const subdomain = r.previous ? await moveSubdomain(id, r.previous, addressOf(id)) : null
  // 384-4: репозиторий с именем, данным узлом, переименовывается вслед за элементом; новое имя — в данных элемента, реестре и
  // снимке форка (`saveNodeMap`). До переноса папки: `origin` правится в прежней папке.
  const repo = r.previous ? await renameElementRepo(id, r.previous, addressOf(id)) : { state: "none" as const }
  if (repo.state === "renamed") saveNodeMap()
  revalidatePath("/[lang]", "layout")
  // 343 (слово владельца «Папка = адрес»): папка элемента переезжает под новый адрес — вне дерева процессов ядра, дверь не ждёт.
  // Итог — `data/services/<id>/move.json` (отказ, например открытый терминал агента, называет, что сделать).
  spawnSync(process.execPath, [join(ROOT, "scripts", "spawn-free.mjs"), join(ROOT, "scripts", "element-move.mjs"), id], {
    cwd: ROOT, windowsHide: true, stdio: "ignore", timeout: 10_000,
  })
  return NextResponse.json({ ...r, address: addressOf(id), folder: "moving", subdomain, repo }, noStore)
}
