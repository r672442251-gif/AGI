"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppDialog } from "@/components/dialog/app-dialog.client"
import type { AppDialogUi } from "@/components/dialog/app-dialog.i18n"
import type { AgiDraftsUi } from "../_i18n/agi-drafts.i18n"
import { announceGithubState } from "@/components/node-state/github-token-alarm.client"

// «РОДИТЬ ЭЛЕМЕНТ» (узел, шаг 319-3; 367 — вопрос об облике). Кнопка → окно подтверждения (что произойдёт, сколько займёт и
// каким родится элемент: «как весь проект» / «самостоятельный») → дверь
// `POST /api/architect/drafts/<id>/birth` запускает рождение отдельным процессом → экран хода по журналу.
//
// 🔒 ОПРОС ДВЕРИ — ТОЛЬКО ПОКА ЭТОТ ЭКРАН ОТКРЫТ И РОЖДЕНИЕ ИДЁТ (план 319-3, подтверждён владельцем): начинается нажатием
// или тем, что человек открыл страницу идущего рождения; закончилось рождение или закрыта вкладка — опроса нет. Процесс
// рождения от этого не зависит: закрытая вкладка его не останавливает.
// По окончании — `router.refresh()`: страница перерисовывается уже как страница элемента (значок, порт, Preview).

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const EVERY_MS = 2000
// Та же форма, что у двери (`isRepoUrl` в lib/agi-items/birth.ts): окно подсказывает, решает дверь.
const REPO_URL = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?\/?$/

type State = { state: "idle" | "running" | "done" | "failed"; lines: string[]; reason?: string; port?: number }

// `born` — элемент уже в реестре узла (рождение дошло до записи и упало позже): кнопки нет, подсказка — повтор установки.
// Иначе упавшее рождение ничего не записало, и подсказка — нажать кнопку снова.
export function BirthButton({ id, ui, dialogUi, born = false }: { id: string; ui: AgiDraftsUi; dialogUi: AppDialogUi; born?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  // 367-5: отказ двери с объяснением (например, «это не ваш репозиторий — сделайте Fork») — в окне, окно не закрывается.
  const [refusal, setRefusal] = useState<string | null>(null)
  // 367 (слово владельца 2026-10-01): облик элемента выбирает человек — «как весь проект» или «самостоятельный»; без выбора не рождаем.
  const [look, setLook] = useState<"project" | "own" | "">("")
  // 367-3: у самостоятельного — источник кода: стартер Fractera или репозиторий человека (адрес проверяет и дверь).
  const [source, setSource] = useState<"starter" | "repo" | "">("")
  const [repo, setRepo] = useState("")
  const repoOk = REPO_URL.test(repo.trim())
  const ready = look === "project" || (look === "own" && (source === "starter" || (source === "repo" && repoOk)))

  /** Карточка-вариант: shadcn Button с role=radio; выбранная — с рамкой основного цвета. */
  const option = (value: string, title: string, text: string, checked: boolean, pick: () => void, mark: string) => (
    <Button
      key={value}
      type="button"
      variant="outline"
      role="radio"
      aria-checked={checked}
      onClick={pick}
      disabled={starting}
      className={`h-auto w-full flex-col items-start gap-1 whitespace-normal p-3 text-left ${checked ? "border-primary ring-2 ring-primary/40" : ""}`}
      {...{ [mark]: value }}
    >
      <span className="font-semibold text-foreground">{title}</span>
      <span className="text-xs font-normal text-muted-foreground">{text}</span>
    </Button>
  )
  const [s, setS] = useState<State>({ state: "idle", lines: [] })
  const timer = useRef<number | null>(null)

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/architect/drafts/${id}/birth`, { cache: "no-store" })
      if (!r.ok) return
      const next = (await r.json()) as State
      setS(next)
      if (next.state === "running") timer.current = window.setTimeout(poll, EVERY_MS)
      else if (next.state === "done") { router.refresh(); announceGithubState() }
    } catch {
      timer.current = window.setTimeout(poll, EVERY_MS)
    }
  }, [id, router])

  // Страница открыта во время идущего рождения — показать, где оно (один запрос; дальше — только если идёт).
  useEffect(() => {
    poll()
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [poll])

  async function start() {
    setStarting(true)
    try {
      const r = await fetch(`${BASE}/api/architect/drafts/${id}/birth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(look === "own" ? { look, source, ...(source === "repo" ? { repo: repo.trim() } : {}) } : { look }),
      })
      if (r.status === 400) {
        const j = (await r.json().catch(() => null)) as { message?: string } | null
        if (j?.message) { setRefusal(j.message); return }
      }
      setOpen(false)
      if (r.ok || r.status === 409) await poll()
      else setS({ state: "failed", lines: [], reason: String(r.status) })
    } finally {
      setStarting(false)
    }
  }

  const running = s.state === "running"
  const failed = s.state === "failed"

  return (
    <div className="my-4 flex flex-col gap-3" data-birth data-birth-state={s.state}>
      {!born && !running && s.state !== "done" && (
        <Button onClick={() => { setLook(""); setSource(""); setRepo(""); setRefusal(null); setOpen(true) }} className="w-fit gap-1.5" data-birth-start>
          <Sprout className="size-4" aria-hidden />
          {ui.birth}
        </Button>
      )}
      {(running || failed || s.state === "done") && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3" role="status">
          <p className={`text-sm font-medium ${failed ? "text-destructive" : "text-foreground"}`}>
            {running ? ui.birthRunning : failed ? ui.birthFailed : ui.birthDone}
            {failed && s.reason ? ` ${s.reason === "interrupted" ? ui.birthInterrupted : s.reason}` : ""}
          </p>
          {s.lines.length > 0 && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground" data-birth-lines>
              {s.lines.join("\n")}
            </pre>
          )}
          {failed && (born
            ? <p className="text-sm text-muted-foreground">{ui.birthRepeat} <code className="font-mono">{id}</code></p>
            : <p className="text-sm text-muted-foreground">{ui.birthRetry}</p>)}
        </div>
      )}
      <AppDialog
        open={open}
        onOpenChange={(v) => !starting && setOpen(v)}
        title={ui.birthTitle}
        description={ui.birthText}
        ui={dialogUi}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={starting}>{ui.cancel}</Button>
            <Button onClick={start} disabled={starting || !ready} data-birth-confirm>{starting ? ui.birthStarting : ui.birthConfirm}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={ui.lookQuestion} data-birth-look>
          <p className="text-sm font-medium text-foreground">{ui.lookQuestion}</p>
          {option("project", ui.lookProject, ui.lookProjectText, look === "project", () => setLook("project"), "data-birth-look-option")}
          {option("own", ui.lookOwn, ui.lookOwnText, look === "own", () => setLook("own"), "data-birth-look-option")}
          {/* 367-3 (владелец: «нажатие на вторую карточку … увеличит её в длину и покажет два варианта»): откуда код самостоятельного. */}
          {look === "own" && (
            <div className="ml-4 flex flex-col gap-2 border-l-2 border-primary/40 pl-3" role="radiogroup" aria-label={ui.sourcePick} data-birth-source>
              {option("starter", ui.sourceStarter, ui.sourceStarterText, source === "starter", () => setSource("starter"), "data-birth-source-option")}
              {option("repo", ui.sourceRepo, ui.sourceRepoText, source === "repo", () => setSource("repo"), "data-birth-source-option")}
              {source === "repo" && (
                <div className="flex flex-col gap-1.5">
                  <Input
                    value={repo}
                    onChange={(e) => { setRepo(e.target.value); setRefusal(null) }}
                    placeholder={ui.repoPlaceholder}
                    aria-label={ui.sourceRepo}
                    className="font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={starting}
                    data-birth-repo
                  />
                  {repo.trim() !== "" && !repoOk && <p className="text-xs text-destructive" data-birth-repo-bad>{ui.repoBad}</p>}
                  <p className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-foreground" data-birth-repo-warning>{ui.repoWarning}</p>
                </div>
              )}
              {!source && <p className="text-xs text-muted-foreground">{ui.sourcePick}</p>}
            </div>
          )}
          {!look && <p className="text-xs text-muted-foreground">{ui.lookPick}</p>}
          {refusal && <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground" role="alert" data-birth-refusal>{refusal}</p>}
        </div>
      </AppDialog>
    </div>
  )
}
