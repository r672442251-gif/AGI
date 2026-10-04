"use client"

import { useCallback, useEffect, useState } from "react"

// «БОЛЬШЕ НЕ ПОКАЗЫВАТЬ» ДЛЯ ТРЕВОЖНЫХ КАРТОЧЕК — НА ЭТОМ КОМПЬЮТЕРЕ И НА СУТКИ (шаг 391). Владелец 2026-10-04: «добавить
// кнопку больше не показывать. Нажатие на эту кнопку скрывает отображение этих карточек но только на этом компьютере и на один
// день при помощи Locale хранилище браузера». Хранится срок в `localStorage` (`fractera:snooze:<имя>`); хранилище недоступно
// (приватное окно, запрет) — карточка просто видна, как раньше. Причину тревоги это не убирает: через сутки карточка вернётся.

const DAY_MS = 24 * 60 * 60 * 1000
const keyOf = (name: string) => `fractera:snooze:${name}`

export function useSnooze(name: string): { hidden: boolean; snooze: () => void } {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(keyOf(name)) ?? 0)
      setHidden(until > Date.now())
    } catch { /* без хранилища — карточка видна */ }
  }, [name])
  const snooze = useCallback(() => {
    try { window.localStorage.setItem(keyOf(name), String(Date.now() + DAY_MS)) } catch { /* не запомнится — скрыта до перехода */ }
    setHidden(true)
  }, [name])
  return { hidden, snooze }
}
