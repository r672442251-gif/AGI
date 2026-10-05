// УСТАНОВИТЬ КОМПЛЕКТ АГЕНТА В ГРУППУ СТРАНИЦ (269; в маршрут — 271; узлу и переименование страниц — 275).
//
//   npm run agent-kit:add -- <группа>                    установить службе
//   npm run agent-kit:add -- <группа> --node             установить самому узлу (агент живёт в корне)
//   npm run agent-kit:add -- <группа> --page <шаблон>=<имя>[:<порядок>]   назвать страницу по-своему
//   npm run agent-kit:add -- <группа> --force            переустановить поверх
//   npm run agent-kit:add -- [item] --born               ОДНА общая копия для всех рождённых AGI элементов (326):
//                                                        `architect/[item]/_agent-kit` + двери с именем элемента из адреса;
//                                                        страниц не ставит — их рисует дерево элемента `[[...page]]`
//   npm run agent-kit:update -- <группа>                 повторить установку с ТЕМИ ЖЕ параметрами
//
// 🔒 КОПИЯ МАСТЕРА ЦЕЛИКОМ, А НЕ ССЫЛКА НА НЕГО (решение владельца 2026-09-22, вариант А): группа получает
// собственную копию всего кода и владеет ею. Удалили папку группы — ушло всё; удалили мастер — установленные
// группы продолжают работать. Цена — N копий: исправление в мастере доезжает командой `agent-kit:update`, а
// `npm run check:agent-kits` печатает отставших.
//
// 🔒 ПАРАМЕТРЫ УСТАНОВКИ ЖИВУТ В `architect/<группа>/agent-kit.json` И БОЛЬШЕ НИГДЕ (275). Его пишет эта
// команда, читают мост (`core/server/workspace.cjs` — где рождается агент) и сторож (`lib/agent-kit/check.mjs`
// — как называются страницы этой копии). Поэтому `agent-kit:update` не требует повторять флаги, а второго
// списка имён не существует: удалили маршрут — ушли и параметры.
//
// ЧТО КЛАДЁТСЯ В `architect/<группа>/`:
//   agent-kit.json              ← манифест установки: служба, род рабочей папки, страницы, отпечаток мастера
//   _agent-kit/                 ← копия `core/` мастера
//   <имена страниц>/            ← из `pages/`, `.tpl` → без расширения, `__SERVICE__`/`__SLUG__`/`__ORDER__` подставлены
//   agent-api/<дверь>/route.ts  ← из `api/<дверь>/route.ts.tpl`
//
// 🛑 ДВА РОДА РАБОЧЕЙ ПАПКИ, И ОНИ ПРОВЕРЯЮТСЯ ПО-РАЗНОМУ:
//   служба — обязана стоять в `AGI-ITEMS-REGISTRY/agi-items.json` и лежать папкой `AGI-ITEMS/<kind>/<id>`;
//   узел   — `--node`: агент рождается в корне узла, реестр не спрашивается.
// И в обоих случаях у группы должна существовать своя группа страниц `architect/<группа>/_data/index.ts`:
// комплект кладёт себя В неё, а не придумывает группу молча.

import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const MASTER = dirname(fileURLToPath(import.meta.url))
const ARCHITECT = dirname(dirname(MASTER))
const ROOT = process.cwd()
const DOORS = ['session', 'ticket', 'claude-auth', 'channel']
// Шаблоны страниц и их значения по умолчанию. Имя шаблона — это ещё и вид островка в `core/widgets.tsx`,
// поэтому переименование трогает `slug`, но никогда не имя шаблона.
const TEMPLATES = {
  'claude-code': { slug: 'claude-code', order: 30 },
  terminal: { slug: 'terminal', order: 40 },
  telegram: { slug: 'telegram', order: 50 },
}
const ID_SHAPE = /^[a-z][a-z0-9-]{0,39}$/
const BORN_GROUP = '[item]'

const args = process.argv.slice(2)
const service = args.find((a) => !a.startsWith('--'))
const update = args.includes('--update')
const force = args.includes('--force') || update
const asNode = args.includes('--node')
// 326: группа `[item]` — всегда общая копия для рождённых (и при `agent-kit:update -- [item]`).
const asBorn = args.includes('--born') || service === BORN_GROUP

function fail(why) {
  console.error(`agent-kit: ${why}`)
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
}

// 🛑 ТОТ ЖЕ ОТПЕЧАТОК, ЧТО У СТОРОЖА `lib/agent-kit/check.mjs`: пути и содержимое, концы строк приведены —
// Windows и Linux дают один и тот же. Правите здесь — правьте там; сторож сверит свежую установку сам.
function fingerprint(dir) {
  const h = createHash('sha256')
  for (const file of walk(dir).sort()) {
    h.update(relative(dir, file).split(sep).join('/'))
    h.update('\0')
    h.update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
    h.update('\0')
  }
  return h.digest('hex').slice(0, 16)
}

/** `--page claude-code=subscription:10` → `{ template, slug, order }`. Порядок можно не называть. */
function parsePage(value) {
  const [template, rest] = String(value).split('=')
  if (!TEMPLATES[template]) fail(`--page: шаблона «${template}» нет; есть ${Object.keys(TEMPLATES).join(', ')}`)
  const [slug, order] = String(rest ?? '').split(':')
  if (!ID_SHAPE.test(slug ?? '')) fail(`--page ${template}=…: «${slug}» — не имя страницы (латиница, цифры, дефис)`)
  if (order !== undefined && !/^\d{1,4}$/.test(order)) fail(`--page ${template}=${slug}:${order} — порядок должен быть числом`)
  return { template, slug, order: order === undefined ? TEMPLATES[template].order : Number(order) }
}

function pagesFromArgs() {
  const chosen = new Map()
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== '--page') continue
    const page = parsePage(args[i + 1] ?? '')
    chosen.set(page.template, page)
  }
  return Object.entries(TEMPLATES).map(([template, def]) => chosen.get(template) ?? { template, slug: def.slug, order: def.order })
}

function stamp(text, page) {
  // 326: у общей копии имени службы нет — в коде метка `__BORN__` (дверь возьмёт имя из адреса), в словах — «born AGI element».
  let out = asBorn
    ? text.split('"__SERVICE__"').join('"__BORN__"').split('__SERVICE__').join('born AGI element')
    : text.split('__SERVICE__').join(service)
  if (page) out = out.split('__SLUG__').join(page.slug).split('__ORDER__').join(String(page.order))
  return out
}

/** Скопировать шаблонную папку: `.tpl` теряет расширение, метки заменяются значениями установки. */
function copyTemplate(from, to, page) {
  for (const file of walk(from)) {
    const rel = relative(from, file)
    const target = join(to, rel.endsWith('.tpl') ? rel.slice(0, -4) : rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, stamp(readFileSync(file, 'utf8'), page))
  }
}

if (!service) fail('назовите группу: npm run agent-kit:add -- <группа>')
if (!asBorn && !ID_SHAPE.test(service)) fail(`«${service}» — не имя группы (латиница, цифры, дефис)`)
if (asBorn && service !== BORN_GROUP) fail(`--born ставится только в группу ${BORN_GROUP}`)
if (service === 'kits') fail('«kits» — витрина готовых решений, а не группа с агентом')

const group = join(ARCHITECT, service)
if (asBorn ? !existsSync(join(group, '[[...page]]', 'page.tsx')) : !existsSync(join(group, '_data', 'index.ts'))) fail(`нет группы страниц architect/${service}/ — сначала заведите её`)

const manifestPath = join(group, 'agent-kit.json')
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null

// 🔒 `--update` ПОВТОРЯЕТ ПРЕЖНЮЮ УСТАНОВКУ, А НЕ СТАВИТ ЗАНОВО ПО УМОЛЧАНИЯМ. Иначе обновление мастера
// молча переименовало бы страницы узла обратно в `claude-code` и сломало адреса, которые уже раздали.
const namedPages = args.includes('--page')
const workspace = asBorn ? 'born-items' : asNode || (update && previous?.workspace === 'node') ? 'node' : 'agi-item'
const pages = asBorn ? [] : update && !namedPages && Array.isArray(previous?.pages) && previous.pages.length ? previous.pages : pagesFromArgs()

if (workspace === 'agi-item') {
  const reg = JSON.parse(readFileSync(join(ROOT, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8'))
  const entry = reg.services?.find((s) => s?.id === service)
  if (!entry) fail(`службы «${service}» нет в AGI-ITEMS-REGISTRY/agi-items.json (агенту самого узла нужен флаг --node)`)
  const itemDir = join(ROOT, 'AGI-ITEMS', entry.kind === 'user' ? 'user' : 'core', service)
  if (!existsSync(itemDir)) fail(`нет папки ${itemDir} — агенту негде жить`)
}

const installed = existsSync(join(group, '_agent-kit'))
if (update && !installed) fail(`в группе «${service}» комплекта нет — установите: npm run agent-kit:add -- ${service}`)
if (installed && !force) fail(`в группе «${service}» комплект уже есть — --force переустановит, agent-kit:update обновит`)
if (!installed && !force) {
  for (const p of [...pages.map((x) => x.slug), 'agent-api']) {
    if (existsSync(join(group, p))) fail(`architect/${service}/${p} уже занята — --force заменит`)
  }
}

// Поверх — значит сначала убрать прежнее целиком: и файл, удалённый из мастера, и страница, переименованная
// этой установкой, не должны пережить обновление.
const stale = new Set(['_agent-kit', 'agent-api', ...pages.map((p) => p.slug), ...(previous?.pages ?? []).map((p) => p.slug)])
for (const p of stale) rmSync(join(group, p), { recursive: true, force: true })
rmSync(manifestPath, { force: true })

cpSync(join(MASTER, 'core'), join(group, '_agent-kit'), { recursive: true })
const version = fingerprint(join(MASTER, 'core'))
for (const page of pages) copyTemplate(join(MASTER, 'pages', page.template), join(group, page.slug), page)
for (const d of DOORS) copyTemplate(join(MASTER, 'api', d), join(group, 'agent-api', d))
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      _: 'Параметры установки комплекта агента. Пишет npm run agent-kit:add, читают мост и сторож. Руками не править: правьте мастер и повторите npm run agent-kit:update.',
      service,
      workspace,
      version,
      pages,
      doors: DOORS,
    },
    null,
    2,
  )}\n`,
)

const where = workspace === 'node' ? 'корень узла' : workspace === 'born-items' ? 'AGI-ITEMS/user/<id> каждого рождённого элемента' : `AGI-ITEMS/<kind>/${service}`
console.log(`agent-kit: architect/${service}/ — _agent-kit (версия ${version}), страницы ${pages.map((p) => p.slug).join(', ')}, agent-api/{${DOORS.join(',')}}`)
console.log(`agent-kit: рабочая папка агента — ${where}`)
console.log(`===AGENT_KIT_OK=== группа «${service}» ${update ? 'обновлена' : 'получила комплект'}. Пересоберите узел: npm run serve:rebuild`)
