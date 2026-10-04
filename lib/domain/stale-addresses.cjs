// ЭЛЕМЕНТЫ, КОТОРЫЕ ПОМНЯТ АДРЕСА НЕ ТОГО ДОМЕНА (шаг 387-2). Владелец 2026-10-04, D1: после входа с телефона «перейти на
// страницу архитектора» вело на `localhost:24680/ru/architect` — белый экран. Замер Mac: у сайта root `ARCHITECT_URL=
// http://localhost:24680` и `NEXT_PUBLIC_AUTH_URL=http://127.0.0.1:24681`, хотя `logs/domain.json` давно на aifa.dev.
// Механизм: эти имена — вычисляемые (`# kind: derived`), их пишет только установщик (`services-install.mjs` → `public-auth.cjs`);
// подключение домена правило лишь службу входа, и элемент, установленный ДО домена, помнил адреса компьютера. Полный цикл с нуля
// повторял это всегда: установка → временный адрес → свой домен.
// Решение владельца того же дня: «да, исправляй» — при подключении своего домена узел сам пересобирает такие элементы
// (`app/api/domain/activate`). Сравнение — с той же формулой, что у установщика, поэтому пересборка запишет ровно ожидаемое.

const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const paths = require('../agi-items/paths.cjs')
const { authEnvOverrides } = require('./public-auth.cjs')

// Адреса, которые домен меняет в элементах (у службы входа остальное правит `applyDomainToAuth`).
const NAMES = ['ARCHITECT_URL', 'NEXT_PUBLIC_AUTH_URL']

function envOf(file) {
  const map = new Map()
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) map.set(m[1], m[2].trim())
  }
  return map
}

/** Элементы, у которых записанный адрес пульта или входа расходится с тем, что даёт подключённый домен. */
function staleElements(root) {
  const want = authEnvOverrides(root, [])
  if (!want) return []
  let services = []
  try { services = JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8')).services || [] } catch { return [] }
  const out = []
  for (const s of services) {
    const file = join(paths.entryDir(s), '.env.local')
    if (!existsSync(file)) continue
    const env = envOf(file)
    const wrong = NAMES.filter((n) => env.has(n) && want[n] && env.get(n) !== want[n])
    if (wrong.length) out.push({ id: s.id, names: wrong })
  }
  return out
}

module.exports = { staleElements, NAMES }
