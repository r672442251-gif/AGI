"use client"

import { Check, CircleAlert, Clock, LoaderCircle, Minus, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { H3 } from "@/components/ui/typography"
import { isTemporaryHostname } from "@/lib/auth/temporary-address"
import type { StaticCopyWords } from "@/components/domain/domain-ladder.i18n"

// КОПИЯ В CLOUDFLARE ПО КАЖДОМУ АДРЕСУ УЗЛА (шаг 385-3). Возврат владельца 2026-10-04: «нажатие кнопки обновить вообще не показала
// имитацию запуска процесса, хотелось бы чтобы выпали список доменов которые будут обновлены», «А почему три?», «почему ты не стал
// использовать единый стандарт интерфейса?». Стандарт — живое табло шага 380 (`element-repos.client.tsx`): спиннер, «N из M»,
// элемент и фаза, mm:ss, полоса. Под табло — КАЖДЫЙ элемент узла: его адреса и состояние копии, у элемента без адреса — так и
// сказано, где адрес подключается. Источник — дверь `/api/domain/static-copy`.
// 🔒 Опрос — только пока идёт работа, запущенная человеком (как в 380, согласовано владельцем): каждые 2,5 с, кончилась — вопросы
// прекращаются. Без работы — при открытии, при возврате на вкладку и по «Проверить».

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

type Copy = { ok: boolean; at: string; files: number | null; reason: string | null; detail: string | null }
type Row = { id: string; address: string; hosts: string[] | null; copy: Copy | null }
type Job = {
  running?: boolean; startedAt?: string; finishedAt?: string; error?: string
  plan?: Array<{ id: string; address: string; hosts: string[]; action: "copy" | "remove" | "skip" }>
  current?: string | null; phase?: string | null; done?: number; total?: number
  results?: Array<{ id: string; ok: boolean; removed?: boolean; files?: number | null; reason?: string | null; detail?: string | null }>
}
type Answer = { ok: boolean; domain: boolean; hostsKnown: boolean; job: Job | null; rows: Row[] }

export function StaticCopyCard({ lang, words: w }: { lang: string; words: StaticCopyWords }) {
  const [data, setData] = useState<Answer | null>(null)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [onTemporary, setOnTemporary] = useState(false)
  // Нажато, а проход ещё не записал свой план (его процесс стартует долю секунды) — табло уже видно.
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/domain/static-copy`, { cache: "no-store" })
      if (!r.ok) throw new Error(String(r.status))
      const d = (await r.json()) as Answer
      setData(d)
      setFailed(false)
      setPendingSince((p) => (p !== null && (d.job?.startedAt ? Date.parse(d.job.startedAt) >= p - 5000 : false)) || (p !== null && Date.now() - p > 30_000) ? null : p)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    setOnTemporary(isTemporaryHostname(window.location.hostname))
    void load()
    const onVisible = () => { if (document.visibilityState === "visible") void load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [load])

  const job = data?.job ?? null
  const running = pendingSince !== null || job?.running === true
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => void load(), 2500)
    return () => window.clearTimeout(t)
  }, [running, data, load])
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])

  async function refresh() {
    setNote(null)
    const at = Date.now()
    setPendingSince(at)
    setNow(at)
    try {
      const r = await fetch(`${BASE}/api/domain/static-copy`, { method: "POST", cache: "no-store" })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!d.ok) {
        setPendingSince(null)
        setNote(d.error === "no-domain" ? w.noDomain : d.error === "temporary-address" ? w.temporary : w.error)
      }
    } catch {
      setPendingSince(null)
      setNote(w.error)
    }
    void load()
  }

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { dateStyle: "short", timeStyle: "short" })
  const reasonText = (reason?: string | null, detail?: string | null) =>
    /403|10000|Authentication|access/i.test(detail ?? "") ? w.noWorkers : (reason && w.reasons[reason]) || `${reason ?? ""} ${detail ?? ""}`.trim()

  // Пока идёт работа — табло и строки говорят по плану прохода; иначе — по измеренным адресам и итогам копий.
  const liveJob = job?.running ? job : null
  const startedAt = liveJob?.startedAt ? Date.parse(liveJob.startedAt) : pendingSince ?? now
  const passed = Math.max(0, now - startedAt)
  const mm = String(Math.floor(passed / 60_000)).padStart(2, "0")
  const ss = String(Math.floor((passed % 60_000) / 1000)).padStart(2, "0")
  const total = liveJob?.total ?? 0
  const ready = liveJob?.done ?? 0
  const currentPlan = liveJob?.plan?.find((p) => p.id === liveJob.current)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-static-copy-card>
      <H3 variant="ui">{w.title}</H3>
      <p className="text-muted-foreground text-sm">{w.lead}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="gap-1.5" onClick={() => void refresh()} disabled={running || onTemporary || !data?.domain} data-static-copy-refresh>
          {running ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {w.refresh}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>{w.check}</Button>
      </div>
      {onTemporary ? <p className="text-muted-foreground text-xs">{w.temporary}</p> : null}
      {failed ? <p className="text-destructive text-sm" role="alert">{w.error}</p> : null}
      {note ? <p className="text-destructive text-sm" role="alert" data-static-copy-note>{note}</p> : null}
      {data && !data.domain ? <p className="text-muted-foreground text-sm">{w.noDomain}</p> : null}

      {running ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4" role="status" aria-live="polite" data-static-copy-progress={`${ready}/${total}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LoaderCircle className="size-6 shrink-0 animate-spin text-primary" aria-hidden />
              <div className="flex flex-col">
                <span className="font-medium text-foreground text-sm">
                  {liveJob ? w.progressTitle.replace("{done}", String(ready)).replace("{total}", String(total)) : w.started}
                </span>
                {currentPlan ? (
                  <span className="text-muted-foreground text-sm">
                    {currentPlan.hosts.join(", ") || currentPlan.address} — {w.phases[liveJob?.phase ?? "start"] ?? w.phases.start}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">{w.elapsed}</span>
              <span className="font-mono font-semibold text-2xl text-foreground tabular-nums">{mm}:{ss}</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${total ? Math.max(4, (ready / total) * 100) : 4}%` }} />
          </div>
          <p className="text-muted-foreground text-xs">{w.progressNote}</p>
        </div>
      ) : null}

      {!running && job?.error === "interrupted" ? <p className="text-destructive text-sm" role="status">{w.interrupted}</p> : null}
      {!running && job?.error && job.error !== "interrupted" ? <p className="text-destructive text-sm" role="status">{reasonText(job.error)}</p> : null}
      {!running && job?.finishedAt && !job.error ? (
        <p className="text-sm" role="status" data-static-copy-job>
          {w.jobDone
            .replace("{at}", when(job.finishedAt))
            .replace("{ok}", String((job.results ?? []).filter((r) => r.ok && !r.removed).length))
            .replace("{all}", String((job.results ?? []).filter((r) => !r.removed).length))}
        </p>
      ) : null}

      {data?.domain && data.rows.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {data.rows.map((r) => {
            const plan = liveJob?.plan?.find((p) => p.id === r.id)
            const result = liveJob?.results?.find((x) => x.id === r.id)
            const hosts = plan?.hosts.length ? plan.hosts : r.hosts
            let icon = <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            let text = r.hosts === null ? w.hostsUnknown : w.noAddress
            let tone = "text-muted-foreground"
            let state = "no-address"
            if (liveJob && plan && plan.action !== "skip") {
              if (result) {
                icon = result.ok ? <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                text = result.removed ? w.removed : result.ok ? w.done.replace("{time}", when(r.copy?.at ?? new Date().toISOString())).replace("{files}", String(result.files ?? 0)) : w.failed.replace("{reason}", reasonText(result.reason, result.detail))
                tone = result.ok ? "text-foreground" : "text-destructive"
                state = result.ok ? "done" : "failed"
              } else if (liveJob.current === r.id) {
                icon = <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden />
                text = `${w.working} — ${w.phases[liveJob.phase ?? "start"] ?? w.phases.start}`
                tone = "text-foreground"
                state = "working"
              } else {
                icon = <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                text = w.waiting
                state = "waiting"
              }
            } else if (hosts && hosts.length) {
              if (r.copy?.ok) {
                icon = <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                text = w.done.replace("{time}", when(r.copy.at)).replace("{files}", String(r.copy.files ?? 0))
                tone = "text-foreground"
                state = "ok"
              } else if (r.copy) {
                icon = <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                text = w.failed.replace("{reason}", reasonText(r.copy.reason, r.copy.detail))
                tone = "text-destructive"
                state = "failed"
              } else {
                icon = <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                text = w.never
                state = "never"
              }
            }
            return (
              <li key={r.id} className="flex items-start gap-2 px-3 py-2 text-sm" data-static-copy-row={r.id} data-static-copy-state={state}>
                {icon}
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">
                    {r.address}
                    {hosts && hosts.length ? <span className="ml-2 break-all font-mono font-normal text-muted-foreground text-xs">{hosts.join(", ")}</span> : null}
                  </span>
                  <span className={`text-xs ${tone}`}>{text}</span>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
