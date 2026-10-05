// ОФОРМЛЕНИЕ ЯДРА — ТО ЖЕ, ЧТО У САЙТА (шаг 285-1).
//
// Слово владельца 2026-09-24: «Ядро у меня имеет зелёную тему тёмную, корень у меня имеет голубую тему тёмную,
// презентационной страницы авторизации у меня имеет белую тему голубую. Что за калейдоскоп». Оформление —
// настройка САЙТА (закон направления потока, 280-6): «Дизайн» пишет его в сайт, вход и данные дверью
// `/api/settings/design`, а ядро читало свой отдельный файл и оставалось зелёным.
//
// 🔒 ПЕРЕД КАЖДОЙ СБОРКОЙ ЯДРО БЕРЁТ ОФОРМЛЕНИЕ У САЙТА и кладёт его в `DESIGN-CONFIG/design-config.json`.
// Файл ядра — производная копия, у неё один писатель (этот скрипт); руками его не править.
// 🛑 Сайт не ответил — файл остаётся прежним, и это ПЕЧАТАЕТСЯ: молчаливый откат уже стоил нам «калейдоскопа».
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = join(ROOT, 'DESIGN-CONFIG', 'design-config.json')

function key() {
  if (process.env.SETTINGS_SECRET?.trim()) return process.env.SETTINGS_SECRET.trim()
  try {
    const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^SETTINGS_SECRET=(.*)$/m)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

function sitePort() {
  try {
    const reg = JSON.parse(readFileSync(join(ROOT, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8'))
    const root = (reg.services ?? []).find((s) => s.id === 'root')
    return root && Number.isInteger(root.port) ? root.port : null
  } catch {
    return null
  }
}

const warn = (why) => {
  console.warn(`[sync-site-design] ${why} — ядро соберётся со своим прежним оформлением`)
  process.exit(0)
}

const port = sitePort()
const k = key()
if (!port) warn('сайта нет в реестре узла')
if (!k) warn('нет SETTINGS_SECRET')

let config = null
for (let attempt = 0; attempt < 3 && !config; attempt++) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/settings/design`, { headers: { 'x-settings-key': k }, signal: AbortSignal.timeout(10000) })
    const body = await res.json()
    if (res.ok && body && body.ok && body.config && typeof body.config === 'object') config = body.config
    else throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    if (attempt === 2) warn(`сайт не ответил (${err instanceof Error ? err.message : err})`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

const next = JSON.stringify(config, null, 2) + '\n'
let prev = ''
try { prev = readFileSync(FILE, 'utf8') } catch { /* файла не было */ }

// 🛑 ПУСТОЙ ОТВЕТ НЕ ЗАТИРАЕТ НАСТРОЕННОЕ (2026-09-25). ✗ Измерено: в 01:21 сайт только что поднялся после
// простоя, дверь ответила `{ ok: true, config: {} }` (её читатель при ЛЮБОЙ ошибке чтения отдаёт `{}` —
// тот же ответ, что «владелец ещё ничего не настраивал»), скрипт записал `{}` поверх голубой палитры, и
// страницы архитектора собрались чёрно-белыми, пока остальные элементы оставались голубыми.
// Отличить «сбросили» от «не смогли прочитать» по пустому объекту нельзя, поэтому пустота сюда не проходит.
const hasColors = (c) => !!c && typeof c === 'object' && !!c.colors && Object.keys(c.colors).length > 0
let prevConfig = null
try { prevConfig = JSON.parse(prev) } catch { /* прежний файл пуст или битый */ }
if (!hasColors(config) && hasColors(prevConfig)) {
  console.warn('[sync-site-design] ⚠ сайт отдал ПУСТОЕ оформление, а у ядра оно настроено — оставляю прежнее. Проверь дверь /api/settings/design сайта.')
  process.exit(0)
}
if (prev.replace(/\r\n/g, '\n') === next) {
  console.log('[sync-site-design] оформление ядра уже совпадает с сайтом')
} else {
  const tmp = `${FILE}.${process.pid}.tmp`
  writeFileSync(tmp, next, 'utf8')
  renameSync(tmp, FILE)
  console.log('[sync-site-design] оформление ядра взято у сайта')
}
