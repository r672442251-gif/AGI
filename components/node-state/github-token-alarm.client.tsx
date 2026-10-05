"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { GitBranch } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { GithubTokenAlarmWords } from "./github-token-alarm.i18n"
import { useSnooze } from "./snooze"

// ТРЕВОЖНАЯ ПОЛОСА «РАБОТА НЕ СОХРАНЯЕТСЯ В GITHUB» НАД СЛОЕМ АРХИТЕКТОРА (шаг 374-9).
//
// 🔒 СЛОВО ВЛАДЕЛЬЦА 2026-10-02: «до тех пор пока пользователь не подключил Токен нужно показывать тревожный баннер также как мы
// показываем про собственные домен и описать почему это важно и дать кнопку напрямую переход к настройке Токена». Путь человека —
// один форк, запуск, работа, токен потом: до токена узел не может записать в GitHub ничего, и единственный риск — поломка
// компьютера; полоса называет его словами и ведёт прямо к ключу («Строительство → GitHub»).
// 🔒 Как у полосы временного адреса (371-1): не сворачивается, таймеров нет. Ключ есть и все элементы в GitHub — полосы нет.
// 383 (владелец 2026-10-03: полоса не появлялась после рождения и не гасла после создания репозитория до перезагрузки): полоса
// живёт в макете и при переходах внутри пульта не перемонтируется. Поэтому она спрашивает дверь заново при каждом переходе и
// по событию `fractera:github-state` — его шлют конец рождения и конец создания/выгрузки. Только в ответ на действие человека.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
export const GITHUB_STATE_EVENT = "fractera:github-state"

/** Сказать полосе: состав элементов или их репозитории изменились — спросить дверь заново. */
export function announceGithubState() {
  window.dispatchEvent(new Event(GITHUB_STATE_EVENT))
}

export function GithubTokenAlarm({ words, lang }: { words: GithubTokenAlarmWords; lang: string }) {
  const [state, setState] = useState<{ token: boolean; missing: string[] } | null>(null)
  // 391: «Больше не показывать» — на этом компьютере на сутки (localStorage).
  const { hidden, snooze } = useSnooze("github-token-alarm")

  const pathname = usePathname()
  const load = useCallback(() => {
    fetch(`${BASE}/api/node/github-backup`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { token?: boolean; missing?: string[] } | null) => setState(d ? { token: d.token === true, missing: Array.isArray(d.missing) ? d.missing : [] } : null))
      .catch(() => setState(null))
  }, [])

  useEffect(() => { load() }, [load, pathname])
  useEffect(() => {
    window.addEventListener(GITHUB_STATE_EVENT, load)
    return () => window.removeEventListener(GITHUB_STATE_EVENT, load)
  }, [load])

  // 382: горит, пока нет ключа ИЛИ хотя бы один элемент не сохранён в GitHub.
  if (!state || (state.token && state.missing.length === 0) || hidden) return null
  return (
    <div
      className="mx-4 mt-2 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-foreground"
      role="alert"
      data-github-token-alarm
    >
      <GitBranch className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-medium">{state.token ? words.leadSome.replace("{n}", String(state.missing.length)) : words.lead}</p>
        {state.token && <p className="font-mono text-sm" data-github-missing>{state.missing.join(", ")}</p>}
        <p>{state.token ? words.whySome : words.why}</p>
      </div>
      <div className="flex flex-col items-start gap-2 self-center">
        <a href={`${BASE}/${lang}/build/github`} className={buttonVariants({ size: "sm" })} data-github-token-connect>
          {state.token ? words.open : words.connect}
        </a>
        <button type="button" onClick={snooze} title={words.hideTitle} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-github-token-hide>
          {words.hide}
        </button>
      </div>
    </div>
  )
}
