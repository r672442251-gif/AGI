"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ElementSettingsUi } from "../_i18n/element-settings.i18n"

// «АДРЕС ЭЛЕМЕНТА» (325-3). Поле нового имени, проверка свободы на лету (дверь `address`, GET) с вариантами, если занято;
// «Переименовать» — POST, затем полный переход на ту же страницу по новому адресу. id не меняется; адрес в интернете
// (поддомен) прежний — сказано под полем (решение владельца «Только ядро»).

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

type Check = { ok: boolean; reason?: "bad-shape" | "taken"; suggestions?: string[] }
type RepoRename = { state: "none" | "kept" | "renamed" | "failed"; from?: string; to?: string; reason?: string }
// 384-4: итог переименования репозитория переживает переход на новый адрес страницы — в sessionStorage этой вкладки (удобство
// одного зрителя; нет хранилища — строки просто нет, переименование от этого не зависит).
const repoKey = (id: string) => `fractera:repo-rename:${id}`

export function ElementAddress({ id, lang, ui, current, internet }: {
  id: string
  lang: string
  ui: ElementSettingsUi
  current: string
  internet: string
}) {
  const w = ui.addressCard
  const [name, setName] = useState("")
  const [check, setCheck] = useState<Check | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = name.trim().toLowerCase()
  const same = value === current
  const [repoDone, setRepoDone] = useState<RepoRename | null>(null)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(repoKey(id))
      if (raw) { setRepoDone(JSON.parse(raw) as RepoRename); sessionStorage.removeItem(repoKey(id)) }
    } catch { /* без хранилища — без строки */ }
  }, [id])

  useEffect(() => {
    setCheck(null)
    if (!value || same) return
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${BASE}/api/architect/items/${id}/address?name=${encodeURIComponent(value)}`, { cache: "no-store" })
        if (r.ok) setCheck((await r.json()) as Check)
      } catch { /* без проверки кнопка всё равно сверит на двери */ }
    }, 350)
    return () => clearTimeout(t)
  }, [value, same, id])

  async function rename() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`${BASE}/api/architect/items/${id}/address`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: value }),
      })
      const d = (await r.json().catch(() => null)) as (Check & { address?: string; repo?: RepoRename }) | null
      if (d?.ok && d.address) {
        if (d.repo && (d.repo.state === "renamed" || d.repo.state === "failed")) {
          try { sessionStorage.setItem(repoKey(id), JSON.stringify(d.repo)) } catch { /* без хранилища */ }
        }
        window.location.assign(`${BASE}/${lang}/architect/${d.address}/settings/danger-zone`)
        return
      }
      setCheck(d)
      setError(d?.reason ? w[d.reason] : `${w.failed} ${r.status}`)
    } catch {
      setError(w.failed)
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2" data-element-address={current}>
      <p className="text-sm text-foreground">
        {w.current} <span className="font-mono">/{lang}/{current}</span>
      </p>
      <Label htmlFor={`element-address-${id}`}>{w.label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`element-address-${id}`}
          className="max-w-60 font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={current}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="button" size="sm" onClick={rename} disabled={!value || same || busy || check?.ok === false} data-address-rename>
          {busy ? w.renaming : ui.address.action}
        </Button>
      </div>
      {check?.ok === true && <p className="text-sm text-foreground" data-address-free>{w.free}</p>}
      {/* 2026-10-01 (владелец, после 502 на roman-3): переезд папки останавливает элемент — около минуты адрес не отвечает. */}
      {(check?.ok === true || busy) && (
        <p className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-foreground" role="status" data-address-restart>{w.restart}</p>
      )}
      {check?.ok === true && <p className="text-sm text-muted-foreground" data-address-repo-note>{w.repoNote}</p>}
      {repoDone?.state === "renamed" && (
        <p className="rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm text-foreground" role="status" data-address-repo="renamed">
          {w.repoRenamed.replace("{from}", repoDone.from ?? "").replace("{to}", repoDone.to ?? "")}
        </p>
      )}
      {repoDone?.state === "failed" && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-foreground" role="alert" data-address-repo="failed">
          {w.repoFailed.replace("{from}", repoDone.from ?? "").replace("{reason}", repoDone.reason ?? "")}
        </p>
      )}
      {check?.ok === false && check.reason && (
        <div className="flex flex-col gap-1.5" data-address-taken={check.reason}>
          <p className="text-sm text-destructive">{w[check.reason]}</p>
          {check.suggestions && check.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[length:var(--fs-small)] text-muted-foreground">{w.suggest}</span>
              {check.suggestions.map((s) => (
                <Button key={s} type="button" variant="outline" size="sm" className="font-mono" onClick={() => setName(s)}>{s}</Button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && !check?.reason && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <p className="text-[length:var(--fs-small)] text-muted-foreground">{w.note.replace("{id}", id).replace("{internet}", internet)}</p>
    </div>
  )
}
