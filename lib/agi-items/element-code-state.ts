import "server-only"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// ЧТО В ЭЛЕМЕНТЕ ЕЩЁ НЕ РАЗВЁРНУТО — ПО ФАКТАМ GIT (узел, шаг 337-2). ✗ 2026-09-29: агент roman переписал лендинг и не
// закоммитил, а «Развёртывания» ядра писали «актуален» — ожидание мерилось только временем файлов настроек.
//
// 🔒 ТРИ ФАКТА, ВСЕ ИЗМЕРЯЮТСЯ ПРИ ЗАПРОСЕ: последний коммит (`HEAD`), работающий коммит (хвост `+<hash>` версии в
// `.install-stamp.json`, его пишет установщик после сборки) и правки рабочего дерева, которые сделал человек или агент.
// 🔒 ФАЙЛЫ, КОТОРЫЕ ПИШЕТ САМ УЗЕЛ, — НЕ ПРАВКИ: конфиги, приходящие из CONFIG и «Дизайна», `tsconfig.json` и `next-env.d.ts`
// (их переписывает `next build`), отпечаток установки. Иначе каждый элемент вечно «ждал бы развёртывания».

export type ElementCodeState = {
  head: string | null
  running: string | null
  /** Пути правок рабочего дерева (до 20), без файлов, которые пишет сам узел. */
  changes: string[]
  changed: number
  /** Есть что развернуть: правки или последний коммит не тот, что работает. */
  pending: boolean
}

/** Файлы, которые пишет сам узел (377: тот же список читает выгрузка в GitHub — они не правки и не коммитятся). */
export const NODE_WRITES = [/^DESIGN-CONFIG\//, /^APP-CONFIG\//, /^PLATFORM-CONFIG\//, /(^|\/)tsconfig\.json$/, /(^|\/)next-env\.d\.ts$/, /^\.install-stamp\.json$/]

function git(dir: string, args: string[]): string | null {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true, timeout: 10_000 })
  return r.status === 0 ? r.stdout : null
}

export function elementCodeState(dir: string): ElementCodeState | null {
  const head = git(dir, ["rev-parse", "--short=7", "HEAD"])?.trim() || null
  if (!head) return null
  let running: string | null = null
  try {
    const v = String((JSON.parse(readFileSync(join(dir, ".install-stamp.json"), "utf8")) as { version?: string }).version ?? "")
    running = v.includes("+") ? v.split("+").pop()?.slice(0, 7) ?? null : null
  } catch { /* не установлен */ }
  const status = git(dir, ["status", "--porcelain", "--untracked-files=all"]) ?? ""
  const all = status.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, "").split(" -> ").pop() ?? "")
  const changes = all.filter((p) => p && !NODE_WRITES.some((re) => re.test(p)))
  return {
    head,
    running,
    changes: changes.slice(0, 20),
    changed: changes.length,
    pending: changes.length > 0 || (running !== null && !head.startsWith(running) && !running.startsWith(head)),
  }
}
