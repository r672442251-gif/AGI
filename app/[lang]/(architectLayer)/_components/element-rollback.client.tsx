"use client"

import { RotateCcw } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ElementDeploymentsUi } from "../_i18n/element-deployments.i18n"

// «ОТКАТИТЬ К ВЕРСИИ» НА «РАЗВЁРТЫВАНИЯХ» РОЖДЁННОГО ЭЛЕМЕНТА (шаг 322). Владелец 2026-10-04: «откат новым коммитом»,
// «Сохранить и откатить». Таблица версий — вид каталога без кнопок в строках, поэтому версия выбирается здесь, из тех же строк.
// Подтверждение называет версию и число несохранённых файлов; ход сборки — в панели «Развернуть» выше; дверь
// `POST /api/architect/items/<id>/rollback`. Ничего не происходит без нажатия.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function ElementRollback({ id, ui, versions, dirty }: {
  id: string
  ui: ElementDeploymentsUi
  versions: Array<{ hash: string; label: string }>
  dirty: number
}) {
  // Текущая версия — первая строка; откатывать к ней нечего, поэтому по умолчанию выбрана предыдущая.
  const [pick, setPick] = useState(versions[1]?.hash ?? versions[0]?.hash ?? "")
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null)
  const label = versions.find((v) => v.hash === pick)?.label ?? pick

  async function go() {
    setBusy(true)
    setAnswer(null)
    try {
      const r = await fetch(`${BASE}/api/architect/items/${encodeURIComponent(id)}/rollback`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commit: pick }),
      })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; commit?: string; saved?: string | null; target?: string; error?: string; detail?: string } | null
      if (d?.ok) {
        const parts = [ui.rollbackDone.replace("{target}", d.target ?? pick).replace("{commit}", d.commit ?? "")]
        if (d.saved) parts.unshift(ui.rollbackSaved.replace("{commit}", d.saved))
        setAnswer({ ok: true, text: parts.join(" ") })
      } else {
        const code = d?.error ?? "unknown"
        setAnswer({ ok: false, text: `${ui.rollbackErrors[code] ?? ui.rollbackErrors.unknown}${d?.detail ? ` ${d.detail}` : ""}` })
      }
    } catch {
      setAnswer({ ok: false, text: ui.rollbackErrors.unknown })
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  if (versions.length < 2) return null
  return (
    <section className="my-4 flex flex-col gap-2 rounded-lg border border-border p-3" data-element-rollback="ready">
      <p className="text-sm text-muted-foreground">{ui.rollbackLead}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor={`rollback-${id}`}>{ui.rollbackPick}</label>
        <select
          id={`rollback-${id}`}
          value={pick}
          onChange={(e) => { setPick(e.target.value); setAsking(false) }}
          className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-sm"
          disabled={busy}
          data-element-rollback-pick
        >
          {versions.map((v) => <option key={v.hash} value={v.hash}>{v.label}</option>)}
        </select>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setAsking(true)} disabled={busy || !pick} data-element-rollback-start>
          <RotateCcw className="size-4" aria-hidden />
          {ui.rollback}
        </Button>
      </div>
      {asking ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert" data-element-rollback-confirm>
          <p className="font-medium">{ui.rollbackConfirm.replace("{version}", label)}</p>
          {dirty > 0 ? <p>{ui.rollbackDirty.replace("{n}", String(dirty))}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={() => void go()} disabled={busy} data-element-rollback-yes>{ui.rollbackYes}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAsking(false)} disabled={busy}>{ui.rollbackNo}</Button>
          </div>
        </div>
      ) : null}
      {answer ? <p className={`text-sm ${answer.ok ? "" : "text-destructive"}`} role="status" data-element-rollback-answer={answer.ok ? "ok" : "fail"}>{answer.text}</p> : null}
    </section>
  )
}
