// СТОРОЖ ОБОЛОЧКИ ПРОЕКТА: КОПИИ `components/shell/` СОВПАДАЮТ С САЙТОМ БАЙТ В БАЙТ (шаг 285-3).
//
// Слово владельца 2026-09-24: «если мы говорим что мы пере используем один и тот же компонент везде то почему у
// нас корень и ядро имеет правильное представление для хедер и футер». Источник вида — сайт (элемент root);
// ядро и службы держат копию (`npm run shell-kit:add`). Копия, разошедшаяся с сайтом, и есть «калейдоскоп».
//
// Три вердикта, а не два: ок · ОШИБКА — у самого ЯДРА копия не совпадает с установленным сайтом (ядро
// собирается сейчас, и его вид обязан быть видом сайта) · ДОЛГ — у службы копия старше сайта: служба живёт своим
// тегом, обновляется своим выпуском; печатается при каждом прогоне, пока не закрыт.
// 🛑 Сайта с оболочкой ещё нет (узел до сайта v1.7.x) — сторож молчит об этом вслух и не падает.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const reg = JSON.parse(readFileSync(join(ROOT, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8'))
const dirOf = (s) => join(ROOT, 'AGI-ITEMS', s.kind === 'user' ? 'user' : 'core', s.id)
const root = (reg.services ?? []).find((s) => s.id === 'root')
const siteShell = root ? join(dirOf(root), 'components', 'shell') : null

function files(dir) {
  const out = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else out.push(relative(dir, p).split('\\').join('/'))
    }
  }
  walk(dir)
  return out.sort()
}
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

function compare(copy) {
  const want = files(siteShell)
  const have = existsSync(copy) ? files(copy) : []
  const diff = []
  for (const f of want) {
    if (!have.includes(f)) diff.push(`нет ${f}`)
    else if (read(join(siteShell, f)) !== read(join(copy, f))) diff.push(`отличается ${f}`)
  }
  for (const f of have) if (!want.includes(f)) diff.push(`лишний ${f}`)
  return diff
}

if (!siteShell || !existsSync(join(siteShell, 'shell-types.ts'))) {
  console.log('shell-kits: у установленного сайта нет components/shell — сверять не с чем (нужен сайт v1.7.1+)')
  console.log('===SHELL_KITS_OK===')
  process.exit(0)
}

let errors = 0
const core = compare(join(ROOT, 'components', 'shell'))
if (core.length) {
  errors++
  console.log('  ✗ ОШИБКА ядро: components/shell не совпадает с сайтом — npm run shell-kit:add -- .')
  for (const d of core.slice(0, 12)) console.log(`      ${d}`)
} else console.log('  ✓ ядро — копия сайта')

for (const s of reg.services ?? []) {
  if (s.id === 'root') continue
  // 285-4: у службы, где Next живёт папкой внутри (данные: `presentation/`), оболочка там.
  const copy = [join(dirOf(s), 'components', 'shell'), join(dirOf(s), 'presentation', 'components', 'shell')].find((p) => existsSync(p))
  if (!copy) continue
  const d = compare(copy)
  if (d.length) {
    console.log(`  ⚠ ДОЛГ ${s.id} ${s.version}: оболочка старше сайта — shell-kit:add в исходник службы, новый тег`)
    for (const x of d.slice(0, 6)) console.log(`      ${x}`)
  } else console.log(`  ✓ ${s.id} — копия сайта`)
}

// 294: замок страницы (`components/auth/access-gate.client.tsx`) — один файл у сайта и ядра; копия ядра = сайт.
const gateSite = join(dirOf(root), 'components', 'auth', 'access-gate.client.tsx')
const gateCore = join(ROOT, 'components', 'auth', 'access-gate.client.tsx')
if (existsSync(gateSite) && existsSync(gateCore)) {
  if (read(gateSite) !== read(gateCore)) {
    errors++
    console.log('  ✗ ОШИБКА ядро: components/auth/access-gate.client.tsx не совпадает с сайтом — скопируйте файл сайта')
  } else console.log('  ✓ замок страницы ядра — копия сайта')
}

if (errors) {
  console.log('===SHELL_KITS_FAILED===')
  process.exit(1)
}
console.log('===SHELL_KITS_OK===')
