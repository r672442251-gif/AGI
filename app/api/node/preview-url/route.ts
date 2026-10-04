// @api tell the address where an element of this node can be previewed
import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/require-roles"
import { getService, serviceUrl } from "@/lib/microservices/registry"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { domainRecord } from "@/lib/agi-items/element-domain"
import { addressOf } from "@/lib/agi-items/address-file.mjs"
// АДРЕС ДЛЯ ПРОСМОТРА ЭЛЕМЕНТА (страница Preview, слово владельца 2026-09-24).
//
// 🔒 373-2 (владелец 2026-10-02): «задача привью … в том чтобы показывать то как домен работает прямо сейчас режиме локальной
// разработки … она вообще должна уметь работать только с режимом Dev mode»; через интернет — «Только кнопка»; живой dev-сервер
// отменён («у компьютера есть только 400 МБ … давай отталкиваться от того какой у нас сейчас режим»). Поэтому адрес ВСЕГДА —
// петля машины: работающая сборка элемента, а не его публичный домен. Ни домен, ни поддомен здесь не выводятся: ✗ 2026-10-02
// Preview roman показывал отданный чужому аккаунту aifa.dev (530) вместо сайта. Страница ядра не на петле фрейма не строит.
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = await requireRoles(req, ["architect", "admin"])
  if (denied) return denied
  const id = req.nextUrl.searchParams.get("id") ?? ""
  const local = serviceUrl(id)
  if (!local) return NextResponse.json({ ok: false, reason: "unknown-element" }, { status: 404 })
  const lang = req.nextUrl.searchParams.get("lang") ?? "en"
  // 2026-10-02 (владелец: белый экран на se2xu…/ru): элемент из репозитория человека — чужой проект без языковых адресов; путь
  // `/<язык>` есть только у наших стартеров. Mosaic Lite на `/ru`: «No routes matched location "/ru"» — пустая страница.
  const fromRepo = (getService(id) as { born?: { from?: string } } | null)?.born?.from === "repository"
  const url = `${local.replace(/\/+$/, "")}/${fromRepo ? "" : lang}`
  // 393 (владелец 2026-10-04: «два режима: превью режим разработки и привью продакшен»): адрес элемента В ИНТЕРНЕТЕ — свой домен
  // (главный адрес элемента), иначе поддомен основного домена узла (root — сам основной домен). Своего домена у узла нет — `null`:
  // временный адрес ведёт только на ядро.
  let publicUrl: string | null = domainRecord(id)?.url ?? null
  if (!publicUrl) {
    try {
      const d = JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) as { zone?: string; hostname?: string }
      if (d.zone) publicUrl = id === "root" ? `https://${d.hostname ?? d.zone}` : `https://${addressOf(id) || id}.${d.zone}`
    } catch { /* своего домена нет */ }
  }
  return NextResponse.json({ ok: true, url, publicUrl }, { headers: { "Cache-Control": "no-store" } })
}
