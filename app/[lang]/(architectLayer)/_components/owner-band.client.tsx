'use client'

import { useEffect, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { isTemporaryHostname } from '@/lib/auth/temporary-address'
import { isLoopbackHostname } from '@/lib/auth/owner-at-machine'
import { isShowcaseHostname } from '@/lib/showcase'

// ПРЕДУПРЕЖДЕНИЕ СЛОЯ: «ВЫ ЗДЕСЬ БЕЗ АВТОРИЗАЦИИ, И ЭТО ВРЕМЕННОЕ СОСТОЯНИЕ».
//
// 🔒 РЕШЕНИЕ ВЛАДЕЛЬЦА 2026-09-19, дословно: «разрабатывать архитектуру если
// пользователь собирается оставить проект без авторизации можно только в режиме
// разработки или в режиме временного домена. Обе сценария являются нежелательными
// и временными, тогда как для полноценного использования рекомендуется
// активировать микросервис авторизации Fractera… это важное предупреждение
// верхней части страницы его можно было бы скрыть в аккордеон тип Warning… if it
// is devmode or temp domain flow, in normal flow accordion not need».
//
// 🪦 ПРЕЖДЕ ЗДЕСЬ БЫЛА ПОЛОСА В ОДНУ СТРОКУ, показывавшаяся только хозяину за
// клавиатурой и спрашивавшая о нём `/api/me`. Отменено тем же решением: полоса
// молчала ровно там, где предупреждение нужнее всего, — на временном адресе в
// интернете, куда человек приходит из чужой сети.
//
// 🔒 СВЁРНУТО ПО УМОЛЧАНИЮ — ЭТО И ЕСТЬ ПРОСЬБА «СКРЫТЬ В АККОРДЕОН». Человек
// видит одну строку и раскрывает её, когда готов читать. Развёрнутое
// предупреждение на каждой из одиннадцати страниц перестаёт читаться на третьей.
//
// 🔒 РЕЖИМ ОПРЕДЕЛЯЕТ БРАУЗЕР, А НЕ СЕРВЕР, И ЭТО НЕ ЛЕНЬ. Страницы слоя
// статические; спросить на сервере «кто пришёл» значит одной строкой (`headers()`)
// увести в динамику весь слой — запрещено каноном статики. Островок смотрит на имя
// хоста уже в браузере, поэтому страница остаётся предрендеренной.
//
// 🛑 ЧЕГО ЭТОТ ПРИЗНАК НЕ ВИДИТ, НАЗВАНО ВСЛУХ: режим разработки, поднятый на
// собственном домене. Тогда предупреждение не покажется, хотя замок снят. Сам замок
// при этом на месте — он в `proxy.ts` и от этой строки не зависит: островок ничего
// не охраняет, он объясняет.
//
// 🛑 И ГЛАВНОЕ: ОН НЕ ЗАЩИТА. Кого пускать, решают ворота на сервере. Предупреждение
// в браузере, пытающееся «на всякий случай» что-то закрыть, дало бы ложное чувство
// защиты там, где защиты по природе нет.

type Mode = 'machine' | 'temporary' | 'showcase' | null

// 🔒 ПРИЗНАКИ БЕРУТСЯ ИЗ ТЕХ ЖЕ ФАЙЛОВ, ЧТО ЧИТАЕТ СЕРВЕР (2026-09-19). Здесь
// лежала третья рукописная копия того же знания — список имён петли и суффикс
// туннеля строкой. Копии расходятся молча, и расхождение выглядит не поломкой, а
// неверным объяснением на экране: предупреждение либо молчит там, где замок снят,
// либо пугает там, где он на месте.
function detectMode(): Mode {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (isLoopbackHostname(host)) return 'machine'
  if (isTemporaryHostname(host)) return 'temporary'
  // 🔒 ВИТРИНА — ПОСЛЕДНЕЙ И НАМЕРЕННО (256-2). Порядок здесь имеет смысл: узел
  // самой Fractera можно открыть и с его машины, и через туннель, и по домену.
  // Первые два ответа точнее — они говорят человеку, ПОЧЕМУ открыто именно у него
  // сейчас; витринный текст адресован тому, кто пришёл снаружи по постоянному
  // адресу, и только для него он верен.
  if (isShowcaseHostname(host)) return 'showcase'
  return null
}

export function OwnerBand({
  title,
  reasonMachine,
  reasonTemporary,
  reasonShowcase,
  body,
  titleMachine,
  bodyMachine,
  titleTemporary,
  bodyTemporary,
}: {
  title: string
  reasonMachine: string
  titleMachine: string
  bodyMachine: string
  titleTemporary: string
  bodyTemporary: string
  reasonTemporary: string
  reasonShowcase: string
  body: string
}) {
  const [mode, setMode] = useState<Mode>(null)

  // Определяется после гидратации: при серверном рендере адреса браузера нет, и
  // выдуманное умолчание показало бы предупреждение тому, кому оно не адресовано.
  useEffect(() => setMode(detectMode()), [])

  if (!mode) return null
  // 387-3: на этом компьютере — свой заголовок и вывод с настоящим адресом страницы, без «состояние временное».
  const host = typeof window === 'undefined' ? '' : window.location.host
  const machine = mode === 'machine'

  return (
    <Accordion type="single" collapsible className="mb-4">
      <AccordionItem
        value="auth-warning"
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3"
      >
        <AccordionTrigger className="py-2 text-[length:var(--fs-small)] text-amber-900 hover:no-underline dark:text-amber-200">
          <span>
            <span aria-hidden="true">⚠ </span>
            {machine ? titleMachine.replace('{host}', host) : mode === 'temporary' ? titleTemporary : title}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3 text-[length:var(--fs-small)] text-amber-900 dark:text-amber-200">
          <p className="mb-2">
            {machine ? reasonMachine.replace('{host}', host) : mode === 'showcase' ? reasonShowcase : reasonTemporary}
          </p>
          {/* 🔒 ВЫВОД О МИКРОСЕРВИСЕ АВТОРИЗАЦИИ АДРЕСОВАН ХОЗЯИНУ УЗЛА, А НЕ
              ПРОХОЖЕМУ. На витрине его нет: человеку, пришедшему из поиска,
              незачем советовать, что активировать в чужом узле. */}
          {mode !== 'showcase' && <p>{machine ? bodyMachine : mode === 'temporary' ? bodyTemporary : body}</p>}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
