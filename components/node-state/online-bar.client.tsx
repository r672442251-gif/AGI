"use client"

import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { isLoopbackHostname } from "@/lib/auth/owner-at-machine"
import type { OnlineBarWords } from "./online-bar.i18n"

// ПОЛОСА «ВАШ САЙТ В СЕТИ / НЕ В СЕТИ» НАД ШАПКОЙ — ТОЛЬКО НА ЭТОМ КОМПЬЮТЕРЕ (шаг 386-2). Владелец 2026-10-04: «новую сущность
// которой работает только на локалхост это второй Хедер … Высота 30 пикселей занимает верхнее пространство не может быть перекрыто
// шапкой шапка стоит под ней. Соответственно на обычном домене она не существует», «кнопка спросить у Cloudflayer».
// Полоса прибита к верху экрана; шапка проекта (`[data-project-header]`, sticky) встаёт под неё правилом стиля самой полосы, тело
// страницы сдвигается на ту же высоту. Шапка — общая копия сайта (`components/shell`, сторож check-shell-kits): её файл не правим.
// На публичном адресе островок не рисует ничего.
// 🔒 Таймеров нет (закон 2026-09-25): узел спрашивает Cloudflare при открытии страницы и по кнопке. Источник — `/api/node/online`.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const HEIGHT = "30px"

type Answer = {
  ok: boolean
  domain: boolean
  host?: string
  online?: boolean
  at: string
  tunnel?: { status: string; connections: Array<{ colo: string; openedAt: string; pendingReconnect: boolean }> } | { error: string }
  probe?: { url: string; status: number | null; ms: number; verdict: "home" | "offline" | "error"; detail?: string }
}

export function OnlineBar({ words: w, lang }: { words: OnlineBarWords; lang: string }) {
  const [here, setHere] = useState(false)
  const [data, setData] = useState<Answer | null>(null)
  const [asking, setAsking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  const ask = useCallback(async () => {
    setAsking(true)
    try {
      const r = await fetch(`${BASE}/api/node/online`, { cache: "no-store" })
      if (!r.ok) throw new Error(String(r.status))
      setData((await r.json()) as Answer)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setAsking(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoopbackHostname(window.location.hostname)) return
    setHere(true)
    const prev = document.body.style.paddingTop
    document.body.style.paddingTop = HEIGHT
    void ask()
    return () => {
      document.body.style.paddingTop = prev
    }
  }, [ask])

  if (!here) return null

  const state = asking && !data ? "asking" : failed ? "unknown" : !data ? "asking" : !data.domain ? "none" : data.online ? "online" : "offline"
  const tone = {
    online: "bg-success text-white",
    offline: "bg-destructive text-white",
    asking: "bg-muted text-foreground",
    unknown: "bg-muted text-foreground",
    none: "bg-muted text-foreground",
  }[state]
  const text = { online: w.online, offline: w.offline, asking: w.asking, unknown: w.unknown, none: w.noDomain }[state]
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB")
  const tunnel = data?.tunnel && "status" in data.tunnel ? data.tunnel : null

  return (
    <div className="fixed inset-x-0 top-0 z-[60]" data-online-bar={state}>
      <style>{`[data-project-header]{top:${HEIGHT}}`}</style>
      <div className={`flex h-[30px] items-center justify-between gap-2 px-3 text-xs font-medium ${tone}`}>
        <button type="button" className="flex min-w-0 items-center gap-1.5 truncate" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {asking ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
          <span className="truncate">{text}</span>
          {data?.domain ? <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden /> : null}
        </button>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded border border-current/40 px-2 py-0.5 hover:bg-white/15 disabled:opacity-60"
          onClick={() => void ask()}
          disabled={asking}
          data-online-bar-ask
        >
          <RefreshCw className={`size-3 ${asking ? "animate-spin" : ""}`} aria-hidden />
          {w.ask}
        </button>
      </div>
      {open && data?.domain ? (
        <div className="border-b border-border bg-background px-3 py-2 text-xs text-foreground shadow-md" data-online-bar-details>
          <p>
            <span className="text-muted-foreground">{w.tunnel}: </span>
            {tunnel ? (w.tunnelStates[tunnel.status] ?? tunnel.status) : data.tunnel && "error" in data.tunnel ? data.tunnel.error : "—"}
          </p>
          {tunnel ? (
            <p>
              <span className="text-muted-foreground">{w.points}: </span>
              {tunnel.connections.length
                ? tunnel.connections.map((c) => `${c.colo}${c.pendingReconnect ? " (↻)" : ""} ${c.openedAt ? time(c.openedAt) : ""}`).join(" · ")
                : w.noPoints}
            </p>
          ) : null}
          {data.probe ? (
            <p>
              <span className="text-muted-foreground">{w.probe}: </span>
              <span className="font-mono">{data.host}</span> → {data.probe.status ?? data.probe.detail} ·{" "}
              {data.probe.verdict === "home" ? w.answeredHome : w.answeredCopy} · {data.probe.ms} ms
            </p>
          ) : null}
          <p className="text-muted-foreground">{w.checkedAt} {time(data.at)}</p>
        </div>
      ) : null}
    </div>
  )
}
