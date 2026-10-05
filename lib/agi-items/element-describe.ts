import "server-only"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import paths from "@/lib/agi-items/paths.cjs"

// ОПИСАНИЕ ВОЗМОЖНОСТЕЙ AGI ЭЛЕМЕНТА → ЗАПИСЬ В ЯДРЕ (325-2). Решение владельца 2026-09-27: описание пишет «Агент элемента».
//
// 🔒 ПИШЕТ АГЕНТ, ЗАБИРАЕТ ЧЕЛОВЕК. Агент элемента (Claude Code в его папке) по заданию из терминала пишет в паспорт
// `OWN-SERVICE-PROPS.json` поля `summary` и `provides`; кнопка «Забрать в ядро» зовёт `takeDescription`, и только она меняет
// запись реестра. Само ядро паспорт не читает и реестр не трогает — таймеров и слежки за файлом нет.
// 🔒 ФОРМА ПРОВЕРЯЕТСЯ ДО ЗАПИСИ: пустой `provides`, шаблонный или рождённый (325-1) `summary` — отказ словом, реестр не
// тронут. Так в ядро не попадает описание, которого агент не писал.
// 🔒 В РЕЕСТРЕ ОПИСАНИЕ ЗАМЕНЯЕТ `provides` РОЖДЕНИЯ (`element-site`) и получает `described` — когда и с какого коммита
// элемента взято. Реестр — рабочий файл узла (как у рождения и удаления), в git ядра записи рождённых не попадают.

// 329 (слово владельца 2026-09-28): «есть собственное описание и есть общий файл в ядре, который тоже должен быть обновлён …
// процедура должна проходить через Claude Code, который вызывает навык внутри AGI ITEM; навык ещё не разработан». Задание
// называет будущий навык `describe-element` (есть — агент следует ему) и кончается командой элемента `npm run describe:publish`:
// она отдаёт паспорт в ядро той же дверью, что и кнопка «Забрать в ядро» (кнопка остаётся запасной).
export const TASK = [
  "Describe this AGI element for the node's core.",
  "If the skill describe-element exists in .claude/skills of this folder, follow it; otherwise do the steps below.",
  "Read the code of this folder (pages, API routes, lib) and find out what the element does for a person.",
  "Then edit only two fields of OWN-SERVICE-PROPS.json in this folder:",
  "- \"summary\": 2-3 plain sentences: what the element does and for whom. No step numbers, no words about templates.",
  "- \"provides\": 1-20 short names of its capabilities, lowercase words joined by hyphens (for example \"order-form\", \"price-list\").",
  "Change nothing else in the file or in the folder. Commit this one file with the message \"describe: summary and provides\".",
  "Then run: npm run describe:publish — it hands the description to the node's core registry. If it prints DESCRIBE_FAILED, fix what it names and run it again.",
  "Finish by printing the two fields and the line the command printed.",
].join("\n")

const TEMPLATE_SUMMARY = /^The template of a node element/i
const BIRTH_SUMMARY = /^AGI element \S+, born from /i
const CAPABILITY = /^[a-z0-9][a-z0-9-]{1,47}$/
// 333-3: НАВЫК ДИЗАЙНА ЭЛЕМЕНТА — короткое имя (`impeccable`, `design-taste-frontend`, `blocks`). Слово владельца: «в коллекции
// собственной информации о себе мы теперь всегда передаем название навыка дизайна … глобальный реестр … должен получать этот
// навык». Поле необязательное; имя вне библиотеки `AGI-ITEMS-REGISTRY/design-skills.json` — не ошибка (элемент мог прийти извне),
// проверяется только форма.
const DESIGN_SKILL = /^[a-z0-9][a-z0-9-]{0,39}$/

export type Description = { summary: string; provides: string[]; at: string; commit: string | null }
export type TakeError = "passport-unreadable" | "summary-missing" | "summary-not-written" | "provides-missing" | "provides-bad-shape" | "design-skill-bad-shape" | "registry-failed"

type Entry = { id: string; kind?: string; born?: unknown; summary?: string; provides?: string[]; designSkill?: string; described?: { at: string; commit: string | null } }
type Registry = { services: Entry[] }

const readRegistry = (): Registry => JSON.parse(readFileSync(paths.REGISTRY_FILE, "utf8")) as Registry

/** Описание, уже забранное в ядро (`null` — ещё не забиралось: `provides` рождения описанием не считается). */
export function registryDescription(id: string): Description | null {
  try {
    const e = readRegistry().services.find((s) => s.id === id)
    if (!e?.described || typeof e.summary !== "string") return null
    return { summary: e.summary, provides: e.provides ?? [], at: e.described.at, commit: e.described.commit }
  } catch { return null }
}

/** Прочитать паспорт элемента и проверить форму описания. */
export function passportDescription(id: string): { ok: true; summary: string; provides: string[]; designSkill?: string } | { ok: false; error: TakeError } {
  let props: { summary?: unknown; provides?: unknown; designSkill?: unknown }
  try {
    props = JSON.parse(readFileSync(join(paths.itemDir(id, "user"), "OWN-SERVICE-PROPS.json"), "utf8"))
  } catch { return { ok: false, error: "passport-unreadable" } }
  const summary = typeof props.summary === "string" ? props.summary.trim() : ""
  if (summary.length < 20) return { ok: false, error: "summary-missing" }
  if (TEMPLATE_SUMMARY.test(summary) || BIRTH_SUMMARY.test(summary)) return { ok: false, error: "summary-not-written" }
  if (!Array.isArray(props.provides) || props.provides.length === 0) return { ok: false, error: "provides-missing" }
  const provides = props.provides.map((p) => (typeof p === "string" ? p.trim() : ""))
  if (provides.length > 20 || provides.some((p) => !CAPABILITY.test(p)) || new Set(provides).size !== provides.length) {
    return { ok: false, error: "provides-bad-shape" }
  }
  let designSkill: string | undefined
  if (props.designSkill !== undefined) {
    designSkill = typeof props.designSkill === "string" ? props.designSkill.trim() : ""
    if (!DESIGN_SKILL.test(designSkill)) return { ok: false, error: "design-skill-bad-shape" }
  }
  return { ok: true, summary: summary.slice(0, 800), provides, designSkill }
}

/** «Забрать в ядро»: паспорт → запись реестра. Отказ — реестр не тронут. */
export function takeDescription(id: string): { ok: true; description: Description } | { ok: false; error: TakeError } {
  const read = passportDescription(id)
  if (!read.ok) return read
  const head = spawnSync("git", ["-C", paths.itemDir(id, "user"), "rev-parse", "--short", "HEAD"], { encoding: "utf8", windowsHide: true, timeout: 10_000 })
  const commit = head.status === 0 ? head.stdout.trim() || null : null
  const at = new Date().toISOString()
  try {
    const reg = readRegistry()
    const e = reg.services.find((s) => s.id === id)
    if (!e) return { ok: false, error: "registry-failed" }
    e.summary = read.summary
    e.provides = read.provides
    if (read.designSkill) e.designSkill = read.designSkill
    e.described = { at, commit }
    writeFileSync(paths.REGISTRY_FILE, JSON.stringify(reg, null, 2) + "\n", "utf8")
  } catch { return { ok: false, error: "registry-failed" } }
  return { ok: true, description: { summary: read.summary, provides: read.provides, at, commit } }
}
