"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ExternalLink, KeyRound, TriangleAlert, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { H3, Small } from "@/components/ui/typography"
import { Spinner } from "@/components/ui/spinner"
import type { GithubWords } from "../words/github.i18n"
import { announceGithubState } from "@/components/node-state/github-token-alarm.client"

// ПРИВЯЗКА УЗЛА К РЕПОЗИТОРИЮ И ЕГО КЛЮЧ (273).
//
// 🔒 СНАЧАЛА ФАКТ, ПОТОМ ДЕЙСТВИЕ: карточка привязки рисуется до всего остального, потому что человек
// пришёл сюда узнать, с каким репозиторием работает проект.
// 🛑 «ДОСТУП ЕСТЬ» НЕ ВЫВОДИТСЯ ИЗ ОТВЕТА 200: право записи — отдельная строка, и её отсутствие показано
// тревожным цветом. Узкий ключ выглядит исправным ровно до дня публикации.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
// 376: ссылка — создание КЛАССИЧЕСКОГО ключа (та же, что на странице GitHub элемента, проверена владельцем в 319-5).
const TOKENS_URL = "https://github.com/settings/tokens/new"
// Предупреждаем за две недели: продлить ключ — дело на минуту, но только пока он ещё работает.
const SOON_MS = 14 * 24 * 60 * 60 * 1000

type Binding = {
  state: "no-git" | "no-remote" | "upstream" | "foreign-host" | "own"
  url: string | null
  owner: string | null
  repo: string | null
  branch: string | null
  commit: string | null
  subject: string | null
}

type Access = {
  ok?: boolean
  error?: string
  login?: string | null
  expires?: string | null
  repo?: string | null
  canRead?: boolean | null
  canWrite?: boolean | null
  visibility?: string | null
}

/**
 * Репозиторий, подключённый мастером. `null` — мастер не проходили (274-5).
 *
 * 🔒 ОТДЕЛЬНО ОТ `binding`, ПОТОМУ ЧТО ЭТО ДРУГОЙ ФАКТ. `binding` измеряется у git и отвечает «с чем
 * узел работает сейчас»; `connected` помнит, о чём попросил человек. Совпадают они не всегда.
 */
type Connected = { url: string; verified: boolean; pushed: boolean }

type State = {
  binding: Binding
  token: { configured: boolean; tail: string | null }
  connected: Connected | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </p>
  )
}

// 375 (владелец 2026-10-02, Mac: «если репозиторий уже есть то вверху кнопка добавить новую репетитору точно не нужно»): кнопка
// мастера подключения приходит пропсом и показывается, только пока у узла НЕТ своего репозитория (`own`). Состояние меряется у git
// при каждом открытии — удалил или отвязал репозиторий, кнопка вернётся.
export function GithubBinding({ lang, words, connect }: { lang: string; words: GithubWords; connect?: React.ReactNode }) {
  const api = `${BASE}/${lang}/architect/build/github/api`
  const [state, setState] = useState<State | null | "forbidden">(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/state`, { cache: "no-store" })
      if (res.status === 401 || res.status === 403) return setState("forbidden")
      const body = (await res.json()) as { ok?: boolean } & State
      setState({ binding: body.binding, token: body.token, connected: body.connected ?? null })
    } catch {
      setError(words.errors.network)
    }
  }, [api, words.errors.network])

  useEffect(() => {
    load()
  }, [load])

  const act = useCallback(
    async (action: "save" | "check" | "forget", extra: Record<string, unknown> = {}) => {
      setBusy(action)
      setError(null)
      try {
        const res = await fetch(`${api}/key`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        })
        const data = (await res.json().catch(() => ({}))) as Access & { token?: State["token"] }
        if (data.error) setError(words.errors[data.error] ?? words.errors.network)
        if (action === "forget") setAccess(null)
        else if (data.ok) setAccess(data)
        if (data.token) setState((prev) => (prev && prev !== "forbidden" ? { ...prev, token: data.token! } : prev))
        else load()
      } catch {
        setError(words.errors.network)
      } finally {
        setBusy(null)
        // 400 (владелец 2026-10-05: «нажимаю кнопку проверить доступ и как будто бы ничего не случается … чтобы эти надписи
        // исчезали сразу а не после перезагрузки страницы»): токен сохранён, проверен или забыт — полоса над слоем и строки
        // элементов ниже спрашивают дверь заново. Только в ответ на нажатие.
        announceGithubState()
      }
    },
    [api, load, words.errors],
  )

  if (state === "forbidden") return <p className="my-6 text-muted-foreground text-sm">{words.forbidden}</p>
  if (state === null) return <p className="my-6 text-muted-foreground text-sm">{words.loading}</p>

  const b = state.binding
  const stateWord = {
    own: words.stateOwn,
    upstream: words.stateUpstream,
    "no-git": words.stateNoGit,
    "no-remote": words.stateNoRemote,
    "foreign-host": words.stateForeignHost,
  }[b.state]
  const calm = b.state === "own" || b.state === "foreign-host"
  const expiresAt = access?.expires ? new Date(access.expires) : null
  const expiringSoon = expiresAt !== null && expiresAt.getTime() - Date.now() < SOON_MS

  return (
    <div className="my-6 flex flex-col gap-4" data-github-binding data-state={b.state}>
      {b.state !== "own" && connect}
      <p className="text-muted-foreground text-sm">{words.intro}</p>

      {/* ── с каким репозиторием работает узел ─────────────────────────────── */}
      <section className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
        <H3 variant="ui">{words.bindingTitle}</H3>
        {b.url && <Row label={words.repoLabel} value={<span className="font-mono text-xs">{b.url}</span>} />}
        {b.branch && <Row label={words.branchLabel} value={<span className="font-mono text-xs">{b.branch}</span>} />}
        {b.commit && (
          <Row label={words.commitLabel} value={<span className="font-mono text-xs">{b.commit} {b.subject}</span>} />
        )}
        <div
          className={
            calm
              ? "mt-1 flex gap-2 rounded-md border border-tone-data/50 bg-tone-data/10 px-3 py-2 text-sm"
              : "mt-1 flex gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
          }
          role="status"
          data-binding-note
        >
          {calm ? (
            <Check className="mt-0.5 size-4 shrink-0 text-tone-data" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          )}
          <span>{stateWord}</span>
        </div>
      </section>

      {/* ── репозиторий, подключённый мастером ─────────────────────────────── */}
      {/* 🔒 ВТОРАЯ ЗАПИСЬ СТОИТ РЯДОМ С ПЕРВОЙ, А НЕ ВМЕСТО НЕЁ (274-5): «с чем узел работает» и
          «что подключил человек» — разные факты, и расхождение между ними человек обязан видеть. */}
      <section
        className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3"
        data-connected-repo={state.connected ? "yes" : "no"}
      >
        <H3 variant="ui">{words.connectedTitle}</H3>
        <p className="text-muted-foreground text-sm">{words.connectedLead}</p>
        {state.connected ? (
          <>
            <Row
              label={words.repoLabel}
              value={<span className="font-mono text-xs">{state.connected.url}</span>}
            />
            <Row
              label={words.check}
              value={state.connected.verified ? words.connectedVerified : words.connectedUnverified}
            />
            <Row
              label={words.bindingTitle}
              value={state.connected.pushed ? words.connectedPushed : words.connectedNotPushed}
            />
            {b.url && state.connected.url !== b.url && (
              <div
                className="mt-1 flex gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
                role="status"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>{words.connectedDiffers}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{words.connectedEmpty}</p>
        )}
      </section>

      {/* ── ключ ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
        <H3 variant="ui">{words.keyTitle}</H3>
        <p className="text-muted-foreground text-sm">{words.keyLead}</p>
        <ol className="ml-5 list-decimal text-muted-foreground text-sm [&>li]:mt-1">
          {words.keySteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div>
          <a href={TOKENS_URL} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {words.openTokens}
            <ExternalLink className="ml-2 size-4" aria-hidden />
          </a>
        </div>

        {state.token.configured && (
          <p className="flex items-center gap-2 text-sm" data-key-saved>
            <KeyRound className="size-4" aria-hidden />
            {words.saved.replace("{tail}", state.token.tail ?? "")}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <Label htmlFor="gh-token">{words.keyLabel}</Label>
          <Input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <Small className="text-muted-foreground">{words.keyHint}</Small>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy !== null || !token.trim()}
            onClick={() => {
              const value = token.trim()
              // 🛑 Секрет живёт в поле ровно до отправки — в любом исходе.
              setToken("")
              void act("save", { token: value })
            }}
          >
            {busy === "save" ? <Spinner className="size-4" /> : <KeyRound className="size-4" aria-hidden />}
            {busy === "save" ? words.saving : words.save}
          </Button>
          {state.token.configured && (
            <>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void act("check")}>
                {busy === "check" ? <Spinner className="size-4" /> : <Check className="size-4" aria-hidden />}
                {busy === "check" ? words.checking : words.check}
              </Button>
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void act("forget")}>
                <X className="size-4" aria-hidden />
                {words.forget}
              </Button>
            </>
          )}
        </div>
      </section>

      {/* ── что умеет ключ ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3" data-access>
        <H3 variant="ui">{words.accessTitle}</H3>
        {!access ? (
          <p className="text-muted-foreground text-sm">{words.notChecked}</p>
        ) : (
          <>
            <Row label={words.accountLabel} value={access.login ?? words.unknown} />
            <Row
              label={words.visibleLabel}
              value={access.canRead === null ? words.unknown : access.canRead ? words.yes : words.no}
            />
            <Row
              label={words.writeLabel}
              value={access.canWrite === null ? words.unknown : access.canWrite ? words.yes : words.no}
            />
            <Row
              label={words.expiresLabel}
              value={expiresAt ? expiresAt.toLocaleDateString(lang) : access.ok ? words.never : words.unknown}
            />
            {access.canWrite === true && (
              <p className="mt-1 flex gap-2 rounded-md border border-tone-data/50 bg-tone-data/10 px-3 py-2 text-sm" data-write-ok>
                <Check className="mt-0.5 size-4 shrink-0 text-tone-data" aria-hidden />
                <span>{words.writeOk}</span>
              </p>
            )}
            {access.canWrite === false && (
              <p className="mt-1 flex gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm" data-write-denied>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>{words.writeDenied}</span>
              </p>
            )}
            {expiringSoon && (
              <p className="mt-1 flex gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm" data-expires-soon>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>{words.expiresSoon}</span>
              </p>
            )}
          </>
        )}
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/40 px-4 py-3 text-destructive text-sm" role="status" data-github-error>
          {error}
        </p>
      )}
    </div>
  )
}
