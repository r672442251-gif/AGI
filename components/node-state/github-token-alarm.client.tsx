"use client"

import { useEffect, useState } from "react"
import { GitBranch } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { GithubTokenAlarmWords } from "./github-token-alarm.i18n"

// ТРЕВОЖНАЯ ПОЛОСА «РАБОТА НЕ СОХРАНЯЕТСЯ В GITHUB» НАД СЛОЕМ АРХИТЕКТОРА (шаг 374-9).
//
// 🔒 СЛОВО ВЛАДЕЛЬЦА 2026-10-02: «до тех пор пока пользователь не подключил Токен нужно показывать тревожный баннер также как мы
// показываем про собственные домен и описать почему это важно и дать кнопку напрямую переход к настройке Токена». Путь человека —
// один форк, запуск, работа, токен потом: до токена узел не может записать в GitHub ничего, и единственный риск — поломка
// компьютера; полоса называет его словами и ведёт прямо к ключу («Строительство → GitHub»).
// 🔒 Как у полосы временного адреса (371-1): не сворачивается, один запрос при открытии, таймеров нет. Ключ есть — полосы нет.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function GithubTokenAlarm({ words, lang }: { words: GithubTokenAlarmWords; lang: string }) {
  const [state, setState] = useState<{ token: boolean; missing: string[] } | null>(null)

  useEffect(() => {
    fetch(`${BASE}/api/node/github-backup`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { token?: boolean; missing?: string[] } | null) => setState(d ? { token: d.token === true, missing: Array.isArray(d.missing) ? d.missing : [] } : null))
      .catch(() => setState(null))
  }, [])

  // 382: горит, пока нет ключа ИЛИ хотя бы один элемент не сохранён в GitHub.
  if (!state || (state.token && state.missing.length === 0)) return null
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
      <a href={`${BASE}/${lang}/build/github`} className={buttonVariants({ size: "sm", className: "self-center" })} data-github-token-connect>
        {state.token ? words.open : words.connect}
      </a>
    </div>
  )
}
