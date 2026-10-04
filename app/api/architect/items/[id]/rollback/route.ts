// @api roll a born element back to a chosen version by new commit
import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { rollbackElement } from "@/lib/agi-items/element-rollback"

// «ОТКАТИТЬ К ВЕРСИИ» НА «РАЗВЁРТЫВАНИЯХ» ЭЛЕМЕНТА (шаг 322). Только по кнопке человека: POST `{ commit }`. Логика и законы —
// `lib/agi-items/element-rollback.ts` (новый коммит, правки агента сохраняются коммитом, файлы узла не откатываются, сборка без
// простоя). Отказы — кодом, экран переводит их в слова.
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }
const STATUS: Record<string, number> = { "not-born": 404, "bad-commit": 400, "not-in-history": 400, "same-version": 409, "deploy-running": 409, "preview-pending": 409, "git-failed": 500 }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403, ...noStore })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const { id } = await params
  let body: { commit?: unknown } = {}
  try { body = (await req.json()) as { commit?: unknown } } catch { /* пусто */ }
  const r = rollbackElement(id, typeof body.commit === "string" ? body.commit.trim() : "")
  return r.ok ? NextResponse.json(r, noStore) : NextResponse.json(r, { status: STATUS[r.error] ?? 400, ...noStore })
}
