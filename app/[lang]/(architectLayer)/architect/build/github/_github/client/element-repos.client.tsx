"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { Check, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { H3 } from "@/components/ui/typography"
import type { ElementReposWords } from "../words/element-repos.i18n"
import { RateCountdown, RowCountdown } from "./rate-countdown.client"
import { terminalLink } from "@/app/[lang]/(architectLayer)/architect/kits/_agent-kit/core/client/terminal-paste.mjs"
import { announceGithubState, GITHUB_STATE_EVENT } from "@/components/node-state/github-token-alarm.client"

// РЕПОЗИТОРИИ ВСЕХ AGI ITEMS НА СТРАНИЦЕ «СТРОИТЕЛЬСТВО → GITHUB» (шаг 374-2, 374-3).
//
// 🔒 СЛОВА ВЛАДЕЛЬЦА 2026-10-02: репозитории создаёт узел («y, but privat as default»), отправка — «кнопке, Но нельзя запрещать
// делать коммит по требованию непосредственно в Claude Code Agent … Telegram бот, коммит автоматически всегда». Здесь — кнопка
// человека для каждого элемента и для всех сразу. Состояние спрашивается у двери при открытии и по «Обновить»: таймеров нет.
// 🔒 Колонка «Ключ» — старшинство 374-3: свой ключ элемента сильнее общего; «нет» — отправить нечем, и это видно до нажатия.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

type Row = {
  id: string
  kind: string
  address: string
  present: boolean
  repo: string | null
  tokenSource: "element" | "node" | null
  lastPushedAt: string | null
  lastCommit: string | null
  dirty: number
  commit: string | null
  update: { target: string | null; base: string | null; ownWork: boolean; available: boolean; merging: boolean } | null
}
type Job = { running: boolean; retryAt?: string; interrupted?: boolean; current?: string; phase?: string | null; done?: number; total?: number; startedAt?: string; finishedAt?: string; results?: Array<{ id: string; ok: boolean; error?: string; detail?: string; repo?: string }>; map?: { pushed: boolean; reason?: string; ok: boolean } }
type State = { token: boolean; elements: Row[]; job: Job }

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "")

export function ElementRepos({ words: w, lang }: { words: ElementReposWords; lang: string }) {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  // 379: время истекло — табло уступает место кнопке (перерисовка без запроса).
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/node/github-backup?full=1`, { cache: "no-store" })
      if (r.ok) setState((await r.json()) as State)
    } catch { /* остаётся прежнее */ }
  }, [])

  useEffect(() => { void load() }, [load])
  // 400: токен сохранён или проверен на карточке выше — строка «Токена GitHub пока нет» уходит сразу, без перезагрузки.
  useEffect(() => {
    const again = () => void load()
    window.addEventListener(GITHUB_STATE_EVENT, again)
    return () => window.removeEventListener(GITHUB_STATE_EVENT, again)
  }, [load])

  // 380 (владелец 2026-10-02: «вижу абсолютную мёртвую картину … где индикатор где что?»): ПОКА ИДЁТ работа — страница сама
  // спрашивает ту же дверь каждые 2,5 с и показывает ход; работа кончилась — вопросы прекращаются. Узел от этого не делает ничего
  // нового: опрос только читает состояние запуска, который начал человек.
  const running = state?.job.running === true
  // 383: работа кончилась (создание, выгрузка) — полоса над слоем спрашивает дверь заново.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) announceGithubState()
    wasRunning.current = running
  }, [running])
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => void load(), 2500)
    return () => window.clearTimeout(t)
  }, [running, state, load])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])

  const why = (code?: string) => (code ? w.errors[code] ?? `${w.errors.unknown} ${code}` : "")

  // 381: по одному — кнопка в строке элемента; пока идёт работа, все кнопки неактивны.
  async function create(id: string) {
    setBusy(id)
    await fetch(`${BASE}/api/node/github-backup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", id }) }).catch(() => null)
    await load()
    announceGithubState()
    setBusy(null)
  }

  async function push(row: Row) {
    setBusy(row.id)
    setNote((n) => ({ ...n, [row.id]: "" }))
    try {
      const r = await fetch(`${BASE}/api/architect/items/${encodeURIComponent(row.id)}/github/push`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commit: row.dirty > 0 }),
      })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; lastCommit?: string } | null
      setNote((n) => ({ ...n, [row.id]: d?.ok ? w.pushedNow.replace("{commit}", d.lastCommit ?? "") : why(d?.error ?? String(r.status)) }))
    } catch {
      setNote((n) => ({ ...n, [row.id]: w.errors.unknown }))
    }
    await load()
    setBusy(null)
  }

  // 374-7: «Обновить» — слияние нового тега Fractera; конфликт — терминал элемента с задачей в окне вставки (агенту не уходит
  // ничего без кнопки человека).
  async function update(row: Row) {
    setBusy(row.id)
    setNote((n) => ({ ...n, [row.id]: "" }))
    try {
      const r = await fetch(`${BASE}/api/architect/items/${encodeURIComponent(row.id)}/update`, { method: "POST" })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; mode?: string; commit?: string; error?: string; files?: string[]; task?: string; terminal?: string } | null
      if (d?.error === "conflict" && d.task && d.terminal) {
        setNote((n) => ({ ...n, [row.id]: w.updateConflict.replace("{n}", String(d.files?.length ?? 0)) }))
        window.location.href = terminalLink({ base: BASE, lang, service: d.terminal, text: d.task })
        return
      }
      const text = d?.ok
        ? d.mode === "merged" ? w.updateMerged.replace("{commit}", d.commit ?? "") : w.updateOnDeploy.replace("{target}", row.update?.target ?? "")
        : why(d?.error ?? String(r.status))
      setNote((n) => ({ ...n, [row.id]: text }))
    } catch {
      setNote((n) => ({ ...n, [row.id]: w.errors.unknown }))
    }
    await load()
    setBusy(null)
  }

  if (!state) return null
  const job = state.job
  const done = job.results ?? []
  // 379: GitHub велел подождать — до этого времени кнопка неактивна и время названо (таймеров нет: проверка при открытии и «Обновить»).
  const waitMs = job.retryAt ? Date.parse(job.retryAt) : 0
  const waiting = waitMs > Date.now()
  return (
    <section className="flex flex-col gap-3" data-element-repos={state.elements.length}>
      <H3 variant="ui">{w.title}</H3>
      <p className="text-sm text-muted-foreground">{w.intro}</p>
      {!state.token && <p className="text-sm text-destructive" role="alert">{w.noToken}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={busy !== null}>
          <RefreshCw className="size-4" aria-hidden />
          {w.refresh}
        </Button>
      </div>
      {job.running && (() => {
        const total = job.total ?? state.elements.length
        const ready = job.done ?? 0
        const passed = Math.max(0, now - (job.startedAt ? Date.parse(job.startedAt) : now))
        const mm = String(Math.floor(passed / 60_000)).padStart(2, "0")
        const ss = String(Math.floor((passed % 60_000) / 1000)).padStart(2, "0")
        const name = state.elements.find((e) => e.id === job.current)?.address ?? job.current ?? ""
        return (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4" role="status" aria-live="polite" data-element-repos-progress={`${ready}/${total}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LoaderCircle className="size-6 shrink-0 animate-spin text-primary" aria-hidden />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{w.progressTitle.replace("{done}", String(ready)).replace("{total}", String(total))}</span>
                  {name && <span className="text-sm text-muted-foreground">{name} — {w.phases[job.phase ?? "start"] ?? w.phases.start}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">{w.elapsed}</span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{mm}:{ss}</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${total ? Math.max(4, (ready / total) * 100) : 4}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{w.progressNote}</p>
          </div>
        )
      })()}
      {waiting && (
        <RateCountdown
          until={waitMs}
          startedAt={job.finishedAt ? Date.parse(job.finishedAt) : Date.now()}
          title={w.rateTitle}
          note={w.rateWait.replace("{at}", new Date(waitMs).toLocaleTimeString())}
          onDone={() => setTick((n) => n + 1)}
        />
      )}
      {job.interrupted && <p className="text-sm text-destructive" role="status" data-element-repos-interrupted>{w.jobInterrupted.replace("{at}", when(job.startedAt))}</p>}
      {!job.running && job.finishedAt && (
        <div className="flex flex-col gap-1 text-sm" role="status" data-element-repos-job>
          <p>{w.jobDone.replace("{at}", when(job.finishedAt)).replace("{ok}", String(done.filter((r) => r.ok).length)).replace("{all}", String(done.length))}</p>
          {job.map?.pushed && <p>{w.mapPushed}</p>}
          {job.map && !job.map.pushed && job.map.reason === "author-node" && <p className="text-muted-foreground">{w.mapAuthor}</p>}
          {job.map && !job.map.pushed && job.map.reason !== "author-node" && <p className="text-destructive">{w.mapFailed} {why(job.map.reason)}</p>}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{w.colItem}</th>
              <th className="px-3 py-2 font-medium">{w.colRepo}</th>
              <th className="px-3 py-2 font-medium">{w.colKey}</th>
              <th className="px-3 py-2 font-medium">{w.colState}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {state.elements.map((row) => {
              const failed = done.find((r) => r.id === row.id && !r.ok)
              return (
                <tr key={row.id} className="border-t border-border align-top" data-element-repo={row.id}>
                  <td className="px-3 py-2">
                    <span className="font-mono">{row.address}</span>
                    <span className="ml-1.5 text-muted-foreground">{row.kind}</span>
                  </td>
                  <td className="px-3 py-2">
                    {job.running && job.current === row.id && (
                      <p className="flex items-center gap-1.5 text-primary" data-element-repo-working>
                        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                        {w.phases[job.phase ?? "start"] ?? w.phases.start}
                      </p>
                    )}
                    {job.running && job.current !== row.id && !done.some((r) => r.id === row.id) && !row.repo && (
                      <p className="text-muted-foreground" data-element-repo-queued>{w.queued}</p>
                    )}
                    {done.some((r) => r.id === row.id && r.ok) && (
                      <p className="flex items-center gap-1.5 text-success"><Check className="size-3.5" aria-hidden />{w.doneOk}</p>
                    )}
                    {row.repo ? (
                      <a href={`https://github.com/${row.repo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono underline">
                        {row.repo}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{w.noRepo}</span>
                    )}
                    {failed && (failed.error === "rate-limited" || failed.error === "postponed") && waiting ? (
                      <RowCountdown
                        until={waitMs}
                        startedAt={job.finishedAt ? Date.parse(job.finishedAt) : Date.now()}
                        label={w.rowWait}
                        onDone={() => setTick((n) => n + 1)}
                      />
                    ) : (
                      failed && <p className="text-destructive">{why(failed.error)}</p>
                    )}
                    {/* 377: дословный ответ GitHub (ключ скрыт) — по нему причина видна сразу, без догадок. */}
                    {failed?.detail && <p className="break-all font-mono text-xs text-muted-foreground" data-element-repo-detail>{failed.repo ? `${failed.repo}: ` : ""}{failed.detail}</p>}
                  </td>
                  <td className="px-3 py-2">{row.tokenSource === "element" ? w.keyElement : row.tokenSource === "node" ? w.keyNode : w.keyNone}</td>
                  <td className="px-3 py-2">
                    <p>{row.lastPushedAt ? `${w.pushed} ${row.lastCommit ?? ""} · ${when(row.lastPushedAt)}` : w.never}</p>
                    {row.dirty > 0 && <p className="text-muted-foreground">{w.dirty.replace("{n}", String(row.dirty))}</p>}
                    {row.update?.available && (
                      <p data-element-update={row.update.target ?? ""}>
                        {w.updateAvailable.replace("{target}", row.update.target ?? "").replace("{base}", row.update.base ?? "")}
                        {row.update.merging ? ` — ${w.updateMerging}` : ""}
                      </p>
                    )}
                    {note[row.id] && <p role="status">{note[row.id]}</p>}
                  </td>
                  <td className="flex flex-col items-end gap-1.5 px-3 py-2 text-right">
                    {row.update?.available && !row.update.merging && (
                      <Button type="button" size="sm" onClick={() => void update(row)} disabled={busy !== null} data-element-update-run={row.id}>
                        {busy === row.id ? w.updating : w.update}
                      </Button>
                    )}
                    {!row.repo && row.tokenSource && row.present && !waiting && (
                      <Button type="button" size="sm" onClick={() => void create(row.id)} disabled={busy !== null || job.running} data-element-repo-create={row.id}>
                        {job.running && job.current === row.id ? w.creating : w.createOne}
                      </Button>
                    )}
                    {row.repo && row.tokenSource && (
                      <Button type="button" variant="outline" size="sm" onClick={() => void push(row)} disabled={busy !== null} data-element-repo-push={row.id}>
                        {busy === row.id ? w.pushing : row.dirty > 0 ? w.commitPush : w.push}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
