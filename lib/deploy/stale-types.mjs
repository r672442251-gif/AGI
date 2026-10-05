// СТАРЫЕ ТИПЫ СОСЕДНЕЙ СБОРКИ НЕ ДОЛЖНЫ ЛОМАТЬ НОВУЮ (шаг 402, 2026-10-05).
//
// ✗ Измерено на roman: маршрут `account/[slug]` переименован в `[...slug]`, и «Развернуть» упало на проверке типов —
// `.next-a/types/validator.ts` работающей сборки всё ещё импортировал `account/[slug]/page.js`. Механизм: элемент со сборкой
// без простоя собирается попеременно в `.next-a` / `.next-b` (280-9), а Next сам вписывает типы ОБЕИХ папок в
// `tsconfig.json`; новая сборка проверяет и сгенерированные типы старой. Любое переименование или удаление маршрута в любом
// элементе ломало следующее «Развернуть» и «Предпросмотр».
// Лечение: перед сборкой удалить `types` и `dev/types` во всех папках `.next*`, кроме целевой. Работающий сервер их не читает —
// это вход только для проверки типов; его пересоздаёт следующая сборка в этой папке.

import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Удалить сгенерированные типы всех папок сборки элемента `dir`, кроме `target`. */
export function dropStaleTypes(dir, target) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('.next') || e.name === target) continue
    for (const sub of ['types', join('dev', 'types')]) {
      try { rmSync(join(dir, e.name, sub), { recursive: true, force: true }) } catch { /* занято — сборка скажет сама */ }
    }
  }
}
