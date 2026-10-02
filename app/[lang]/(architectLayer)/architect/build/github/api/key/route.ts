// @api save, check or forget the GitHub key of this node
import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/require-roles"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import { binding } from "../../_github/server/binding.cjs"
import { checkAccess } from "../../_github/server/github.cjs"
import { forgetToken, saveToken, storedToken, tokenState } from "../../_github/server/token.cjs"

// КЛЮЧ GITHUB УЗЛА (273).
//
// 🔒 СОХРАНЕНИЕ СРАЗУ ПРОВЕРЯЕТ КЛЮЧ У GITHUB и возвращает, что он умеет: аккаунт · виден ли репозиторий ·
// **право записи** · срок жизни. Ключ, принятый без проверки, выглядит рабочим до дня развёртывания.
// 🛑 ПРОВЕРКА ТОЛЬКО ЧИТАЕТ. Никаких коммитов и пушей: это решение человека, а не побочный эффект кнопки.
// 🛑 ОТКАЗ НА ВРЕМЕННОМ АДРЕСЕ: ключ от чужого репозитория — секрет того же рода, что токен бота.
export const dynamic = "force-dynamic"

const ROLES = ["architect", "admin"] as const
const noStore = { headers: { "Cache-Control": "no-store" } }

export async function POST(req: NextRequest) {
  if (isTemporaryPublicAddress(req)) return NextResponse.json({ ok: false, error: "temporary-address" }, { status: 403 })
  const denied = await requireRoles(req, ROLES)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { action?: string; token?: string } | null
  const where = binding()

  switch (body?.action) {
    case "save": {
      const saved = saveToken(body.token)
      if (!saved.ok) return NextResponse.json(saved, noStore)
      const access = await checkAccess(String(body.token ?? "").trim(), where.owner, where.repo)
      // 🛑 КЛЮЧ, КОТОРЫЙ GITHUB НЕ УЗНАЁТ, НЕ ХРАНИТСЯ: иначе страница показывала бы «ключ есть» у мусора.
      if (!access.ok && access.error === "token-rejected") {
        forgetToken()
        return NextResponse.json({ ok: false, error: "token-rejected" }, noStore)
      }
      // 🪦 382: здесь сохранение ключа само создавало репозитории всех элементов (374-2). Отменено владельцем 2026-10-02 вместе с
      // автосозданием при рождении: имена элементов могут быть ещё идентификаторами — «пусть горит плашка … пользователь сам решит».
      return NextResponse.json({ ...access, ok: true, token: tokenState() }, noStore)
    }
    case "check": {
      const token = storedToken()
      if (!token) return NextResponse.json({ ok: false, error: "no-token" }, noStore)
      return NextResponse.json({ ...(await checkAccess(token, where.owner, where.repo)), token: tokenState() }, noStore)
    }
    case "forget":
      return NextResponse.json({ ...forgetToken(), token: tokenState() }, noStore)
    default:
      return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 })
  }
}
