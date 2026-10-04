"use client"

import { Check, CircleAlert, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { H3, Small } from "@/components/ui/typography"
import { isTemporaryHostname } from "@/lib/auth/temporary-address"
import type { StaticCopyWords } from "@/components/domain/domain-ladder.i18n"

// КОПИЯ В CLOUDFLARE ПО КАЖДОМУ АДРЕСУ УЗЛА (шаг 385-3). Владелец 2026-10-04: на «Активации домена» — строка по каждому адресу и
// кнопка. Источник — дверь `/api/domain/static-copy` (итоги `data/services/<id>/static-copy.json`). 🔒 Таймеров нет (закон
// 2026-09-25): спрашивается при открытии, при возврате на вкладку и по «Проверить», как полоса терминалов 345.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

type Row = { id: string; address: string; hosts: string[]; ok: boolean; at: string; files: number | null; reason: string | null; detail: string | null }
type Answer = { ok: boolean; domain: boolean; running: boolean; rows: Row[] }

export function StaticCopyCard({ lang, words: w }: { lang: string; words: StaticCopyWords }) {
  const [data, setData] = useState<Answer | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [onTemporary, setOnTemporary] = useState(false)

  const load = useCallback(() => {
    fetch(`${BASE}/api/domain/static-copy`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Answer) => { setData(d); setFailed(false) })
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    setOnTemporary(isTemporaryHostname(window.location.hostname))
    load()
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [load])

  async function refresh() {
    setBusy(true)
    setNote(null)
    try {
      const r = await fetch(`${BASE}/api/domain/static-copy`, { method: "POST", cache: "no-store" })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; started?: boolean }
      if (d.ok) {
        setNote(d.started ? w.started : w.running)
        setData((prev) => (prev ? { ...prev, running: true } : prev))
      } else setNote(d.error === "no-domain" ? w.noDomain : d.error === "temporary-address" ? w.temporary : w.error)
    } catch {
      setNote(w.error)
    } finally {
      setBusy(false)
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { dateStyle: "short", timeStyle: "short" })
  const why = (r: Row) => (/403|10000|Authentication|access/i.test(r.detail ?? "") ? w.noWorkers : `${r.reason ?? ""} ${r.detail ?? ""}`.trim())

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-static-copy-card>
      <H3 className="mb-2" variant="ui">{w.title}</H3>
      <p className="mb-3 text-muted-foreground text-sm">{w.lead}</p>

      {failed ? <p className="text-destructive text-sm">{w.error}</p> : null}
      {data && !data.domain ? <p className="text-muted-foreground text-sm">{w.noDomain}</p> : null}
      {data?.domain && data.rows.length === 0 ? <p className="text-muted-foreground text-sm">{w.empty}</p> : null}

      {data?.rows.length ? (
        <ul className="mb-3 grid gap-2">
          {data.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm" data-static-copy-row={r.id} data-static-copy-ok={r.ok ? "ok" : "failed"}>
              {r.ok
                ? <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                : <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
              <span className="min-w-0">
                <span className="font-mono break-all">{r.hosts.length ? r.hosts.join(", ") : r.address}</span>
                <Small className="block text-muted-foreground">
                  {r.ok
                    ? `${w.updated} ${when(r.at)} · ${r.files ?? 0} ${w.files}`
                    : `${w.failed} ${when(r.at)} · ${why(r)}`}
                </Small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.running ? <p className="mb-3 text-muted-foreground text-sm" data-static-copy-running>{w.running}</p> : null}
      {note ? <p className="mb-3 text-sm" data-static-copy-note>{note}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={refresh} disabled={busy || onTemporary || !data?.domain || data.running} data-static-copy-refresh>
          <RefreshCw className="size-4" aria-hidden />
          {w.refresh}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={load}>{w.check}</Button>
      </div>
      {onTemporary ? <Small className="mt-2 block text-muted-foreground">{w.temporary}</Small> : null}
    </section>
  )
}
