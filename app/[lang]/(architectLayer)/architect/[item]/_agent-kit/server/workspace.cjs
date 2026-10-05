// ПАПКА, В КОТОРОЙ ЖИВЁТ АГЕНТ (267-1, комплект — 269, корень узла — 275).
//
// 🔒 РАБОЧАЯ ПАПКА ЕСТЬ ЛИЧНОСТЬ АГЕНТА: `claude` читает `CLAUDE.md`, права и инструменты из папки
// запуска. Поэтому папку называет ОДНА функция, и её же печатает страница до запуска — страница не имеет
// права назвать одну папку, пока агент рождается в другой.
//
// 🔒 ИМЯ СЛУЖБЫ — ПАРАМЕТР, А НЕ КОНСТАНТА (269, слово владельца: «техническое решение, которое в качестве
// параметров принимает и возвращает возможность быстро встраивать в новые микросервисы»). Одна служба —
// одна сессия Claude Code и один Telegram-бот. 🪦 До 269 здесь стояло `AGENT_SERVICE = 'auth'`.
//
// 🔒 ДВЕ РАБОЧИЕ ПАПКИ, И ВЫБОР МЕЖДУ НИМИ — ДАННЫЕ, А НЕ ВЕТКА ПО ИМЕНИ (275):
//   `agi-item` — папка элемента `AGI-ITEMS/<kind>/<id>`, как было: агент службы заперт её деревом;
//   `node`     — корень узла: так живёт агент САМОГО узла (вкладка «Строительство»), потому что его
//                предмет — код узла, и `CLAUDE.md` узла лежит в корне.
// Какая из двух — сказано в манифесте установки `architect/<группа>/agent-kit.json`, который пишет
// установщик. 🛑 Имени конкретной группы здесь нет и быть не должно: комплект переносим.
//
// 🔒 ИМЯ ПРОВЕРЯЕТСЯ ПО МАНИФЕСТУ, РЕЕСТРУ И ДИСКУ: службы, которой нет в
// `AGI-ITEMS-REGISTRY/agi-items.json` или в `AGI-ITEMS/<kind>/<id>`, не существует — мост отказывает
// словами, а не рождает агента в чужой папке. Имя приходит из браузера, поэтому и форма имени
// проверяется: путь из него собирается.

const { existsSync, readFileSync, readdirSync } = require('node:fs')
const path = require('node:path')

// 🛑 КОРЕНЬ — `process.cwd()`, КАК У ВСЕГО УЗЛА (`lib/domain/auth-env.ts`), а не `__dirname`: модуль
// читают и `server.js`, и бандл двери Next, а внутри бандла `__dirname` указывает в `.next`, не в проект.
const ROOT = process.cwd()
const ID_SHAPE = /^[a-z][a-z0-9-]{0,39}$/

// 🛑 ВТОРАЯ КОПИЯ ЗНАНИЯ О ПУТИ, И ОНА НАМЕРЕННАЯ: копия комплекта уезжает в папку службы целиком и не
// имеет права зависеть от `lib/agi-items/paths.cjs` узла. Расхождение ловит `npm run check:agent-kits`.
// Узел 343: папка следует адресу элемента (`data/services/<id>/address.json`); не перенесена — папка по id.
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const itemDir = (id, kind) => {
  const base = path.join(ROOT, 'AGI-ITEMS', kind === 'user' ? 'user' : 'core')
  let a = null
  try { a = JSON.parse(readFileSync(path.join(ROOT, 'data', 'services', id, 'address.json'), 'utf8')).address } catch { /* адреса нет */ }
  if (typeof a === 'string' && LABEL.test(a) && a !== id && existsSync(path.join(base, a))) return path.join(base, a)
  return path.join(base, id)
}
const ARCHITECT = path.join(ROOT, 'app', '[lang]', '(architectLayer)', 'architect')

function registered() {
  try {
    const reg = JSON.parse(readFileSync(path.join(ROOT, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8'))
    return Array.isArray(reg.services) ? reg.services.filter((s) => s && typeof s.id === 'string') : []
  } catch {
    return []
  }
}

/** Манифест установки комплекта в группу `architect/<id>/` или `null`, если комплекта там нет. */
function manifest(id) {
  if (!ID_SHAPE.test(id)) return null
  try {
    const m = JSON.parse(readFileSync(path.join(ARCHITECT, id, 'agent-kit.json'), 'utf8'))
    return m && typeof m === 'object' ? m : null
  } catch {
    return null
  }
}

/** Абсолютный путь папки агента или `null`, если имени нет в реестре, на диске или оно не той формы. */
function serviceDir(service) {
  const id = String(service ?? '')
  if (!ID_SHAPE.test(id)) return null
  // Корень узла — только по слову манифеста: иначе любая опечатка в имени открыла бы агенту весь узел.
  if (manifest(id)?.workspace === 'node') return ROOT
  const entry = registered().find((s) => s.id === id)
  if (!entry) return null
  const dir = itemDir(id, entry.kind)
  return existsSync(dir) ? dir : null
}

/**
 * Рождённый ли это AGI элемент (узел 326): запись реестра `kind: user` с `born` и папка на диске. Только таких обслуживает
 * ОБЩАЯ копия комплекта (`architect/[item]`) — встроенные службы узла через неё агента не получают.
 */
function isBornItem(service) {
  const id = String(service ?? '')
  if (!ID_SHAPE.test(id)) return false
  const entry = registered().find((s) => s.id === id)
  return !!entry && entry.kind === 'user' && !!entry.born && existsSync(itemDir(id, 'user'))
}

/** Группы, у которых комплект установлен и папка агента существует. Список — обходом, не перечнем. */
function agentServices() {
  let names = []
  try {
    names = readdirSync(ARCHITECT)
  } catch {
    return []
  }
  return names.filter((id) => manifest(id) !== null && serviceDir(id) !== null)
}

module.exports = { serviceDir, agentServices, isBornItem }
