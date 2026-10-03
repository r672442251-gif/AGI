// @api rename an element's GitHub repository
import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { elementDir, elementGithubState, renameRepoTo } from "@/lib/agi-items/element-github"
import { saveNodeMap } from "@/lib/agi-items/node-map"

// ПЕРЕИМЕНОВАТЬ РЕПОЗИТОРИЙ ЭЛЕМЕНТА (шаг 384-7). Слово владельца 2026-10-03: «мне нужна карточка которая позволит мне переименовать
// репозиторий». POST `{ name }` → `PATCH /repos/{owner}/{repo}` токеном элемента (свой → общий), затем данные элемента, реестр и
// снимок форка (`saveNodeMap`). Отказ GitHub — машинным словом и его сообщением; ничего не меняется.

export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403 })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const { id } = await params
  if (!elementDir(id)) return NextResponse.json({ ok: false, error: "not-born" }, { status: 404, ...noStore })
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null
  const r = await renameRepoTo(id, String(body?.name ?? ""))
  if (r.state === "renamed") saveNodeMap()
  if (r.state === "failed") return NextResponse.json({ ok: false, error: r.reason, detail: r.detail ?? null, from: r.from ?? null }, { status: 409, ...noStore })
  return NextResponse.json({ ok: true, rename: r, ...elementGithubState(id) }, noStore)
}
