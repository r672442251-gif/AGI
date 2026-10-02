"use client"

import { useEffect, useRef, useState } from "react"
import { Hourglass } from "lucide-react"

// ТАБЛО ОЖИДАНИЯ ПРЕДЕЛА GITHUB (шаг 379). Слово владельца 2026-10-02: «сделай красивый визуальный дисплей вместо мёртвой кнопки
// которая висит полу включённой полу выключенной». Отсчёт — только в браузере, раз в секунду, без единого запроса: узел за это время
// ничего не делает сам (закон «незаказанного поведения» не задет — запуск по-прежнему кнопкой человека). Время конца — от GitHub
// (`retry-after` / `x-ratelimit-reset`, иначе минута). Ноль — табло уступает место кнопке (`onDone`).

export function RateCountdown({ until, startedAt, title, note, onDone }: { until: number; startedAt: number; title: string; note: string; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const left = Math.max(0, until - now)
  // Один раз: родитель передаёт новую функцию при каждой перерисовке — без защиты ноль крутил бы цикл перерисовок.
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; onDone() }
  }, [left, onDone])

  const total = Math.max(1, until - startedAt)
  const share = Math.min(1, left / total)
  const mm = String(Math.floor(left / 60_000)).padStart(2, "0")
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4" role="timer" aria-live="off" data-rate-countdown={Math.ceil(left / 1000)}>
      <div className="flex items-center gap-3">
        <Hourglass className="size-6 shrink-0 animate-pulse text-warning" aria-hidden />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{mm}:{ss}</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-warning transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

/** Отсчёт в строке элемента (слово владельца 2026-10-02: «в каждом процессе ставь таймер обратного отсчета»): «мм:сс» и тонкая полоса. */
export function RowCountdown({ until, startedAt, label, onDone }: { until: number; startedAt: number; label: string; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, until - now)
  // Один раз: родитель передаёт новую функцию при каждой перерисовке — без защиты ноль крутил бы цикл перерисовок.
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; onDone() }
  }, [left, onDone])
  const share = Math.min(1, left / Math.max(1, until - startedAt))
  const mm = String(Math.floor(left / 60_000)).padStart(2, "0")
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")
  return (
    <span className="flex w-36 flex-col gap-1" role="timer" data-row-countdown={Math.ceil(left / 1000)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Hourglass className="size-3.5 text-warning" aria-hidden />
        {label}
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{mm}:{ss}</span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-warning transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
      </span>
    </span>
  )
}
