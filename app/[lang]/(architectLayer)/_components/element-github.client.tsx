"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { CircleCheck, CircleHelp, GitBranch, TriangleAlert, Upload } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { H4 } from "@/components/ui/typography"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ElementGithubUi } from "../_i18n/element-github.i18n"
import { announceGithubState } from "@/components/node-state/github-token-alarm.client"

// GITHUB РОЖДЁННОГО ЭЛЕМЕНТА (319-5): связь (репозиторий + ключ → проверка у GitHub), «Отправить в GitHub» КНОПКОЙ и
// последняя выгрузка. Незакоммиченные правки — отказ с их числом и вторая кнопка «Закоммитить и отправить»; у каждого пути
// пояснение за «?» (слово владельца «а and b need both with description in (?)»). Ключ уходит в дверь один раз и в
// островке не хранится; поле очищается после сохранения.
// 384-2 (владелец 2026-10-03: «ключ GitHub существует один общий на весь проект … не обозначает что проект сейчас должен показывать
// отсутствие ключа как будто он нерабочий … нужно показывать зелёную плашку»): сверху — плашка состояния (зелёная: репозиторий и
// токен есть; жёлтая: токен есть, репозитория нет — «Создать и выгрузить» здесь же; красная: токена нет). Форма другого
// репозитория и своего токена — ниже, необязательная: пустое поле токена = общий токен узла.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

type State = {
  repo: string | null
  login: string | null
  expires: string | null
  tokenTail: string | null
  lastPushedAt: string | null
  lastCommit: string | null
  dirty: number
  commit: string | null
  tokenSource?: "element" | "node" | null
  activeTail?: string | null
}
type ImportState = { state: string; target?: string; previous?: string; reason?: string; detached?: boolean }

function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={text}>
          <CircleHelp className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

export function ElementGithub({ id, lang, ui }: { id: string; lang: string; ui: ElementGithubUi }) {
  const [s, setS] = useState<State | null>(null)
  const [repo, setRepo] = useState("")
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState<"connect" | "push" | "rename" | null>(null)
  // 384-6 (владелец 2026-10-03: «почему эта ответ … находится под второй карточкой хотя я вопрос задавал первой карточке»): у итога —
  // адрес карточки, где нажата кнопка; показывается плашкой там же.
  type Where = "connect" | "push" | "create" | "import" | "rename"
  const [message, setMessageRaw] = useState<{ tone: "ok" | "error"; text: string; where: Where } | null>(null)
  const setMessage = (m: { tone: "ok" | "error"; text: string; where?: Where } | null) => setMessageRaw(m ? { ...m, where: m.where ?? "connect" } : null)
  const [renameTo, setRenameTo] = useState("")
  const [dirtyBlock, setDirtyBlock] = useState<number | null>(null)
  const url = `${BASE}/api/architect/items/${id}/github`
  // 374-6: импорт на место элемента — поля, подтверждение, ход (спрашивается кнопкой, таймеров нет).
  const [importRepo, setImportRepo] = useState("")
  const [importToken, setImportToken] = useState("")
  const [importAsk, setImportAsk] = useState(false)
  const [imp, setImp] = useState<ImportState | null>(null)
  const loadImport = useCallback(async () => {
    try {
      const r = await fetch(`${url}/import`, { cache: "no-store" })
      if (r.ok) setImp((await r.json()) as ImportState)
    } catch { /* прежнее */ }
  }, [url])
  useEffect(() => { void loadImport() }, [loadImport])
  async function startImport() {
    setImportAsk(false)
    setMessage(null)
    const { status, body: d } = await call(`${url}/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: importRepo, token: importToken }) })
    if (!d) { setMessage({ tone: "error", text: network(status), where: "import" }); return }
    if (!d.ok) { setMessage({ tone: "error", text: err(d.error), where: "import" }); return }
    setImportToken("")
    await loadImport()
  }

  // 384-2: «Создать и выгрузить» — та же дверь, что в строке таблицы узла (381); пока идёт работа, страница спрашивает ход каждые
  // 2,5 с (как табло 380), кончилась — один раз перечитывает состояние и будит полосу над слоем.
  const [creating, setCreating] = useState(false)
  async function createRepo() {
    setCreating(true)
    setMessage(null)
    await fetch(`${BASE}/api/node/github-backup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", id }) }).catch(() => null)
    for (;;) {
      await new Promise((res) => setTimeout(res, 2500))
      const r = await fetch(`${BASE}/api/node/github-backup?full=1`, { cache: "no-store" }).catch(() => null)
      const d = (r && r.ok ? await r.json().catch(() => null) : null) as { job?: { running?: boolean; results?: Array<{ id: string; ok: boolean; error?: string; detail?: string }> } } | null
      if (!d?.job?.running) {
        const mine = d?.job?.results?.find((x) => x.id === id)
        if (mine && !mine.ok) setMessage({ tone: "error", text: `${err(mine.error)}${mine.detail ? ` — ${mine.detail}` : ""}`, where: "create" })
        break
      }
    }
    await load()
    announceGithubState()
    setCreating(false)
  }

  const load = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" })
    if (r.ok) {
      const next = (await r.json()) as State
      setS(next)
      if (next.repo) setRepo((v) => v || next.repo || "")
    }
  }, [url])

  useEffect(() => { load() }, [load])

  const err = (code: unknown) => ui.errors[String(code)] ?? ui.errors["push-failed"]
  // Слово владельца 2026-09-27: «попытайся какие-то читаемые ошибки показать». Ответ не JSON или запрос оборвался — тоже
  // слова и код, а не тишина: раньше такой сбой не показывался вовсе.
  async function call(input: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
    try {
      const r = await fetch(input, init)
      const body = (await r.json().catch(() => null)) as Record<string, unknown> | null
      return { status: r.status, body }
    } catch {
      return { status: 0, body: null }
    }
  }
  const network = (status: number) => ui.network.replace("{code}", status ? String(status) : "—")

  async function connect() {
    setBusy("connect")
    setMessage(null)
    try {
      const { status, body: d } = await call(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo, token }) })
      if (!d) setMessage({ tone: "error", text: network(status) })
      else if (d.ok) {
        const next = d as unknown as State
        setS(next)
        setToken("")
        const source = next.tokenSource === "element" ? ui.tokenOwnShort : ui.tokenNodeShort
        setMessage({ tone: "ok", text: ui.connectOk.replace("{source}", source.replace("{tail}", next.activeTail ?? "")).replaceAll("{repo}", next.repo ?? "") })
        announceGithubState()
      }
      else setMessage({ tone: "error", text: err(d.error) })
    } finally { setBusy(null) }
  }

  async function forget() {
    const { status, body } = await call(url, { method: "DELETE" })
    if (body?.ok) setS(body as unknown as State)
    else setMessage({ tone: "error", text: body ? err(body.error) : network(status) })
  }

  async function push(commit: boolean) {
    setBusy("push")
    setMessage(null)
    setDirtyBlock(null)
    try {
      const { status, body: d } = await call(`${url}/push`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commit }) })
      if (!d) { setMessage({ tone: "error", text: network(status), where: "push" }); return }
      if ("repo" in d) setS(d as unknown as State)
      if (d.ok) setMessage({ tone: "ok", text: ui.pushed.replace("{commit}", String(d.commit ?? "")), where: "push" })
      else if (d.error === "dirty") setDirtyBlock(Number(d.dirty ?? 0))
      else setMessage({ tone: "error", text: err(d.error), where: "push" })
    } finally { setBusy(null) }
  }

  // 384-7: «Переименовать репозиторий» — дверь `…/github/rename`; итог плашкой в карточке.
  async function renameRepo() {
    setBusy("rename")
    setMessage(null)
    try {
      const { status, body: d } = await call(`${url}/rename`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: renameTo }) })
      if (!d) { setMessage({ tone: "error", text: network(status), where: "rename" }); return }
      if (d.ok) {
        const r = d.rename as { from?: string; to?: string; state?: string } | undefined
        setS(d as unknown as State)
        setRepo(String((d as { repo?: string }).repo ?? ""))
        setRenameTo("")
        setMessage({ tone: "ok", text: r?.state === "renamed" ? ui.renamed.replace("{from}", r.from ?? "").replace("{to}", r.to ?? "") : ui.renameSame, where: "rename" })
        announceGithubState()
      } else setMessage({ tone: "error", text: `${err(d.error)}${d.detail ? ` (GitHub: ${String(d.detail)})` : ""}`, where: "rename" })
    } finally { setBusy(null) }
  }

  /** Плашка итога в карточке `where`: зелёная — успех, красная — отказ с причиной. */
  const note = (where: Where) => message?.where === where && (
    <div
      className={`flex items-start gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-medium text-foreground ${message.tone === "ok" ? "border-success/50 bg-success/10" : "border-destructive/60 bg-destructive/10"}`}
      role={message.tone === "ok" ? "status" : "alert"}
      data-element-github-message={message.tone}
      data-element-github-message-where={where}
    >
      {message.tone === "ok" ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
      <p>{message.text}</p>
    </div>
  )

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang) : null)
  const row = (label: string, value: ReactNode) => (
    <div className="flex flex-wrap gap-x-2 text-sm"><span className="text-muted-foreground">{label}:</span><span className="font-mono">{value}</span></div>
  )

  // Какой токен работает сейчас — строкой над каждым полем токена (поправка владельца: поле не говорит «пусто»).
  const activeLine = !s ? null : s.tokenSource === "element" ? ui.activeElement.replace("{tail}", s.activeTail ?? "") : s.tokenSource === "node" ? ui.activeNode.replace("{tail}", s.activeTail ?? "") : ui.activeNone
  const active = activeLine && (
    <p className={`flex items-center gap-1.5 text-sm font-medium ${s?.tokenSource ? "text-foreground" : "text-destructive"}`} data-element-github-active={s?.tokenSource ?? "none"}>
      {s?.tokenSource ? <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="size-4 shrink-0" aria-hidden />}
      {activeLine}
    </p>
  )
  const importKey = imp?.state === "done" && imp.detached ? "detached" : imp?.state ?? "none"
  return (
    <TooltipProvider>
      <div className="my-4 flex flex-col gap-6" data-element-github={id}>
        {/* 384-2: плашка состояния — первое, что видит человек. */}
        {s && s.tokenSource && s.repo && (
          <div className="flex flex-col gap-2 rounded-md border-2 border-success/50 bg-success/10 px-3 py-2 text-sm" role="status" data-element-github-plate="ok">
            <div className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <p className="font-medium">
                {ui.plateOk
                  .replace("{source}", (s.tokenSource === "element" ? ui.plateSourceElement : ui.plateSourceNode).replace("{tail}", s.activeTail ?? ""))
                  .split("{repo}")
                  .flatMap((part, i) => (i === 0 ? [part] : [<a key={i} href={`https://github.com/${s.repo}`} target="_blank" rel="noopener noreferrer" className="font-mono underline underline-offset-2">{s.repo}</a>, part]))}
              </p>
            </div>
            {row(ui.lastPush, s.lastPushedAt ? `${when(s.lastPushedAt)} · ${s.lastCommit}` : ui.neverPushed)}
            <div className="flex items-center gap-1">
              <Button type="button" className="w-fit gap-1.5" onClick={() => push(false)} disabled={busy !== null} data-element-github-push>
                <Upload className="size-4" aria-hidden />
                {busy === "push" ? ui.pushing : ui.push}
              </Button>
              <Help text={ui.pushHelp} />
            </div>
            {note("push")}
            {dirtyBlock !== null && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3" role="status" data-element-github-dirty={dirtyBlock}>
                <div className="flex items-start gap-1">
                  <p className="text-sm text-foreground">{ui.dirty.replace("{n}", String(dirtyBlock))}</p>
                  <Help text={ui.dirtyHelp} />
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => push(true)} disabled={busy !== null} data-element-github-commit-push>
                    {ui.commitPush}
                  </Button>
                  <Help text={ui.commitPushHelp} />
                </div>
              </div>
            )}
          </div>
        )}
        {s && s.tokenSource && !s.repo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-2 border-warning/50 bg-warning/10 px-3 py-2 text-sm" role="status" data-element-github-plate="no-repo">
            <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
            <p className="flex-1 font-medium">{ui.plateNoRepo}</p>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => void createRepo()} disabled={creating || busy !== null} data-element-github-create>
              <GitBranch className="size-4" aria-hidden />
              {creating ? ui.creatingRepo : ui.createRepo}
            </Button>
          </div>
        )}
        {note("create")}
        {s?.repo && (
          <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-element-github-rename>
            <div className="flex items-center gap-1">
              <H4 variant="ui">{ui.renameTitle}</H4>
              <Help text={ui.renameHelp} />
            </div>
            {row(ui.renameCurrent, s.repo)}
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void renameRepo() }}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`gh-rename-${id}`}>{ui.renameLabel}</Label>
                <Input id={`gh-rename-${id}`} value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder={s.repo.split("/")[1] ?? ""} autoComplete="off" spellCheck={false} className="max-w-72 font-mono" />
              </div>
              <Button type="submit" variant="outline" disabled={!renameTo.trim() || renameTo.trim() === s.repo.split("/")[1] || busy !== null} data-element-github-rename-button>
                {busy === "rename" ? ui.renaming : ui.renameButton}
              </Button>
            </form>
            {note("rename")}
          </section>
        )}
        {s && !s.tokenSource && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-sm" role="alert" data-element-github-plate="no-token">
            <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
            <p className="flex-1 font-medium">{ui.plateNoToken}</p>
            <a href={`${BASE}/${lang}/build/github`} className={buttonVariants({ size: "sm" })}>{ui.plateNoTokenLink}</a>
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-element-github-other>
          <div className="flex items-center gap-1">
            <H4 variant="ui">{ui.otherTitle}</H4>
            <Help text={ui.otherHelp} />
          </div>
          {/* Слово владельца 2026-09-27: «две три строчки описание и ссылка». Адрес токена — из документации GitHub. */}
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground" data-element-github-steps>
            <li>
              {ui.step1}{" "}
              <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{ui.step1Link}</a>
            </li>
            <li>
              {ui.step2}{" "}
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{ui.step2Link}</a>
              <ol className="mt-1 flex list-[lower-alpha] flex-col gap-1 pl-5 text-muted-foreground" data-element-github-step2>
                {ui.step2Sub.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
            </li>
            <li>{ui.step3}</li>
            <li>{ui.step4}</li>
          </ol>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); connect() }} data-element-github-connect>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`gh-repo-${id}`}>{ui.repoLabel}</Label>
              <Input id={`gh-repo-${id}`} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={ui.repoPlaceholder} autoComplete="off" spellCheck={false} className="font-mono" />
            </div>
            {active}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor={`gh-token-${id}`}>{ui.tokenLabel}</Label>
                <Help text={ui.tokenHelp} />
              </div>
              <Input id={`gh-token-${id}`} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={ui.tokenPlaceholder} autoComplete="off" spellCheck={false} className="font-mono" />
            </div>
            <Button type="submit" variant="outline" className="w-fit gap-1.5" disabled={!repo.trim() || busy !== null} data-element-github-connect-button>
              <GitBranch className="size-4" aria-hidden />
              {busy === "connect" ? ui.connecting : ui.connect}
            </Button>
          </form>
          {note("connect")}
          {s?.tokenTail && (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3" data-element-github-state>
              {s.login && row(ui.account, s.login)}
              {row(ui.keyTail, `…${s.tokenTail}`)}
              {row(ui.expires, s.expires ?? ui.noExpiry)}
              <Button type="button" variant="ghost" size="sm" className="mt-1 w-fit" onClick={forget}>{ui.forget}</Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-element-github-import>
          <H4 variant="ui">{ui.importTitle}</H4>
          <p className="text-sm text-muted-foreground">{ui.importIntro}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`gh-import-repo-${id}`}>{ui.importRepo}</Label>
            <Input id={`gh-import-repo-${id}`} value={importRepo} onChange={(e) => setImportRepo(e.target.value)} placeholder="owner/name" autoComplete="off" spellCheck={false} className="font-mono" />
          </div>
          {active}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor={`gh-import-token-${id}`}>{ui.importToken}</Label>
              <Help text={ui.importTokenHelp} />
            </div>
            <Input id={`gh-import-token-${id}`} type="password" value={importToken} onChange={(e) => setImportToken(e.target.value)} placeholder={ui.tokenPlaceholder} autoComplete="off" spellCheck={false} className="font-mono" />
          </div>
          {importAsk ? (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3" role="alert">
              <p className="text-sm">{ui.importConfirm.replace("{repo}", importRepo).replace("{previous}", s?.repo ?? "—")}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={() => void startImport()} data-element-github-import-yes>{ui.importYes}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setImportAsk(false)}>{ui.importCancel}</Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-fit" disabled={!importRepo.trim() || busy !== null} onClick={() => setImportAsk(true)}>{ui.importButton}</Button>
          )}
          {imp && imp.state !== "none" && (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status" data-element-github-import-state={importKey}>
              <span>{(ui.importState[importKey] ?? imp.state).replace("{previous}", imp.previous ?? "").replace("{reason}", imp.reason ?? "").replaceAll("{target}", imp.target ?? "")}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => { void loadImport(); void load() }}>{ui.importRefresh}</Button>
            </div>
          )}
          {note("import")}
        </section>

      </div>
    </TooltipProvider>
  )
}
