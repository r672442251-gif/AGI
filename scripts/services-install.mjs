// ОДНА КОМАНДА, О КОТОРОЙ ПРОСИЛ ВЛАДЕЛЕЦ: `npm run services:install` (257-4).
//
// Слова владельца 2026-09-20: службы «размещены как бы внутри одного главного
// репозитория стартер AGI то есть чтобы приехали через одну команду».
//
// ── ЧТО ОН ДЕЛАЕТ, ПО ПОРЯДКУ
//   1. читает AGI-ITEMS-CONFIG/agi-items.json — состав узла и закреплённые ТЕГИ;
//   2. приводит каждый элемент в AGI-ITEMS/<kind>/<id>/ ровно той версии;
//   3. читает паспорт блока (OWN-SERVICE-PROPS.json) — ТОЛЬКО читает;
//   4. назначает порт: желаемый из паспорта, занят — следующий свободный из блока;
//   5. ставит зависимости и, если блок того просит, собирает его;
//   6. пишет файл окружения блока — с тем ИМЕНЕМ, которое блок назвал сам;
//   7. дописывает в .env.local узла только NEXT_PUBLIC_* — вынужденное исключение;
//   8. вписывает ФАКТИЧЕСКИЕ порты обратно в реестр.
//
// ── ТРИ РОДА ПЕРЕМЕННЫХ, И ЭТО ГЛАВНОЕ РЕШЕНИЕ ФАЙЛА
//   derived — установщик знает сам: порт, адрес узла, адреса соседей;
//   secret  — генерирует случайное и кладёт в ОБА конца;
//   foreign — чужой ключ: НЕ выдумывает, называет вслух и говорит, что без него
//             не заработает.
// Род объявлен в `.env.example` блока строкой `# kind:` над переменной. Блок,
// который спросили, нельзя заполнить неверно.
//
// 🛑 ЧУЖИХ КЛЮЧЕЙ ОН НЕ СПРАШИВАЕТ ДИАЛОГОМ, И ЭТО РЕШЕНИЕ, А НЕ ЛЕНЬ. Установку
// зовут и вручную, и из автозапуска; модальный вопрос в непривычном месте
// означает зависание, которым проект уже платил двумя часами молчания бота.
// Поэтому недостающие ключи печатаются списком: что именно отсутствует, у какого
// блока и какая способность без него не работает. Человек дописывает их в
// названный файл и зовёт установку снова — она идемпотентна.
//
// 🛑 WINDOWS, ТРИ ОПЛАЧЕННЫХ ПРАВИЛА. `npm` — это `npm.cmd`, а node после
// CVE-2024-27980 не запускает `.cmd` без оболочки и молчит при этом (`EINVAL`,
// ни stdout, ни stderr). Поэтому `shell: true` только на Windows и только с
// постоянными аргументами. `windowsHide: true` — каждому порождённому процессу,
// иначе на экране человека мигают чёрные окна консоли.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, cpSync, renameSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import paths from '../lib/agi-items/paths.cjs'
import { addressOf } from '../lib/agi-items/address-file.mjs'
import { elementLanguages } from '../lib/agi-items/element-languages.mjs'

const require = createRequire(import.meta.url)
const { isFree, PORT_BLOCK_START, PORT_BLOCK_END, blockPorts, isBlockPort } = require('../lib/server-port.cjs')
const { authEnvOverrides, publicAuth } = require('../lib/domain/public-auth.cjs')

const ROOT = process.cwd()
// 🔒 Пути элементов — из одного места узла (272): `lib/agi-items/paths.cjs`.
const { ITEMS_DIR: SERVICES_DIR, REGISTRY_FILE: REGISTRY, entryDir } = paths
const NODE_ENV_FILE = join(ROOT, '.env.local')

const IS_WIN = process.platform === 'win32'
const say = (m) => console.log(m)
const liveLog = createRequire(import.meta.url)('../lib/deploy/live-log.cjs')
const LIVE_LOG = process.env.FRACTERA_LIVE_LOG || null
const warn = []
const missingForeign = []

// ── Окружение для чужих программ: без меток того, кто нас позвал (280-6).
//
// 🛑 ✗ ИЗМЕРЕНО 2026-09-24: установщик, запущенный дверью ядра (сервером Next), передал сборке и pm2
// окружение ядра целиком — `__NEXT_PROCESSED_ENV: true`, `AGI_COMMIT`, секреты узла. Next сайта,
// увидев эту метку, считает окружение уже прочитанным и НЕ читает свой `.env.local`: дверь настроек
// писала мимо `DESIGN_CONFIG_PATH` внутрь сборки. Тот же класс, что метки сессии Claude Code (267).
// Поэтому каждый элемент получает окружение машины, а не узла: своё он прочитает из своего файла.
function childEnv() {
  const own = new Set(typeof nodeEnv === 'undefined' ? [] : [...nodeEnv.keys()])
  const out = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('__NEXT') || k.startsWith('NEXT_') || k.startsWith('AGI_') || own.has(k)) continue
    if (k === 'PORT' || k === 'HOSTNAME' || k === 'NODE_ENV') continue
    // 353-3: журнал хода — дело одного развёртывания; pm2 сохранил бы его в окружении службы навсегда.
    if (k === 'FRACTERA_LIVE_LOG') continue
    out[k] = v
  }
  return out
}

// ── Запуск чужой программы. Один вход, чтобы правила Windows не разъехались.
function run(cmd, args, cwd, { quiet = false, env = {} } = {}) {
  // 353-3: развёртывание передаёт журнал хода (`FRACTERA_LIVE_LOG`) — `npm ci` и сборка пишут в него по мере работы, страница
  // видит движение. Только npm: вывод git и pm2 здесь разбирается как данные. `out` тот же — читается из журнала после выхода.
  if (LIVE_LOG && !quiet && cmd === 'npm') {
    return liveLog.runLive(cmd, args, { cwd, shell: IS_WIN, windowsHide: true, env: { ...childEnv(), ...env } }, LIVE_LOG)
  }
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: IS_WIN,
    windowsHide: true,
    stdio: quiet ? 'pipe' : 'pipe',
    env: { ...childEnv(), ...env },
  })
  return { rc: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

// ── Реестр ───────────────────────────────────────────────────────────────────
if (!existsSync(REGISTRY)) {
  say(`  ОШИБКА: нет ${REGISTRY}. Состав узла описывается им, ставить нечего.`)
  say('===SERVICES_INSTALL_FAILED===')
  process.exit(1)
}
const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))

// ── 374-5: ВОССТАНОВЛЕНИЕ ПРОЕКТА ИЗ СВОЕГО ФОРКА ──────────────────────────────
// Слово владельца 2026-10-02: «Если нужно восстановить весь проект то просто делаем Fork основного проекта» — уточнено: клон
// СВОЕГО форка. В нём снимок карты `AGI-ITEMS-CONFIG/agi-items.node.json` (пишет узел, 374-1): все элементы с адресом и
// репозиторием человека. 🔒 Снимок читается ТОЛЬКО на свежей машине — нет `data/services`: на живом узле реестр и есть правда,
// а снимок мог отстать (удалённый с тех пор элемент воскрес бы). Свой домен и туннель снимок не возвращает (решение: отложено).
const SNAPSHOT_FILE = join(ROOT, 'AGI-ITEMS-CONFIG', 'agi-items.node.json')
if (!existsSync(join(ROOT, 'data', 'services')) && existsSync(SNAPSHOT_FILE)) {
  let snap = null
  try { snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8')) } catch { say('  снимок карты не прочитан — восстанавливать нечего') }
  for (const s of Array.isArray(snap?.services) ? snap.services : []) {
    if (!s || typeof s.id !== 'string') continue
    const e = registry.services.find((x) => x.id === s.id)
    if (!e) registry.services.push({ ...s })
    else if (s.github && !e.github) e.github = s.github
    if (typeof s.address === 'string' && s.address !== s.id) {
      const f = join(ROOT, 'data', 'services', s.id, 'address.json')
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, JSON.stringify({ address: s.address, at: new Date().toISOString(), restored: true }, null, 2) + '\n', 'utf8')
    }
    say(`  карта узла: «${s.id}»${s.github ? ` — из ${s.github}` : ''}`)
  }
}

/** Ключ GitHub для восстановления: свой элемента → общий узла (`data/node/github/.env`) → `FRACTERA_GITHUB_TOKEN`. */
function githubToken(id) {
  for (const f of [join(ROOT, 'data', 'services', id, 'github', '.env'), join(ROOT, 'data', 'node', 'github', '.env')]) {
    try {
      const line = readFileSync(f, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GITHUB_TOKEN='))
      const t = line?.slice('GITHUB_TOKEN='.length).trim()
      if (t) return t
    } catch { /* нет файла */ }
  }
  return process.env.FRACTERA_GITHUB_TOKEN?.trim() || null
}

if (!Array.isArray(registry.services) || registry.services.length === 0) {
  say('  В составе узла нет ни одного блока — ставить нечего.')
  say('===SERVICES_INSTALL_OK===')
  process.exit(0)
}

// ── Общие секреты: генерируем ОДИН раз и держим в .env.local узла ────────────
//
// 🔒 ПОЧЕМУ ИСТОЧНИК ИМЕННО ФАЙЛ УЗЛА. Ключ обязан совпасть у двух концов. Узел
// переживает переустановку любой службы, значит он и есть та сторона, у которой
// ключ хранится; служба получает копию. Иначе переустановка службы породила бы
// новый ключ, а узел остался бы со старым — и дверь начала бы отвечать отказом,
// выглядящим как поломка службы.
// 🛑 `\r` СНИМАЕТСЯ ЗДЕСЬ, И ЭТО ОПЛАЧЕНО ПЕРВЫМ ЖЕ ПРОГОНОМ. Файлы приезжают из
// git с CRLF, а в JavaScript `.` НЕ совпадает с `\r` и `$` без флага `m` стоит в
// конце строки — образец `^NAME=(.*)$` на строке «PORT=\r» не совпадает никогда.
// Установщик при этом отрапортовал успех, написав ПУСТЫЕ файлы окружения: служба
// данных осталась бы без ключа и слушала бы сеть по умолчанию. Ноль совпадений
// неотличим от «не искали» — ровно тот класс, ради которого ниже стоит проверка
// на пустой разбор.
const splitLines = (text) => text.split(/\r?\n/)

function readEnvFile(file) {
  if (!existsSync(file)) return new Map()
  const map = new Map()
  for (const line of splitLines(readFileSync(file, 'utf8'))) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) map.set(m[1], m[2])
  }
  return map
}

const nodeEnv = readEnvFile(NODE_ENV_FILE)
const newNodeVars = new Map()

function sharedSecret(name) {
  const existing = nodeEnv.get(name) || newNodeVars.get(name)
  if (existing && existing.trim() !== '') return existing
  const value = randomBytes(32).toString('base64')
  newNodeVars.set(name, value)
  return value
}

// ── Порты ────────────────────────────────────────────────────────────────────
//
// 🛑 ПОРТ СЛУЖБА ПРОСИТ, А НАЗНАЧАЕТ УЗЕЛ. В паспорте стоит желаемый номер;
// занят — берём следующий свободный из блока и пишем ФАКТИЧЕСКИЙ в реестр. Без
// этого две купленные службы однажды попросят один номер и подерутся молча.
const takenByRegistry = new Set(
  registry.services.map((s) => s.port).filter((p) => Number.isInteger(p)),
)

// 🛑 «LOCALHOST» — ЭТО ДВА АДРЕСА, И ПОРТ БЫВАЕТ ЗАНЯТ НА ОДНОМ ИЗ НИХ.
// ✗ Оплачено первым же прогоном уступки: узел слушает `[::1]:24680` (его имя
// хоста — `localhost`, и оно разрешилось в IPv6), а проба по `127.0.0.1` нашла
// порт СВОБОДНЫМ и предложила его службе. Обе программы встали бы, каждая на
// своём стеке, и попадание клиента к нужной зависело бы от того, во что ЕГО
// резолвер развернёт слово «localhost». Отказ невоспроизводимый по построению.
async function freeOnBothStacks(port) {
  if (!(await isFree(port, '127.0.0.1'))) return false
  try {
    if (!(await isFree(port, '::1'))) return false
  } catch {
    // Машина без IPv6 — там второй стек и не нужен.
  }
  return true
}

// `installedHere` — ставился ли блок на ЭТОЙ машине (есть отметка установки).
//
// 🛑 РАЗЛИЧИЕ НЕ ФОРМАЛЬНОЕ, И БЕЗ НЕГО РЕЕСТР В GIT СТАНОВИТСЯ ЛОВУШКОЙ. Номер
// порта лежит в реестре и уезжает гостю вместе с репозиторием. На нашей машине
// он верен и занят нашей же службой — переназначать его нельзя: адрес роздан.
// На машине гостя тот же номер — чужое наследство, и там он может быть занят
// чем угодно. Отличает эти два случая ровно одно: ставился ли блок ЗДЕСЬ.
async function assignPort(entry, desired, installedHere) {
  if (Number.isInteger(entry.port)) {
    if (installedHere) return { port: entry.port, moved: false, kept: true }
    if (await freeOnBothStacks(entry.port) && entry.port !== nodePort) {
      return { port: entry.port, moved: false, kept: false, inherited: true }
    }
    say(`  унаследованный из реестра порт ${entry.port} на этой машине занят — назначаю свой`)
    entry.port = null
  }

  // 370: желаемый порт паспорта — только если узел вправе его занимать (внутри блока и не чужое умолчание).
  const first = isBlockPort(desired) ? desired : PORT_BLOCK_START
  const candidates = [first, ...blockPorts().filter((p) => p !== first)]

  for (const p of candidates) {
    if (takenByRegistry.has(p)) continue
    // 🔒 ПОРТ САМОГО УЗЛА ИСКЛЮЧЁН ЯВНО, А НЕ ПО ПРОБЕ. Установку зовут и тогда,
    // когда узел ещё не запущен, — и тогда его порт свободен по всем пробам.
    // Отдав его службе, мы отняли бы у человека адрес, который он уже кому-то
    // дал: узел при следующем старте уступил бы сам и сменил адрес молча.
    if (p === nodePort) continue
    if (await freeOnBothStacks(p)) {
      takenByRegistry.add(p)
      return { port: p, moved: p !== first, kept: false }
    }
  }
  throw new Error(
    `Свободного порта нет во всём блоке ${PORT_BLOCK_START}–${PORT_BLOCK_END}. ` +
      'Остановите лишние службы (npm run serve:stop) и повторите установку.',
  )
}

// ── Разбор `.env.example` блока: имя переменной плюс РОД ─────────────────────
function parseExample(text) {
  const vars = []
  let kind = null
  for (const line of splitLines(text)) {
    // 🛑 Рода «взять у ядра» НЕТ и не заводится (280-2a, решение владельца 2026-09-23): настройки
    // элемента живут в самом элементе, и он обязан работать, даже если ядра не существует. Ядро
    // дотягивается до них дверью элемента, а не раздаёт свои при установке.
    // `own` — настройка самого элемента: значение по умолчанию он пишет в свой пример, и
    // однажды изменённое (человеком или ядром через дверь элемента) переживает переустановку.
    const k = line.match(/^#\s*kind:\s*(derived|secret|foreign|own)\s*$/)
    if (k) { kind = k[1]; continue }
    const v = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (v) {
      vars.push({ name: v[1], kind: kind ?? 'derived', example: v[2] })
      // Род относится к ближайшей переменной ПОСЛЕ него — и к следующим тоже,
      // пока не встретится новый `# kind:`. Так устроены оба наших примера:
      // одна пометка на группу адресов соседей.
    }
  }
  return vars
}

// Папка постоянных данных службы у узла. Создаётся здесь: без папки SQLite не
// создаст файл и служба упадёт на первом запросе.
function serviceDataDir(id) {
  const dir = join(ROOT, 'data', 'services', id)
  mkdirSync(dir, { recursive: true })
  return dir.split('\\').join('/')
}

// ── Значения, которые установщик знает сам ───────────────────────────────────
function derivedValue(name, ctx) {
  const { port, id, props } = ctx
  const nodePort = ctx.nodePort
  // 🛑 ЯДРО — ПО ИМЕНИ `localhost`, НЕ `127.0.0.1` (371-7). Сервер ядра слушает имя `localhost` (`server.js:36`), а оно на
  // macOS и на Windows этой машины разрешается в IPv6 `::1`: измерено 2026-10-02 — `127.0.0.1:24680` → отказ (000), `[::1]` и
  // `localhost` → 200. ✗ На Mac ссылка сайта «Группа страниц архитектора» (`ARCHITECT_URL`) вела на `127.0.0.1` —
  // «ERR_CONNECTION_REFUSED». Имя `localhost` браузер и `fetch` node пробуют в обоих видах. Элементы слушают `127.0.0.1` сами
  // (`SERVICE_BIND`), поэтому их `self` остаётся прежним.
  const nodeUrl = `http://localhost:${nodePort}`
  const self = `http://127.0.0.1:${port}`

  // 🔒 СВОЙ ДОМЕН ПЕРЕКРЫВАЕТ ПЕТЛЮ (259-8). Подключённый домен выводит вход на
  // `auth.<зона>`, и переустановка обязана дать то же самое: иначе она молча
  // вернёт `127.0.0.1`, и вход снаружи умрёт без единой ошибки. Формула одна —
  // в `lib/domain/public-auth.cjs`, её же зовёт дверь активации.
  const domain = authEnvOverrides(ROOT, [nodeUrl, self])
  if (domain && Object.prototype.hasOwnProperty.call(domain, name)) return domain[name]

  switch (name) {
    case 'PORT': return String(port)
    case 'NODE_ENV': return 'production'
    case 'DATA_BIND': return '127.0.0.1'
    case 'NEXTAUTH_URL': return self
    case 'DATA_PUBLIC_URL': return self
    // 297: общие имена для любого элемента — в коде узла нет имени службы (первый AGI ITEM вида user — «Блоки»).
    case 'SERVICE_BIND': return '127.0.0.1'
    // 297: публичный адрес элемента — по той же формуле, что у двери `/api/node/reach`: сайт — корень зоны, прочие —
    // `<id>.<зона>` (публичная главная любого AGI ITEM индексируется: canonical и hreflang нужен настоящий адрес).
    case 'SERVICE_PUBLIC_URL': {
      const pub = publicAuth(ROOT)
      if (pub) return id === 'root' ? `https://${pub.siteHost}` : `https://${addressOf(id)}.${pub.zone}` // 325-8: по адресу элемента
      return self
    }
    case 'COOKIE_DOMAIN': return ''            // host-only: одна машина
    case 'COOKIE_SECURE': return 'false'       // http://localhost, Secure не вернётся
    // 🔒 БАЗА ВХОДА ЖИВЁТ У УЗЛА, А НЕ У СЛУЖБЫ, И ПУТЬ АБСОЛЮТНЫЙ (260-1).
    // ✗ ИЗМЕРЕНО 2026-09-21: при `file:./data/auth.db` живая база оказалась в
    // `.next/standalone/…/data/` — собранный сервер делает chdir в свою папку, и
    // относительный путь уводит в сборку. Любая пересборка стирала бы всех
    // пользователей вместе с архитектором, а вернуть право архитектора нельзя.
    // Папка службы не годится тоже: клон без `.git` установщик удаляет целиком.
    // `data/` узла лежит в `.gitignore` и не трогается ни сборкой, ни клоном.
    case 'DATABASE_URL': return `file:${serviceDataDir(id)}/${id}.db`
    case 'APP_DB_PATH': return `./data/${id}.db`
    case 'ALLOWED_ORIGINS': return [nodeUrl, `http://127.0.0.1:${nodePort}`, self].join(',') // 371-7: оба вида адреса ядра
    case 'EMBED_MODEL': return 'text-embedding-3-large'
    case 'EMBED_DIMS': return '3072'
    // 280-2a: сайт узнаёт, где живут страницы архитектора (ядро) и дверь к данным. Имена
    // не подходят под правило соседей ниже: «architect» — не элемент, а ядро; REMOTE_DATA_URL —
    // имя, которое код приложения читает как признак «данные через дверь, а не своим файлом».
    // 🛑 ПУТЬ К НАСТРОЙКАМ ЭЛЕМЕНТА — АБСОЛЮТНЫЙ (280-6). ✗ Измерено: standalone-сервер работает из
    // .next/standalone, и дверь настроек писала DESIGN-CONFIG ВНУТРЬ сборки — следующая сборка
    // стирала правку, а настоящий файл сайта оставался прежним. Тот же класс, что база входа (260-1).
    case 'DESIGN_CONFIG_PATH': return join(ctx.dir, 'DESIGN-CONFIG', 'design-config.json')
    // 299: тот же класс для остальных файлов настроек элемента. ✗ Измерено 2026-09-25: сайт читал APP-CONFIG и
    // PLATFORM-CONFIG из копии внутри сборки — правка файла на диске не видна до пересборки.
    case 'APP_CONFIG_PATH': return join(ctx.dir, 'APP-CONFIG', 'app-config.json')
    case 'PLATFORM_CONFIG_PATH': return join(ctx.dir, 'PLATFORM-CONFIG', 'platform-config.json')
    case 'LEGAL_CONFIG_DIR': return join(ctx.dir, 'APP-CONFIG', 'legal')
    // 330-3: тот же класс для ДАННЫХ СТРАНИЦ элемента (`app/**/_data`, `_pages`). ✗ Измерено 2026-09-28: `ELEMENT_DIR` не
    // писал никто, `lib/page-tree.ts` брал `process.cwd()` — папку сборки, и правка текста не была видна даже после
    // перерисовки (`pages:refresh` отвечал 200, страница оставалась прежней). Папка элемента — абсолютная.
    case 'ELEMENT_DIR': return ctx.dir
    // Файл подключённого домена — у узла; собранный сервер элемента сам его не найдёт (сайт вёл «Войти» на петлю).
    case 'NODE_DOMAIN_FILE': return join(ROOT, 'logs', 'domain.json')
    // 299: реестр узла — какие элементы стоят здесь. Элемент настроек показывает по нему ссылки на все элементы перед
    // выключением меню или входа (слово владельца: «откуда мы знаем какие у нас есть сервисы? … AGI config»).
    case 'NODE_ITEMS_FILE': return paths.REGISTRY_FILE
    // 299-6: папка данных элемента у узла — абсолютная, вне сборки и вне клона (переживает пересборку и переустановку).
    // Общее имя для любого элемента; сайт держит в ней последнюю копию настроек проекта.
    case 'SERVICE_DATA_DIR': return serviceDataDir(id)
    // 367-5: собственный репозиторий элемента, рождённого из репозитория человека (`born.url` реестра); у остальных — пусто.
    case 'ELEMENT_REPO_URL': return registry.services.find((s) => s.id === id)?.born?.url ?? ''
    case 'ARCHITECT_URL': return nodeUrl
    // 283-2: стандартный хедер и футер — меню проекта у двери сайта, ссылки — на сайт. Сервер службы
    // спрашивает сайт по петле; браузер человека идёт на публичный адрес сайта, если домен подключён.
    case 'PROJECT_MENU_URL': {
      const root = registry.services.find((x) => x.id === 'root')
      return root && Number.isInteger(root.port) ? `http://127.0.0.1:${root.port}/api/menu` : ''
    }
    // 285-3: оболочка проекта (шапка и подвал) — статическая дверь сайта, по петле машины.
    case 'PROJECT_SHELL_URL': {
      const root = registry.services.find((x) => x.id === 'root')
      return root && Number.isInteger(root.port) ? `http://127.0.0.1:${root.port}/api/shell` : ''
    }
    case 'PROJECT_SITE_URL': {
      const pub = publicAuth(ROOT)
      if (pub && pub.architectHost) return `https://${pub.siteHost}`
      const root = registry.services.find((x) => x.id === 'root')
      return root && Number.isInteger(root.port) ? `http://localhost:${root.port}` : ''
    }
    case 'NEXT_PUBLIC_AUTH_URL': {
      const auth = registry.services.find((s) => s.id === 'auth')
      return auth && Number.isInteger(auth.port) ? `http://127.0.0.1:${auth.port}` : ''
    }
    case 'REMOTE_DATA_URL': {
      const data = registry.services.find((s) => s.id === 'data')
      return data && Number.isInteger(data.port) ? `http://127.0.0.1:${data.port}` : ''
    }
    default: break
  }

  // Адреса соседей: спрашиваются у реестра, а не пишутся.
  //
  // 🛑 ОБРАЗЕЦ ИМЕНИ ОБЯЗАН ЗНАТЬ ПОДЧЁРКИВАНИЕ ВНУТРИ, И ЭТОТ КЛАСС В ПРОЕКТЕ
  // УЖЕ ОПЛАЧЕН: первая редакция читала `^([A-Z0-9]+)_URL$` и не видела
  // `AI_BROWSER_URL` — имя с дефисом внутри. Тот же дефект, что у маршрута
  // `/service/<имя>/*`, где образец не знал дефиса.
  const neighbour = name.match(/^([A-Z0-9_]+?)_(?:SERVICE_)?URL$/)
  if (neighbour) {
    const wanted = neighbour[1].toLowerCase().replace(/_/g, '-')
    const found = registry.services.find((s) => s.id === wanted)
    if (found && Number.isInteger(found.port)) return `http://127.0.0.1:${found.port}`
    // 🔒 Пусто значит «такой службы у этого узла нет». Это честный ответ: код
    // службы увидит пустое и скажет об этом, а не пойдёт стучаться в чужой порт.
    return ''
  }

  // Пути серверной линии: на узле их нет, и подставлять чужие нельзя.
  if (/^(APP_ENV_FILE|DATA_ENV_PATH|RAG_ENV_PATH|FRACTERA_MACHINE_ENV|FRACTERA_IP_NODOMAIN_MODE)$/.test(name)) return ''

  warn.push(`  ? ${props.id}: переменная ${name} объявлена derived, но установщик не знает её значения — оставлена пустой`)
  return ''
}

// ── Чем запускать службу ─────────────────────────────────────────────────────
//
// Возвращает { cmd, args, cwd } или null. Ни одной строки, зависящей от имени
// конкретной службы: всё выводится из того, что лежит в её папке.
function findStandaloneServer(dir, distDir = '.next') {
  const stack = [join(dir, distDir, 'standalone')]
  for (let depth = 0; depth < 5 && stack.length; depth += 1) {
    const next = []
    for (const d of stack) {
      if (!existsSync(d)) continue
      if (existsSync(join(d, 'server.js'))) return d
      for (const name of readdirSync(d, { withFileTypes: true })) {
        if (name.isDirectory() && name.name !== 'node_modules') next.push(join(d, name.name))
      }
    }
    stack.length = 0
    stack.push(...next)
  }
  return null
}

function resolveStart(dir, props, distDir = '.next') {
  // 367-4: элемент из репозитория человека несёт запускатель узла (`fractera-start.mjs`), названный в паспорте `runtime.entry`
  // (+ `entryArgs` — режим next / node:<файл> / static:<папка>). Он и есть процесс pm2: окружение читает сам, порт берёт оттуда.
  const entry = props?.runtime?.entry
  if (typeof entry === 'string' && entry && existsSync(join(dir, entry))) {
    return { cmd: 'node', args: [entry, ...(Array.isArray(props.runtime.entryArgs) ? props.runtime.entryArgs.map(String) : [])], cwd: dir }
  }
  const standaloneDir = findStandaloneServer(dir, distDir)
  if (standaloneDir) {
    // Статика — рядом с найденным сервером, а не в корне standalone; папка сборки — та, в
    // которую собирали (280-9: .next-a / .next-b у элементов со сборкой без простоя).
    const staticFrom = join(dir, distDir, 'static')
    if (existsSync(staticFrom)) {
      cpSync(staticFrom, join(standaloneDir, distDir, 'static'), { recursive: true })
    }
    if (existsSync(join(dir, 'public'))) {
      cpSync(join(dir, 'public'), join(standaloneDir, 'public'), { recursive: true })
    }
    return { cmd: 'node', args: [relative(dir, join(standaloneDir, 'server.js')).split('\\').join('/')], cwd: dir }
  }

  // Простая служба: берём её же команду старта, если это честный вызов node.
  // `npm run start` через оболочку не годится в pm2: убитый npm оставляет
  // сироту — узел уже платил за этот класс отказа.
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const m = String(pkg.scripts?.start ?? '').match(/^node\s+([^\s]+)$/)
    if (m) return { cmd: 'node', args: [m[1]], cwd: dir }
  } catch { /* нет package.json — ответим null */ }

  return null
}

// ── Сам обход ────────────────────────────────────────────────────────────────
const nodePort = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'logs', 'runtime.json'), 'utf8')).port ?? PORT_BLOCK_START }
  catch { return PORT_BLOCK_START }
})()

mkdirSync(SERVICES_DIR, { recursive: true })

// Что было запущено ДО установки — спрашивается один раз, в начале: шаг 4
// останавливает живые службы перед заменой зависимостей, шаг 8 поднимает их.
const pm2cmd = IS_WIN ? 'pm2.cmd' : 'pm2'
const runningAtStart = (() => {
  const listed = run(pm2cmd, ['jlist'], ROOT, { quiet: true })
  try { return JSON.parse(listed.out.slice(listed.out.indexOf('['))).map((a) => a.name) } catch { return [] }
})()
const stoppedByInstaller = new Set()

let failed = 0
const summary = []

// `--only <id>` — одна служба (280-6: ядро поправило настройки сайта и пересобирает только его).
// `--rebuild` — пересобрать, даже если версия и окружение те же: изменились файлы настроек
// внутри элемента, а их отпечаток установщик не считает.
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null })()
const REBUILD = process.argv.includes('--rebuild')

// ── Прогрев свежей сборки (280-9) ───────────────────────────────────────────
//
// ✗ ИЗМЕРЕНО 2026-09-24: сразу после переключения на новую папку сборки процесс 18 с не слушал порт,
// а ещё ≥14 с принимал соединения и не отвечал: первый запуск читает тысячи только что записанных
// файлов, и Windows проверяет каждый. Поэтому новая сборка сначала поднимается на ЗАПАСНОМ порту и
// отвечает на здоровье и главную — и только потом pm2 переключается на неё: файлы уже прочитаны.
async function warmUp(start, healthPath) {
  let port = null
  for (const c of blockPorts().reverse()) {
    if (takenByRegistry.has(c) || c === nodePort) continue
    if (await freeOnBothStacks(c)) { port = c; break }
  }
  if (!port) return 'нет свободного порта для прогрева'
  const proc = spawn(process.execPath, start.args, {
    cwd: start.cwd, windowsHide: true, stdio: 'ignore',
    env: { ...childEnv(), PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  })
  const base = `http://127.0.0.1:${port}`
  const t0 = Date.now()
  try {
    for (const path of [healthPath || '/', '/']) {
      for (;;) {
        if (Date.now() - t0 > 180000) return 'прогрев не дождался ответа за 3 минуты'
        try {
          const res = await fetch(base + path, { signal: AbortSignal.timeout(15000) })
          if (res.status < 500) break
        } catch { /* ещё не слушает */ }
        await new Promise((ok) => setTimeout(ok, 1000))
      }
    }
    return `прогрет за ${Math.round((Date.now() - t0) / 1000)} с на порту ${port}`
  } finally {
    proc.kill()
  }
}

// Папки прежних сборок, которые удаляются ПОСЛЕ перезапуска процессов (280-9).
const retiredDists = []
/** Папка сборки, из которой служба запущена сейчас (по её отметке). */
function currentDist(stamp) {
  // 285-4: служба без standalone-сервера (Express со встроенным Next) запускается `server.js` — по пути
  // сервера папку сборки не узнать; её помнит отметка (`dist`). У сайта и входа поведение прежнее.
  if (typeof stamp?.dist === 'string' && stamp.dist.startsWith('.next')) return stamp.dist
  const first = String(stamp?.start?.args?.[0] ?? '').split(/[\\/]/)[0]
  return first.startsWith('.next') ? first : '.next'
}

for (const entry of registry.services) {
  if (ONLY && entry.id !== ONLY) continue
  let builtDist = null
  const dir = entryDir(entry)
  say(`\n── ${entry.id} — ${entry.born ? 'рождённый' : entry.version}`)

  // 🔒 РОЖДЁННЫЙ ЭЛЕМЕНТ (319-1) — САМОСТОЯТЕЛЬНЫЙ ПРОЕКТ, А НЕ КОПИЯ НА ТЕГЕ FRACTERA. Его код пишет агент элемента, и
  // установщик его НЕ клонирует, НЕ тянет и НЕ переводит на тег: иначе следующая установка (или `serve.mjs ensureElements`)
  // стёрла бы эту работу молча. Версия для правил «пересобрать ли» — тег шаблона плюс текущий коммит элемента: правка
  // агента, закоммиченная в его папке, даёт новую версию и новую сборку.
  let version = entry.version
  // 374-5: у элемента есть репозиторий человека, а папки нет — это восстановление: клон оттуда, со всей историей. Ключ в адрес —
  // только на время клона; `origin` остаётся чистым адресом. У обязательного элемента Fractera становится `upstream` (374-7).
  if (entry.github && !existsSync(join(dir, '.git'))) {
    const token = githubToken(entry.id)
    if (!token) {
      say(`  ОШИБКА: элемент живёт в репозитории ${entry.github}, а токена GitHub нет — добавьте токен на странице GitHub узла и повторите`)
      failed += 1
      continue
    }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    mkdirSync(dirname(dir), { recursive: true })
    const c = run('git', ['-c', 'credential.helper=', 'clone', '--quiet', `https://x-access-token:${token}@github.com/${entry.github}.git`, dir], ROOT, { env: { GIT_TERMINAL_PROMPT: '0' } })
    if (c.rc !== 0) {
      say(`  ОШИБКА восстановления из ${entry.github}: репозиторий не склонирован (ключ не видит его или сети нет)`)
      failed += 1
      continue
    }
    run('git', ['remote', 'set-url', 'origin', `https://github.com/${entry.github}.git`], dir)
    if (!entry.born && entry.repo) {
      run('git', ['remote', 'add', 'upstream', entry.repo], dir)
      run('git', ['fetch', '--quiet', '--tags', 'upstream'], dir)
    }
    say(`  восстановлен из ${entry.github}`)
  }
  if (entry.born) {
    if (!existsSync(join(dir, '.git'))) {
      say('  ОШИБКА: папки рождённого элемента нет — его код существовал только здесь, восстановить его неоткуда')
      failed += 1
      continue
    }
    const commit = run('git', ['rev-parse', '--short', 'HEAD'], dir).out.trim()
    version = `${entry.born.version ?? 'born'}+${commit || 'no-commit'}`
    say(`  рождён из ${entry.born.from ?? 'шаблона'} ${entry.born.version ?? ''} — код элемента не трогаю, версия ${version}`)
  } else {
    // 374-7: у обязательного элемента своя работа поверх тега (слово владельца 2026-10-02: «пользователь их меняет … прогрессирует
    // ровно точно также как и любой другой AGI ITEMS»). Тег Fractera — его предок, а HEAD ушёл дальше: переход на тег стёр бы
    // эту работу из работающего элемента. Такой элемент не переводится на тег; версия — тег+коммит, как у рождённого; новый
    // тег Fractera вливается кнопкой «Обновить» (конфликт — агенту элемента).
    const fractera = existsSync(join(dir, '.git')) && run('git', ['remote', 'get-url', 'upstream'], dir, { quiet: true }).rc === 0 ? 'upstream' : 'origin'
    let ownWork = false
    // Своя работа — коммиты, которых нет ни в одном теге Fractera (сверка не с тегом реестра: после выпуска нового тега правки
    // лежат поверх СТАРОГО, и сверка с новым их бы не увидела).
    if (existsSync(join(dir, '.git'))) {
      run('git', ['fetch', '--quiet', '--tags', fractera], dir)
      ownWork = Number(run('git', ['rev-list', '--count', 'HEAD', '--not', '--tags'], dir).out.trim() || '0') > 0
    }
    if (ownWork) {
      const commit = run('git', ['rev-parse', '--short', 'HEAD'], dir).out.trim()
      const base = run('git', ['describe', '--tags', '--abbrev=0', 'HEAD'], dir).out.trim() || entry.version
      version = `${base}+${commit}`
      say(`  своя работа поверх ${base} — на тег не перевожу, версия ${version}`)
      if (base !== entry.version) say(`  доступен ${entry.version} — влейте его кнопкой «Обновить» (Строительство → GitHub); конфликт уйдёт агенту элемента`)
    }
    // 1. Привести репозиторий к ЗАКРЕПЛЁННОЙ версии.
    if (ownWork) { /* работа человека — не трогаем */ } else if (!existsSync(join(dir, '.git'))) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
      const c = run('git', ['clone', '--quiet', '--branch', entry.version, '--depth', '1', entry.repo, dir], ROOT)
      if (c.rc !== 0) {
        say(`  ОШИБКА клона: ${c.out.trim().split('\n').slice(-2).join(' ')}`)
        failed += 1
        continue
      }
      say('  клонирован')
    } else {
      run('git', ['fetch', '--quiet', '--tags', fractera], dir)
      // 🛑 СБОРКА NEXT САМА ПРАВИТ `tsconfig.json` (дописывает .next-a/.next-b) и `next-env.d.ts` (295-1, измерено):
      // выпуск, меняющий эти же файлы, git отказывался ставить («Aborting»). Они — след сборки, а не чья-то работа:
      // возвращаем ТОЛЬКО их; любая другая локальная правка по-прежнему останавливает переход.
      const nextOwned = run('git', ['ls-files', '-m'], dir).out.split('\n').map((l) => l.trim())
        .filter((f) => /(^|\/)(tsconfig\.json|next-env\.d\.ts)$/.test(f))
      if (nextOwned.length) run('git', ['checkout', '--quiet', '--', ...nextOwned], dir)
      const co = run('git', ['checkout', '--quiet', `tags/${entry.version}`], dir)
      if (co.rc !== 0) {
        say(`  ОШИБКА перехода на ${entry.version}: ${co.out.trim().split('\n').slice(-1)[0]}`)
        failed += 1
        continue
      }
      say('  обновлён до закреплённой версии')
    }

    // 🔒 Сверяем ФАКТ, а не код возврата: версия, на которой мы стоим, обязана
    // совпасть с реестром. Иначе «поставили v1.0.1» — это обещание, а не факт.
    const head = ownWork ? entry.version : run('git', ['describe', '--tags', '--exact-match'], dir).out.trim()
    if (head !== entry.version) {
      say(`  ОШИБКА: в папке версия «${head || 'без тега'}», а реестр требует «${entry.version}»`)
      failed += 1
      continue
    }
  }

  // 2. Паспорт. Только читаем.
  const propsFile = join(dir, 'OWN-SERVICE-PROPS.json')
  if (!existsSync(propsFile)) {
    say('  ОШИБКА: у блока нет OWN-SERVICE-PROPS.json — установщику не у кого спросить, как его ставить')
    failed += 1
    continue
  }
  const props = JSON.parse(readFileSync(propsFile, 'utf8'))

  // Отметка прошлой установки — она же ответ на вопрос «ставился ли блок ЗДЕСЬ».
  const FORCE = process.argv.includes('--force')
  const stampFile = join(dir, '.install-stamp.json')
  const stamp = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : {}
  const installedHere = existsSync(stampFile)

  // 3. Порт.
  let port
  try {
    const a = await assignPort(entry, props.port?.desired, installedHere)
    port = a.port
    say(`  порт ${port}` + (a.kept ? ' (уже был назначен здесь, не трогаем)'
      : a.inherited ? ' (унаследован из реестра, свободен — берём)'
      : a.moved ? ` (желаемый ${props.port?.desired} занят — уступили)` : ''))
  } catch (e) {
    say(`  ОШИБКА порта: ${e.message}`)
    failed += 1
    continue
  }
  entry.port = port

  // 4. Зависимости.
  //
  // 🔒 ПОВТОРНЫЙ ПРОГОН НЕ ПЕРЕУСТАНАВЛИВАЕТ И НЕ ПЕРЕСОБИРАЕТ БЕЗ ПРИЧИНЫ.
  // Установку зовут часто — после правки состава, после ввода чужого ключа, из
  // проверок. Минута пересборки на каждый зов превращает «одну команду» в то,
  // чего человек начинает избегать. Отметка в `.install-stamp.json` хранит
  // версию и отпечаток окружения; совпали — работа пропускается и это сказано
  // вслух. `--force` пересобирает всё безусловно.
  // 🔒 296: ЗАВИСИМОСТИ МЕНЯЮТСЯ ТОЛЬКО С `package-lock.json`, А НЕ С ВЕРСИЕЙ. ✗ Измерено 2026-09-24: каждый выпуск
  // (даже правка одной строки) переставлял node_modules — минуты на элемент, и на Windows `npm ci` падал EPERM на
  // `tailwindcss-oxide…node`, который держит работающая служба (три раза за день). Отпечаток замка совпал — пропуск.
  const lockFile = join(dir, 'package-lock.json')
  // ✗ Измерено 2026-09-25: номер версии самого пакета тоже лежит в замке — повышение версии без новых библиотек меняло
  // отпечаток, и зависимости переставлялись (368 с). Отпечаток — по библиотекам, без версии корневого пакета.
  const lockHash = (() => {
    if (!existsSync(lockFile)) return null
    try {
      const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
      delete lock.version
      if (lock.packages?.['']) delete lock.packages[''].version
      return createHash('sha256').update(JSON.stringify(lock)).digest('hex')
    } catch { return createHash('sha256').update(readFileSync(lockFile)).digest('hex') }
  })()
  const depsReady = existsSync(join(dir, 'node_modules')) &&
    (stamp.lockHash ? stamp.lockHash === lockHash : stamp.version === version)

  if (depsReady && !FORCE) {
    say('  зависимости на месте (тот же package-lock.json) — пропущено')
  } else {
    // 🔒 ЖИВУЮ СЛУЖБУ ОСТАНАВЛИВАЕМ ДО ЗАМЕНЫ ЕЁ ЗАВИСИМОСТЕЙ (260-1).
    // ✗ ИЗМЕРЕНО 2026-09-21 на Windows: `npm ci` падал `EPERM unlink` на
    // `better_sqlite3.node` и `vec0.dll` — работающий процесс держит свои нативные
    // файлы, и Windows не даёт их удалить. Повторная установка на живом узле была
    // невозможна вовсе. Цена названа: служба молчит, пока идёт установка; в конце
    // её поднимает шаг 8, а после отказа — та же ветка ниже (`stoppedByInstaller`).
    for (const suffix of ['-watch', '']) {
      const name = `fractera-svc-${entry.id}${suffix}`
      if (runningAtStart.includes(name) && run(pm2cmd, ['stop', name], ROOT, { quiet: true }).rc === 0) {
        stoppedByInstaller.add(name)
      }
    }
    // 🔒 297: СТАРАЯ ПАПКА БИБЛИОТЕК ОТОДВИГАЕТСЯ, А НЕ УДАЛЯЕТСЯ НА МЕСТЕ. Слово владельца 2026-09-25: продукт «никак не
    // должен зависеть от компьютера пользователя». ✗ Измерено: нативный модуль Tailwind держал VS Code (расширение
    // IntelliSense) — на Windows файл, который держит ЛЮБАЯ программа (редактор, антивирус, бэкап), удалить нельзя
    // (EPERM), и `npm ci` падал, оставляя полуудалённую папку. Замер той же минуты: удалить файл — EPERM, ПЕРЕИМЕНОВАТЬ
    // ПАПКУ — можно. Поэтому `node_modules` уезжает в `node_modules.old-<время>`, `npm ci` ставит свежую, старая
    // удаляется, когда её отпустят (сейчас или при следующей установке).
    for (const n of readdirSync(dir)) {
      if (n.startsWith('node_modules.old-')) try { rmSync(join(dir, n), { recursive: true, force: true }) } catch { /* ещё держат — в следующий раз */ }
    }
    let movedAside = null
    if (existsSync(join(dir, 'node_modules'))) {
      const aside = join(dir, `node_modules.old-${Date.now()}`)
      try { renameSync(join(dir, 'node_modules'), aside); movedAside = aside } catch { /* не вышло — npm ci попробует сам */ }
    }
    let ci = run('npm', ['ci', '--no-audit', '--no-fund'], dir)
    if (movedAside) try { rmSync(movedAside, { recursive: true, force: true }) } catch { say('  прежняя папка библиотек занята другой программой — удалится при следующей установке') }
    // 287: на Windows файл native-модуля бывает занят процессом прошлой сборки (EPERM/EBUSY unlink) — через секунды
    // он свободен. ✗ Измерено: возврат auth после отката упал здесь, повтор минутой позже прошёл. Один повтор.
    if (ci.rc !== 0 && /EPERM|EBUSY/.test(ci.out)) {
      say('  зависимости: файл занят (EPERM/EBUSY) — повторяю через 5 с')
      await new Promise((r) => setTimeout(r, 5000))
      ci = run('npm', ['ci', '--no-audit', '--no-fund'], dir)
    }
    if (ci.rc !== 0) {
      say('  ОШИБКА установки зависимостей:')
      say(ci.out.split('\n').filter((l) => l.includes('npm error')).slice(0, 6).map((l) => '    ' + l).join('\n'))
      failed += 1
      continue
    }
    say('  зависимости поставлены')
    // 297: отпечаток зависимостей записывается СРАЗУ, а не в конце: ✗ измерено — упавшая после установки сборка
    // оставляла прежнюю отметку, и следующая попытка снова ставила все библиотеки (8 минут).
    try { writeFileSync(stampFile, JSON.stringify({ ...stamp, lockHash }, null, 2), 'utf8'); stamp.lockHash = lockHash } catch { /* отметка в конце */ }
  }

  // 4а. ОФОРМЛЕНИЕ ПРОЕКТА НАСЛЕДУЕТСЯ С РОЖДЕНИЯ (297; слово владельца 2026-09-25: «каждый AGI ITEM наследует дизайн»).
  // Элемент, объявивший в паспорте `settings.owns: DESIGN-CONFIG`, получает текущее оформление сайта, если своего файла
  // ещё нет. ✗ Измерено: новый элемент «Блоки» рисовался оформлением по умолчанию — ядро рассылает дизайн только при
  // сохранении, и до первого сохранения элемент выпадал из проекта. Свой файл не перезаписывается никогда.
  if (entry.id !== 'root' && Array.isArray(props.settings?.owns) && props.settings.owns.includes('DESIGN-CONFIG')) {
    const own = join(dir, 'DESIGN-CONFIG', 'design-config.json')
    const site = registry.services.find((x) => x.id === 'root')
    const from = site ? join(entryDir(site), 'DESIGN-CONFIG', 'design-config.json') : null
    if (!existsSync(own) && from && existsSync(from)) {
      mkdirSync(dirname(own), { recursive: true })
      cpSync(from, own)
      say('  оформление проекта взято у сайта (DESIGN-CONFIG)')
    }
  }

  // 5. Файл окружения — С ИМЕНЕМ, КОТОРОЕ НАЗВАЛ САМ БЛОК.
  const envName = props.env?.file
  if (!envName) {
    say('  ОШИБКА: паспорт не называет env.file — установщик не станет угадывать имя файла окружения')
    failed += 1
    continue
  }
  const exampleName = props.env?.example ?? '.env.example'
  const examplePath = join(dir, exampleName)
  if (!existsSync(examplePath)) {
    say(`  ОШИБКА: нет ${exampleName} — список вопросов отсутствует`)
    failed += 1
    continue
  }

  const vars = parseExample(readFileSync(examplePath, 'utf8'))

  // 🛑 ПУСТОЙ РАЗБОР — ЭТО ОТКАЗ, А НЕ «ВОПРОСОВ НЕТ». Блок, у которого есть
  // `.env.example`, обязан объявить хотя бы одну переменную; ноль означает, что
  // сломался разбор, а не что настраивать нечего. Без этой проверки установщик
  // пишет пустой файл окружения и рапортует об успехе — служба поднимается с
  // умолчаниями, включая отсутствующий ключ, и выглядит рабочей.
  if (vars.length === 0) {
    say(`  ОШИБКА: в ${exampleName} не разобрано ни одной переменной. ` +
        'Либо файл пуст, либо сломан разбор — в обоих случаях писать окружение нельзя.')
    failed += 1
    continue
  }

  const ctx = { port, id: entry.id, props, nodePort, dir }
  // 340-4 / 341-1: набор языков, язык по умолчанию и разблокированные для поисковиков — `elementLanguages`: свой APP-CONFIG
  // элемента, а у подключённого к CONFIG — поверх него копия настроек проекта.

  const lines = [
    '# ПОРОЖДЁННЫЙ ФАЙЛ. Его пишет `npm run services:install` узла AGI.',
    '#',
    '# 🛑 ПРАВКА ЗДЕСЬ ЖИВЁТ ДО СЛЕДУЮЩЕЙ УСТАНОВКИ И ИСЧЕЗАЕТ МОЛЧА.',
    '# Настройки меняются в составе узла (AGI-ITEMS-CONFIG/agi-items.json) и в паспорте элемента,',
    '# а не здесь. Исключение — чужие ключи: их вписывают сюда, потому что',
    '# установщик их не выдумывает.',
    `#`,
    `# блок: ${entry.id} · версия: ${version} · порт: ${port}`,
    `# порождён: ${new Date().toISOString()}`,
    '',
  ]

  for (const v of vars) {
    if (v.kind === 'secret') {
      lines.push(`${v.name}=${sharedSecret(v.name)}`)
    } else if (v.kind === 'own') {
      const kept = readEnvFile(join(dir, envName)).get(v.name)
      // 324-9: набор языков, выбранный на странице «Настройки сайта» элемента (его APP-CONFIG → `languages`), сильнее
      // прежнего значения: набор вшивается при сборке, и пересборка обязана взять выбор человека. Нет записи — как было.
      const chosen = elementLanguages(dir, entry.id, ROOT)
      if (chosen && v.name === 'NEXT_PUBLIC_SUPPORTED_LANGUAGES') lines.push(`${v.name}=${chosen.supported.join(',')}`)
      else if (chosen && v.name === 'NEXT_PUBLIC_DEFAULT_LOCALE') lines.push(`${v.name}=${chosen.default}`)
      // 340-4: записи `indexed` нет — прежнее значение остаётся (как у остальных своих переменных).
      else if (chosen?.indexed && v.name === 'NEXT_PUBLIC_INDEXED_LANGUAGES') lines.push(`${v.name}=${chosen.indexed.join(',')}`)
      else lines.push(`${v.name}=${kept !== undefined ? kept : v.example}`)
    } else if (v.kind === 'foreign') {
      const kept = readEnvFile(join(dir, envName)).get(v.name)
      if (kept && kept.trim() !== '') {
        // 🔒 Чужой ключ, однажды введённый человеком, ПЕРЕЖИВАЕТ переустановку.
        // Иначе установка стирала бы работу человека, и он вводил бы ключ снова.
        lines.push(`${v.name}=${kept}`)
      } else {
        lines.push(`${v.name}=`)
        missingForeign.push({ id: entry.id, name: v.name, file: join(dir, envName) })
      }
    } else {
      lines.push(`${v.name}=${derivedValue(v.name, ctx)}`)
    }
  }

  // 🔒 ДОМЕН ДОПИСЫВАЕТ ТО, ЧЕГО БЛОК НЕ ОБЪЯВИЛ (259-8): `AUTH_TRUST_HOST` не
  // стоит в `.env.example` службы входа, а без него за туннелем она отвечает 500.
  // Дописываются только блоку, который объявил `NEXTAUTH_URL`, — то есть входу.
  if (vars.some((v) => v.name === 'NEXTAUTH_URL')) {
    const domain = authEnvOverrides(ROOT, [])
    for (const [name, value] of Object.entries(domain || {})) {
      if (!vars.some((v) => v.name === name)) lines.push(`${name}=${value}`)
    }
  }

  // 🔒 ЧТО ВПИСАЛ ЧЕЛОВЕК ИЛИ ЭКРАН УЗЛА, ПЕРЕЖИВАЕТ ПЕРЕУСТАНОВКУ, ДАЖЕ ЕСЛИ БЛОК ЭТОГО НЕ ОБЪЯВИЛ
  // (265-6). Ключи Google и Resend экраны пишут сюда же (`lib/domain/auth-env.ts`), а в `.env.example`
  // службы входа их нет. ✗ Оплачено: переустановка 2026-09-22 18:09Z переписала файл по списку
  // объявленных и молча стёрла ключи Google — вход через Google выключился, экран показал «не задано».
  const written = new Set(lines.map((l) => l.split('=')[0]))
  for (const [name, value] of readEnvFile(join(dir, envName))) {
    if (!written.has(name) && value.trim() !== '') lines.push(`${name}=${value}`)
  }

  const envText = lines.join('\n') + '\n'
  writeFileSync(join(dir, envName), envText, 'utf8')
  say(`  ${envName} написан (${vars.length} переменных)`)

  // Отпечаток окружения БЕЗ строки времени: иначе он меняется каждый прогон, и
  // отметка перестала бы отличать настоящую правку от повторного зова.
  const envFingerprint = createHash('sha256')
    .update(envText.split('\n').filter((l) => !l.startsWith('# порождён:')).join('\n'))
    .digest('hex')
    .slice(0, 16)

  if (props.runtime?.build) {
    // 🛑 «СОБРАНО» — ЭТО ФАЙЛ СЕРВЕРА, А НЕ ПАПКА `.next` (265-6). ✗ Оплачено: сборка, прерванная
    // на Windows `EBUSY`, стёрла standalone-сервер и оставила `.next`; следующий прогон счёл блок
    // собранным и ответил «нечем запускать».
    const server = stamp.start?.args?.[0]
    const built = server ? existsSync(join(stamp.start.cwd || dir, server)) : existsSync(join(dir, '.next'))
    if (built && !FORCE && !REBUILD && stamp.version === version && stamp.env === envFingerprint) {
      say('  сборка на месте (версия и окружение те же) — пропущена')
    } else {
      // 🔒 СБОРКА БЕЗ ПРОСТОЯ (280-9, слово владельца 2026-09-24: «blue/green build without downtime»).
      // Элемент, объявивший в паспорте `runtime.distDirEnv`, собирается В СОСЕДНЮЮ ПАПКУ (.next-a /
      // .next-b попеременно), пока работает прежняя сборка: процесс не останавливается, EBUSY не
      // возникает — сборка не трогает файлы, которые держит сервер. Провал оставляет прежнюю версию
      // работать нетронутой. Успех — отметка переключается на новую папку, процесс перезапускается
      // (секунды), старая папка удаляется после перезапуска.
      const distEnv = props.runtime?.distDirEnv
      if (distEnv) {
        const fromServer = server ? String(server).split(/[\\/]/)[0] : null
        // 285-4: у службы, чей старт — `server.js`, текущую папку помнит отметка.
        const current = typeof stamp.dist === 'string' && stamp.dist.startsWith('.next') ? stamp.dist : fromServer
        const target = current === '.next-a' ? '.next-b' : '.next-a'
        // Папка прошлой-прошлой сборки: обычно уже свободна; занята — next build очистит её сам.
        try { rmSync(join(dir, target), { recursive: true, force: true }) } catch { /* next build очистит */ }
        let bg = run('npm', ['run', 'build'], dir, { env: { [distEnv]: target } })
        if (bg.rc !== 0) {
          say('  сборка упала — повторяю один раз')
          bg = run('npm', ['run', 'build'], dir, { env: { [distEnv]: target } })
        }
        if (bg.rc !== 0) {
          say('  ОШИБКА сборки блока (работающая версия не тронута):')
          say(bg.out.split('\n').slice(-8).map((l) => '    ' + l).join('\n'))
          rmSync(join(dir, target), { recursive: true, force: true })
          failed += 1
          continue
        }
        builtDist = target
        if (current && current !== target && current.startsWith('.next')) retiredDists.push(join(dir, current))
        say(`  собран в ${target} без остановки службы`)
      } else {
      // 🔒 ЖИВУЮ СЛУЖБУ ОСТАНАВЛИВАЕМ И ДО ПЕРЕСБОРКИ (265-6), тем же приёмом, что до замены
      // зависимостей. ✗ Измерено 2026-09-23 дважды: сборка на Windows падала `EBUSY rmdir` на
      // `.next/standalone` — работающий сервер держит свои файлы, — и уже СТЕРЕВ сервер, не
      // записывала новый. Служба жила из памяти до первого перезапуска, после него — вход мёртв.
      for (const suffix of ['-watch', '']) {
        const name = `fractera-svc-${entry.id}${suffix}`
        if (runningAtStart.includes(name) && !stoppedByInstaller.has(name) &&
            run(pm2cmd, ['stop', name], ROOT, { quiet: true }).rc === 0) {
          stoppedByInstaller.add(name)
        }
      }
      // 🔒 ПЕРЕСБОРКА С ОТКАТОМ (280-6). ✗ Измерено 2026-09-24: пересборка сайта, запущенная правкой
      // оформления, упала на Windows `kill EPERM` (сбой воркера `next build`) — а `next build` к этому
      // моменту уже стёр `.next`. Сайту стало нечем запускаться, pm2 ушёл в вечный рестарт, и корень
      // домена лежал ~18 минут. Поэтому: рабочая сборка копируется ДО сборки в `data/services/<id>/`
      // (вне дерева элемента и вне git); провал — одна повторная попытка; снова провал — сборка
      // возвращается на место, и элемент поднимается прежним.
      const standaloneDir = server ? dirname(join(stamp.start.cwd || dir, server)) : null
      const standaloneRoot = standaloneDir ? join(dir, '.next', 'standalone') : null
      const backup = standaloneRoot ? join(serviceDataDir(entry.id), 'standalone-prev') : null
      if (backup && built && existsSync(standaloneRoot)) {
        rmSync(backup, { recursive: true, force: true })
        cpSync(standaloneRoot, backup, { recursive: true })
      }
      let b = run('npm', ['run', 'build'], dir)
      if (b.rc !== 0) {
        say('  сборка упала — повторяю один раз')
        b = run('npm', ['run', 'build'], dir)
      }
      if (b.rc !== 0) {
        say('  ОШИБКА сборки блока:')
        say(b.out.split('\n').slice(-8).map((l) => '    ' + l).join('\n'))
        if (backup && existsSync(backup)) {
          rmSync(standaloneRoot, { recursive: true, force: true })
          cpSync(backup, standaloneRoot, { recursive: true })
          say('  прежняя сборка возвращена на место — элемент поднимется ею')
        }
        failed += 1
        continue
      }
      say('  собран')
      }
    }
  }

  // 6. ЧЕМ ЭТУ СЛУЖБУ ЗАПУСКАТЬ — выясняется здесь и записывается в отметку.
  //
  // 🔒 ЭТО МАШИННЫЙ ФАКТ, И ПОТОМУ ЕМУ НЕ МЕСТО В ПАСПОРТЕ. Паспорт принадлежит
  // службе и одинаков у всех, кто её поставил; путь к собранному серверу зависит
  // от того, как Next вывел корень трассировки НА ЭТОЙ машине. Измерено: из-за
  // соседнего package-lock.json узла standalone-сервер авторизации уехал в
  // `.next/standalone/AGI-ITEMS/core/auth/server.js`, а не в корень standalone.
  //
  // 🛑 И ВТОРОЕ, ЧЕГО NEXT НЕ ДЕЛАЕТ САМ: статику в standalone он не копирует.
  // Без этого страницы рисуются, а КАЖДЫЙ стиль и скрипт отдают 404 — снаружи
  // это выглядит «сломалась вёрстка», а не «не доделана упаковка».
  const start = resolveStart(dir, props, builtDist ?? currentDist(stamp))
  if (builtDist && start) say(`  ${await warmUp(start, props.health?.path)}`)
  if (!start) {
    say('  ОШИБКА: нечем запускать — не нашёл ни standalone-сервера, ни простой команды старта')
    failed += 1
    continue
  }
  say(`  запуск: ${start.cmd} ${start.args.join(' ')}`)

  writeFileSync(stampFile, JSON.stringify({
    version: version,
    env: envFingerprint,
    lockHash,
    port,
    start,
    // 285-4: папка текущей сборки — для служб, чей старт не называет её путём (Express со встроенным Next).
    ...(props.runtime?.distDirEnv ? { dist: builtDist ?? currentDist(stamp) } : {}),
    health: props.health?.path ?? null,
    at: new Date().toISOString(),
  }, null, 2), 'utf8')

  summary.push({ id: entry.id, version: version, port, stack: props.runtime?.stack })
}

// ── 6. Фактические порты — обратно в реестр ──────────────────────────────────
writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n', 'utf8')

// ── 7. NEXT_PUBLIC_* узла — единственное вынужденное исключение ──────────────
//
// 🔒 Браузер реестра не читает, а эти значения запекаются в бандл при сборке.
// Поэтому они — производное от реестра, и в шапке файла это сказано словами.
const authPort = registry.services.find((s) => s.id === 'auth')?.port
const dataPort = registry.services.find((s) => s.id === 'data')?.port
if (Number.isInteger(authPort)) newNodeVars.set('NEXT_PUBLIC_AUTH_URL', `http://127.0.0.1:${authPort}`)
if (Number.isInteger(dataPort)) newNodeVars.set('NEXT_PUBLIC_MEDIA_URL', `http://127.0.0.1:${dataPort}`)

if (newNodeVars.size > 0) {
  const existing = existsSync(NODE_ENV_FILE) ? readFileSync(NODE_ENV_FILE, 'utf8') : ''
  let text = existing
  const header = '\n# ─── ПРОИЗВОДНОЕ ОТ agi-items.json — пишет npm run services:install ───\n' +
    '# Правка здесь держится до следующей установки. Источник — реестр состава.\n' +
    '# NEXT_PUBLIC_* стоят тут вынужденно: браузер реестра не читает, а эти\n' +
    '# значения запекаются в бандл на сборке — значит после установки нужна пересборка.\n'
  if (!text.includes('ПРОИЗВОДНОЕ ОТ agi-items.json')) text += header
  for (const [k, v] of newNodeVars) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    if (re.test(text)) text = text.replace(re, `${k}=${v}`)
    else text += `${k}=${v}\n`
  }
  mkdirSync(dirname(NODE_ENV_FILE), { recursive: true })
  writeFileSync(NODE_ENV_FILE, text, 'utf8')
  say(`\n  .env.local узла: обновлено переменных — ${newNodeVars.size}`)
}

// ── 8. Обновить живущие процессы, если они уже запущены ──────────────────────
//
// 🛑 `pm2 delete` + `pm2 start`, А НЕ `restart`. pm2 ХРАНИТ ОКРУЖЕНИЕ ПРОЦЕССА:
// переменная, убранная из конфига, остаётся в живом процессе, и `--update-env`
// её не вычищает. Оплачено дважды за один вечер, и оба раза выглядело как
// «правка не применилась».
//
// 🔒 ЗАПУСКАЕМ ТОЛЬКО ТО, ЧТО УЖЕ БЫЛО ЗАПУЩЕНО. Установка — не команда «подними
// узел»: её зовут и на свежей машине, где сайт ещё не поднимали. Подняться
// целиком — дело `npm run serve:start`.
const running = runningAtStart

const refreshed = []
for (const s of summary) {
  for (const suffix of ['', '-watch']) {
    const name = `fractera-svc-${s.id}${suffix}`
    if (!running.includes(name)) continue
    run(pm2cmd, ['delete', name], ROOT, { quiet: true })
    const st = run(pm2cmd, ['start', 'ecosystem.config.cjs', '--only', name], ROOT, { quiet: true })
    if (st.rc === 0) refreshed.push(name)
  }
}
// Остановленное установщиком и не поднятое выше (блок упал) поднимается прежним:
// узел без службы входа хуже узла со старой службой входа.
for (const name of stoppedByInstaller) {
  if (refreshed.includes(name)) continue
  if (run(pm2cmd, ['start', name], ROOT, { quiet: true }).rc === 0) refreshed.push(name)
}
// Старая папка сборки удаляется после перезапуска. Windows отпускает файлы убитого процесса не сразу
// (✗ измерено 2026-09-24: rmSync сразу после pm2 delete уронил установщик до pm2 save) — несколько
// попыток с паузой; не вышло — папка неактивна и будет удалена перед следующей сборкой в неё.
for (const old of retiredDists) {
  let gone = false
  for (let i = 0; i < 6 && !gone; i += 1) {
    try { rmSync(old, { recursive: true, force: true }); gone = true } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000) }
  }
  if (!gone) say(`  прежняя сборка ${old} пока занята системой — удалится перед следующей сборкой`)
}
if (refreshed.length) {
  run(pm2cmd, ['save'], ROOT, { quiet: true })
  say(`\n  перезапущено с чистым окружением (delete + start): ${refreshed.join(', ')}`)
}

// ── Итог ─────────────────────────────────────────────────────────────────────
say('\n── СОСТАВ УЗЛА ПОСЛЕ УСТАНОВКИ')
for (const s of summary) say(`  ${s.id} — ${s.version} — порт ${s.port} — ${s.stack}`)

if (warn.length) { say('\n── ЗАМЕЧАНИЯ'); warn.forEach((w) => say(w)) }

if (missingForeign.length) {
  say('\n── ЧУЖИЕ КЛЮЧИ, КОТОРЫХ НЕТ. Установщик их не выдумывает.')
  for (const m of missingForeign) {
    say(`  ${m.id}: ${m.name} — впишите в ${m.file}`)
  }
  say('  Без них блок работает, но способность, которой они нужны, отвечает отказом.')
}

if (failed > 0) {
  say(`\n===SERVICES_INSTALL_FAILED=== блоков с ошибкой: ${failed}`)
  process.exit(1)
}

say('\n🛑 После установки узлу нужна ПЕРЕСБОРКА: npm run serve:rebuild — значения')
say('   NEXT_PUBLIC_* запекаются в сборку, и без неё правка не применится.')
say('===SERVICES_INSTALL_OK===')
