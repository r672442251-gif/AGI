import "server-only"
import { randomBytes } from "node:crypto"
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from "node:fs"
import { join, dirname } from "node:path"
import { addressOf } from "@/lib/agi-items/address-file.mjs"

// ЧЕРНОВИКИ ЭЛЕМЕНТОВ УЗЛА (шаг 314-1, слово владельца 2026-09-26: «кнопку создать новый микро servis который генерирует
// новую группу страниц на вкладке архитектора … название этого микро сервиса будет CUID.<domain> эти страницы сразу должны
// появиться … без нового развёртывания»).
//
// 🔒 ЧЕРНОВИК — НЕ ЗАПИСЬ РЕЕСТРА. `AGI-ITEMS-REGISTRY/agi-items.json` читает установщик, и запись без репозитория он пытался
// бы ставить. Черновик живёт в данных ядра (`data/` целиком вне git): у него нет ни порта, ни поддомена, ни процесса — только
// имя и группа страниц архитектора. Порт и поддомен — следующий разговор (слово владельца: «порт пока не выделяй»,
// «мы ещё не генерировали сам субдомен»).
//
// 🔒 ЗАПИСЬ АТОМАРНА (временный файл + rename): читатель никогда не видит полузаписанный файл.
// 🔒 «НЕТ ФАЙЛА» — законный пустой список; файл есть, но не читается — тоже пусто для меню, но запись в такой файл
// отказывает, а не затирает его пустотой.

export type AgiDraft = { id: string; createdAt: string }

const FILE = join(process.cwd(), "data", "agi-drafts.json")

// 🔒 ИМЯ — ПЯТЬ ЗНАКОВ (слово владельца 2026-09-26 о 24-значном: «very long, no? may be 5 chars no?»): строчная буква и
// четыре знака base36 — около 43 млн имён, на узле их единицы. Годится и для поддомена, и для имени службы моста.
// 🛑 КОРОТКОЕ ИМЯ МОЖЕТ СОВПАСТЬ С ЗАНЯТЫМ, И ТОГДА ЧЕРНОВИК НЕВИДИМ: папка раздела с точным именем (`architect/build`)
// перекрывает динамический маршрут. Поэтому имя сверяется с реестром служб, разделами слоя, служебными поддоменами и
// черновиками. Прежние 24-значные имена (первые часы 314-1) читаются по-прежнему.
const ID_LENGTH = 5
// 325-7: ОДИН список на черновики и адреса элементов (`element-address.ts`) — имена, занятые узлом как поддомены и разделы.
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "auth", "blocks", "build", "config", "data", "design", "hosting", "kits", "passport", "root",
  "admin", "architect", "api", "www", "mail", "memory", "telegram", "store", "items",
])

function registryIds(): string[] {
  try {
    const r = JSON.parse(readFileSync(join(process.cwd(), "AGI-ITEMS-REGISTRY", "agi-items.json"), "utf8")) as { services?: { id?: unknown }[] }
    return (r.services ?? []).map((s) => s.id).filter((x): x is string => typeof x === "string")
  } catch {
    return []
  }
}

function randomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(ID_LENGTH)
  let id = alphabet[bytes[0] % 26]
  for (let i = 1; i < ID_LENGTH; i++) id += alphabet[bytes[i] % 36]
  return id
}

/** Свободное имя: не занято реестром, разделом, служебным поддоменом или другим черновиком. */
export function newDraftId(taken: string[]): string {
  const busy = new Set([...RESERVED_NAMES, ...registryIds(), ...taken])
  for (let i = 0; i < 100; i++) {
    const id = randomId()
    if (!busy.has(id)) return id
  }
  throw new Error("no-free-id")
}

export const DRAFT_ID = /^[a-z][a-z0-9]{4,23}$/

type ReadResult = { ok: true; drafts: AgiDraft[] } | { ok: false }

function read(): ReadResult {
  if (!existsSync(FILE)) return { ok: true, drafts: [] }
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as { drafts?: unknown }
    const list = Array.isArray(raw.drafts) ? raw.drafts : []
    return {
      ok: true,
      drafts: list.filter((d): d is AgiDraft => typeof d?.id === "string" && DRAFT_ID.test(d.id) && typeof d?.createdAt === "string"),
    }
  } catch {
    return { ok: false }
  }
}

function write(drafts: AgiDraft[]): boolean {
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`
  try {
    mkdirSync(dirname(FILE), { recursive: true })
    writeFileSync(tmp, JSON.stringify({ drafts }, null, 2) + "\n", "utf8")
    renameSync(tmp, FILE)
    return true
  } catch {
    if (existsSync(tmp)) try { unlinkSync(tmp) } catch { /* уже нет */ }
    return false
  }
}

/** Черновики, НОВЫЕ СВЕРХУ (слово владельца 2026-10-01: «новые созданные записи создавать вверху то есть сделать обратную
 *  сортировку»; в меню roman стоял над только что созданным dhndy). Порядок — по `createdAt`, а не по месту в файле: файл
 *  дописывается в конец. Нечитаемый файл — пустой список для меню. */
export function listDrafts(): AgiDraft[] {
  const r = read()
  return r.ok ? [...r.drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
}

export function getDraft(id: string): AgiDraft | null {
  return DRAFT_ID.test(id) ? listDrafts().find((d) => d.id === id) ?? null : null
}

export function createDraft(): AgiDraft | null {
  const r = read()
  if (!r.ok) return null
  let id: string
  try { id = newDraftId(r.drafts.map((d) => d.id)) } catch { return null }
  const draft = { id, createdAt: new Date().toISOString() }
  return write([...r.drafts, draft]) ? draft : null
}

export function deleteDraft(id: string): boolean {
  const r = read()
  if (!r.ok || !r.drafts.some((d) => d.id === id)) return false
  return write(r.drafts.filter((d) => d.id !== id))
}

/** Зона домена узла (`logs/domain.json`). Нет домена — `null`, и адрес черновика называется без зоны. */
export function nodeZone(): string | null {
  try {
    const d = JSON.parse(readFileSync(join(process.cwd(), "logs", "domain.json"), "utf8")) as { zone?: unknown }
    return typeof d.zone === "string" && d.zone ? d.zone : null
  } catch {
    return null
  }
}

/** Адрес элемента в интернете (его же вводят для удаления): `<адрес>.<зона>`, без зоны — сам адрес. 325-8: по адресу, не по id. */
export function draftAddress(id: string): string {
  const zone = nodeZone()
  const name = addressOf(id)
  return zone ? `${name}.${zone}` : name
}
