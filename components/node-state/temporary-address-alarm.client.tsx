"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Siren } from "lucide-react"
import type { TemporaryAddressAlarmWords } from "./temporary-address-alarm.i18n"
import { isTemporaryHostname } from "@/lib/auth/temporary-address"
import { OpenOnThisComputerButton } from "./open-on-this-computer.client"
import { useSnooze } from "./snooze"

// ТРЕВОЖНАЯ ПОЛОСА «ПРОЕКТ В ИНТЕРНЕТЕ ПО ВРЕМЕННОМУ АДРЕСУ» НАД СЛОЕМ АРХИТЕКТОРА (шаг 371-1).
//
// 🔒 РЕШЕНИЕ ВЛАДЕЛЬЦА 2026-10-02, дословно: «Пусть на старте пользователь попадает в панель открытые с адресом порт и без
// авторизации обязательно подсвечивать тревожное окно: Ваш проект доступен в интернете по временному адресу … однако этот
// домен может быть изменён в любое время. Рекомендуется подключить собственный домен прежде чем начинать использовать
// авторизацию». Первый запуск сам открывает быстрый туннель (371-1), поэтому полоса видна с первой минуты.
//
// 🔒 НЕ СВОРАЧИВАЕТСЯ — в отличие от `OwnerBand`: это тревога, а не справка. Видна и с этой машины, и по временному адресу.
// Источник — дверь `/api/domain/state` (адрес быстрого туннеля из `logs/tunnel.json`, свой домен из `logs/domain.json`):
// один запрос при открытии, таймеров нет. Свой домен подключён или туннеля нет — полосы нет.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function TemporaryAddressAlarm({ words, lang }: { words: TemporaryAddressAlarmWords; lang: string }) {
  const [url, setUrl] = useState<string | null>(null)
  // 391: «Больше не показывать» — на этом компьютере на сутки (localStorage); владелец 2026-10-04 снял «не сворачивается» 371-1.
  const { hidden, snooze } = useSnooze("temporary-address-alarm")

  useEffect(() => {
    fetch(`${BASE}/api/domain/state`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quickTunnel?: string | null; hostname?: string | null } | null) =>
        setUrl(d && !d.hostname && typeof d.quickTunnel === "string" ? d.quickTunnel : null),
      )
      .catch(() => setUrl(null))
  }, [])

  if (!url || hidden) return null
  const onTemporary = isTemporaryHostname(window.location.hostname)
  return (
    <div
      className="mx-4 mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-foreground"
      role="alert"
      data-temporary-address={url}
    >
      <Siren className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <p>
          <span className="font-medium">{words.lead}</span>{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all underline">
            {url}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </p>
        <p>{words.warning}</p>
        {/* 372: на временном адресе пульт только на чтение (proxy Job −1б) — выход со ЛЮБОЙ страницы, а не заплатка каждого
            экрана отказа (ключи GitHub, вход Google/Resend, домен …). На самой машине кнопки нет — там всё работает. */}
        {onTemporary && <p>{words.readOnly}</p>}
      </div>
      <div className="flex flex-col items-start gap-2 self-center">
        <OpenOnThisComputerButton open={words.openHere} />
        <a href={`${BASE}/${lang}/hosting/domain`} className="font-medium underline">
          {words.connect}
        </a>
        <button type="button" onClick={snooze} title={words.hideTitle} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-temporary-address-hide>
          {words.hide}
        </button>
      </div>
    </div>
  )
}
