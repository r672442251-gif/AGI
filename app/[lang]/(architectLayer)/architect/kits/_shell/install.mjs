// УСТАНОВКА ОБОЛОЧКИ ПРОЕКТА (ШАПКА И ПОДВАЛ) В СЛУЖБУ НА NEXT (шаг 285-3).
//
//   npm run shell-kit:add -- <папка исходника службы>
//   npm run shell-kit:add -- <папка исходника службы> --from <папка сайта>
//
// 🔒 ИСТОЧНИК — САЙТ, А НЕ ЭТА ПАПКА. Вид шапки и подвала живёт в `components/shell/` сайта (элемент root) и
// копируется в службу байт в байт; по умолчанию сайт — папка элемента `root` узла (`AGI-ITEMS/<kind>/root`).
// Своей мастер-копии у ядра нет намеренно: две копии вида и дали «калейдоскоп» (слово владельца 2026-09-24).
// Сторож `npm run check:shell-kits` сверяет копии с сайтом.
//
// 🔒 СТАВИТСЯ В ИСХОДНИК СЛУЖБЫ (её репозиторий или форк), а не в AGI-ITEMS/: папка элемента — клон по тегу.
// Примитивы shadcn и `lib/utils` копируются, только если их у службы НЕТ — свои службы не перезаписываются.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const NODE = join(here, '..', '..', '..', '..', '..', '..')
const args = process.argv.slice(2)
const fromIdx = args.indexOf('--from')
const fromArg = fromIdx >= 0 ? args[fromIdx + 1] : null
const target = args.find((a, i) => !a.startsWith('--') && i !== fromIdx + 1)

function siteDir() {
  if (fromArg) return resolve(fromArg)
  const reg = JSON.parse(readFileSync(join(NODE, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8'))
  const root = (reg.services ?? []).find((s) => s.id === 'root')
  if (!root) return null
  return join(NODE, 'AGI-ITEMS', root.kind === 'user' ? 'user' : 'core', 'root')
}

if (!target || !existsSync(target)) {
  console.error('shell-kit: укажите папку исходника службы, которая существует')
  process.exit(1)
}
const site = siteDir()
if (!site || !existsSync(join(site, 'components', 'shell', 'shell-types.ts'))) {
  console.error(`shell-kit: у сайта нет components/shell (${site ?? 'сайта нет в реестре'}) — нужен сайт v1.7.1+`)
  process.exit(1)
}

const dst = resolve(target)
rmSync(join(dst, 'components', 'shell'), { recursive: true, force: true })
cpSync(join(site, 'components', 'shell'), join(dst, 'components', 'shell'), { recursive: true })
console.log(`shell-kit: components/shell скопирована с сайта (${site}) в ${dst}`)

const PRIMITIVES = ['components/ui/button.tsx', 'components/ui/sheet.tsx', 'components/ui/separator.tsx', 'components/ui/badge.tsx', 'components/ui/dropdown-menu.tsx', 'lib/utils.ts']
for (const p of PRIMITIVES) {
  if (existsSync(join(dst, p))) continue
  mkdirSync(dirname(join(dst, p)), { recursive: true })
  cpSync(join(site, p), join(dst, p))
  console.log(`  + ${p} (не было у службы — взят у сайта)`)
}

// 285-4: кнопка сайта стоит на @base-ui/react — без него сборка службы падает «Can't resolve '@base-ui/react/button'».
const DEPS = ['lucide-react', 'radix-ui', '@base-ui/react', 'class-variance-authority', 'clsx', 'tailwind-merge']
const sitePkg = JSON.parse(readFileSync(join(site, 'package.json'), 'utf8'))
// 285-4: приложение Next может жить папкой ВНУТРИ службы (данные: `presentation/`) — его package.json у службы.
const pkgPath = existsSync(join(dst, 'package.json')) ? join(dst, 'package.json') : join(dst, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const added = []
for (const d of DEPS) {
  if (pkg.dependencies?.[d] || pkg.devDependencies?.[d]) continue
  const v = sitePkg.dependencies?.[d]
  if (!v) continue
  pkg.dependencies = { ...(pkg.dependencies ?? {}), [d]: v }
  added.push(`${d}@${v}`)
}
if (added.length) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  + зависимости в package.json: ${added.join(', ')} — выполните npm install в службе`)
}

console.log('  подключение (корневой макет с языком в адресе):')
console.log('    <ThemeProvider> из "@/components/shell/theme-provider.client" вокруг страницы')
console.log('    <ProjectHeader data={shell} surface={…} /> … <ProjectFooter data={shell} surface={…} />')
console.log('    данные — дверь сайта PROJECT_SHELL_URL/<язык> на сборке; адреса сделать абсолютными на PROJECT_SITE_URL')
console.log('===SHELL_KIT_OK===')
