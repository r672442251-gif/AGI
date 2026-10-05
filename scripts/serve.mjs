// ТРИ КОМАНДЫ ЧЕЛОВЕКА: start · stop · status.
//
// 🔒 ЧЕЛОВЕК НЕ ДОЛЖЕН ЗНАТЬ СЛОВО «pm2». Рамка линии — пользователь, не знающий,
// что такое VS Code. Он говорит «запусти» и «останови»; чем это сделано внутри —
// наша забота, и завтра может смениться, не меняя его привычек.
//
// 🔒 ОДИНАКОВО НА WINDOWS, macOS И LINUX. Решение владельца 2026-09-18: «i need
// macos . linlx - all». Различия трёх систем собраны в одном месте — в функции
// `autostart()`, и каждое названо вслух: притворяться, что их нет, дороже, чем
// признать.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { createRequire } from 'node:module'
import paths from '../lib/agi-items/paths.cjs'
import deployLock from '../lib/deploy/deploy-lock.cjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const runtimeFile = path.join(root, 'logs', 'runtime.json')
const ecosystem = path.join(root, 'ecosystem.config.cjs')
const tunnelFile = path.join(root, 'logs', 'tunnel.json')

const isWindows = process.platform === 'win32'
const pm2 = isWindows ? 'pm2.cmd' : 'pm2'
const TASK_NAME = 'FracteraAGI'

function pm2run(args, options = {}) {
  // shell только на Windows и только потому, что node отказывается запускать
  // `.cmd` без него (EINVAL, запрет после CVE-2024-27980). Подробности — в
  // `scripts/ensure-pm2.mjs`.
  return spawnSync(pm2, args, { encoding: 'utf8', shell: isWindows, windowsHide: true, stdio: options.quiet ? 'pipe' : 'inherit' })
}

function readTunnel() {
  try {
    return JSON.parse(readFileSync(tunnelFile, "utf8"))
  } catch {
    return null
  }
}

function readRuntime() {
  try {
    return JSON.parse(readFileSync(runtimeFile, 'utf8'))
  } catch {
    return null
  }
}

function ensurePm2() {
  const result = spawnSync(process.execPath, [path.join(here, 'ensure-pm2.mjs')], {
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Обязательные элементы узла, которых на этой машине нет (280-7).
 *
 * 🔒 ЗАЧЕМ. Клон узла несёт только `AGI-ITEMS-REGISTRY/agi-items.json`: сами элементы (вход, данные,
 * сайт) приезжают установщиком из своих репозиториев по закреплённому тегу. README велит одну команду
 * — `serve:start`, — и без этой проверки человек получал ядро без входа, данных и сайта.
 * «Нет» — это нет отметки установки ИЛИ нет файла сервера, который она называет: сборка, прерванная
 * на Windows, стирала сервер и оставляла отметку (265-6).
 */
function missingElements() {
  let registry
  try {
    registry = JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8'))
  } catch {
    return []
  }
  const out = []
  for (const s of registry.services || []) {
    if (s.required !== true) continue
    let stamp = null
    try {
      stamp = JSON.parse(readFileSync(path.join(paths.entryDir(s), '.install-stamp.json'), 'utf8'))
    } catch { /* не установлен */ }
    const server = stamp?.start?.args?.[0]
    const serverOk = !server || existsSync(path.join(stamp.start.cwd || paths.entryDir(s), server))
    if (!stamp || !serverOk) out.push(s.id)
  }
  return out
}

function ensureElements() {
  const missing = missingElements()
  if (missing.length === 0) {
    console.log('элементы узла на месте — установка не нужна')
    return
  }
  console.log(`ставлю элементы узла, которых здесь нет: ${missing.join(', ')} (npm run services:install)`)
  const r = spawnSync(process.execPath, [path.join(here, 'services-install.mjs')], { stdio: 'inherit', windowsHide: true })
  if (r.status !== 0) {
    // Узел поднимается и без них: ядро покажет, чего нет, а человек увидит причину выше.
    console.error('установка элементов завершилась с ошибкой — узел запускается без них; причина напечатана выше')
  }
}

async function start() {
  // 369: не в облачной сессии Claude Code; 368: только из прямого форка оригинала Fractera — обе проверки до установки элементов.
  const local = spawnSync(process.execPath, [path.join(here, 'check-local.mjs')], { stdio: 'inherit', windowsHide: true })
  if (local.status !== 0) process.exit(1)
  spawnSync(process.execPath, [path.join(here, 'ensure-env.mjs')], { stdio: 'inherit', windowsHide: true })
  const origin = spawnSync(process.execPath, [path.join(here, 'check-origin.mjs')], { stdio: 'inherit', windowsHide: true })
  if (origin.status !== 0) process.exit(1)
  // 372-3: этот запуск ставит элементы сам — значит это первая установка (браузер откроется один раз, в конце).
  const freshInstall = missingElements().length > 0
  ensureElements()
  ensurePm2()
  // 372: бит запуска spawn-helper терминала (macOS/Linux) — и для узлов, поставленных до этой правки.
  spawnSync(process.execPath, [path.join(here, 'ensure-pty.mjs')], { stdio: 'inherit', windowsHide: true })
  // 🛑 ТУННЕЛЬ — НЕ ЗДЕСЬ (371-1, измерено 2026-10-02): `pm2 start ecosystem` целиком поднимал и перезапускал быстрый
  // туннель при КАЖДОМ запуске — адрес менялся молча, хотя `publish()` написан ровно затем, чтобы живой адрес не трогать.
  // Туннелем распоряжается только `publish()`, ниже.
  const require = createRequire(import.meta.url)
  const names = require(ecosystem).apps.map((a) => a.name).filter((n) => n !== 'fractera-agi-tunnel')
  const result = pm2run(['start', ecosystem, '--only', names.join(',')])
  if (result.status !== 0) {
    console.error('Запустить не удалось. Журнал: logs/agi-err.log')
    process.exit(1)
  }
  // Сервер поднимается не мгновенно: Next собирает страницы. Адрес берётся из
  // файла, который пишет САМ сервер, — поэтому он верен и после уступки порта;
  // ответа двери здоровья ждём по факту, а не фиксированной паузой.
  const url = await waitLocal(120000)
  if (!url) {
    console.log('\nAGI запускается. Через минуту проверьте: npm run serve:status')
    return
  }
  // 🔒 ПЕРВЫЙ ЗАПУСК САМ ВЫХОДИТ В ИНТЕРНЕТ (371-1). Слово владельца 2026-10-02: «Вся архитектура строилась на идее того
  // что сразу в момент первого запуска весь проект подключается к временному домену cloudflare» и «да, поднимай временный
  // адрес автоматически при первом запуске». 🪦 Прежний закон «выход в интернет — отдельное решение человека» отменён.
  // Человек, сам убравший сайт из интернета (`serve:unpublish`), обратно без своей команды не выводится.
  // Свой домен подключён — узел уже в интернете постоянным адресом, и временный открыл бы пульт без входа зря.
  let ownDomain = null
  try { ownDomain = JSON.parse(readFileSync(path.join(root, 'logs', 'domain.json'), 'utf8')).hostname || null } catch { /* домена нет */ }
  if (!ownDomain && !readTunnel()?.unpublished) await publish({ quietPrice: true })
  await refreshPages(url)
  await printAddresses(url, freshInstall)
}

// 🔒 ПЕРЕРИСОВАТЬ СТРАНИЦЫ ПУЛЬТА И САЙТА, КОГДА ВСЕ ЭЛЕМЕНТЫ ОТВЕЧАЮТ (371-7). ✗ Измерено на Mac 2026-10-02: пульт без шапки
// и подвала, сайт root в Preview без шапки. Причина — порядок установки: пульт собирается (`npm run build`) раньше, чем
// `serve:start` ставит сайт root, а шапку и подвал пульт берёт у root (`/api/shell`) в момент отрисовки — страницы
// предрендерились без них и жили так до первой перерисовки ISR (`revalidate = 600`): владелец увидел шапку только после
// смены языка через 10+ минут. Лечение — та же дверь, которой настройки сбрасывают кэш (`/api/revalidate`), и по два захода
// на главную каждого языка: пульт после сброса отдаёт свежую страницу сразу (MISS), сайт — сначала старую (STALE) и
// перерисовывает в фоне. Это шаг запуска, а не поведение системы: ни таймеров, ни повторов.
async function refreshPages(coreUrl) {
  let rootPort = null
  try { rootPort = (JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8')).services || []).find((s) => s.id === 'root')?.port ?? null } catch { /* реестра нет */ }
  const langs = (await ask(`${coreUrl}/api/health`)).body?.langs ?? ['en']
  const targets = [coreUrl, ...(rootPort ? [`http://localhost:${rootPort}`] : [])]
  for (const base of targets) {
    // Сайт root поднимается дольше ядра — ждём его ответа, иначе он отрисует пустую шапку ещё раз.
    for (let i = 0; i < 60 && !(await ask(`${base}/${langs[0]}`)).ok; i++) await new Promise((res) => setTimeout(res, 2000))
    try { await fetch(`${base}/api/revalidate`, { method: 'POST', signal: AbortSignal.timeout(15000) }) } catch { /* дверь не ответила — страницы перерисует ISR */ }
    for (const lang of langs) {
      await ask(`${base}/${lang}`)
      await new Promise((res) => setTimeout(res, 1500))
      await ask(`${base}/${lang}`)
    }
  }
}

// Ждёт, пока сервер узла ответит локально: адрес — из `logs/runtime.json`, ответ — дверь `/api/health`.
async function waitLocal(ms) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const runtime = readRuntime()
    if (runtime?.port) {
      const url = `http://${runtime.hostname || 'localhost'}:${runtime.port}`
      const r = await ask(`${url}/api/health`)
      if (r.ok) return url
    }
    await new Promise((res) => setTimeout(res, 2000))
  }
  return null
}

// 🔒 ТРИ АДРЕСА, У КАЖДОГО НАЗВАН АДРЕСАТ (371-1). ✗ оплачено на Mac 2026-10-02: агент отдал `localhost:24680` без
// подписи, человек ждал сайт и попал в пульт. Пульт — это ядро (на него смотрит быстрый туннель — решение владельца того
// же дня: «пусть на старте пользователь попадает в панель … без авторизации»); сайт — элемент `root` на своём порту.
async function printAddresses(coreUrl, freshInstall = false) {
  let rootPort = null
  try {
    const registry = JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8'))
    rootPort = (registry.services || []).find((s) => s.id === 'root')?.port ?? null
  } catch { /* реестра нет */ }
  const tunnel = readTunnel()
  const internet = tunnel?.url && !tunnel.dead ? tunnel.url : null
  let own = null
  let architectHost = null
  try {
    const d = JSON.parse(readFileSync(path.join(root, 'logs', 'domain.json'), 'utf8'))
    own = d.hostname || null
    architectHost = d.architectHostname || null
  } catch { /* домена нет */ }
  // 🔒 ИТОГ — ОДНА ССЫЛКА (372-3). Слово владельца 2026-10-02: «заканчивается установка и ссылка: Здесь начинается ваша
  // путешествия в мире AGI: адрес сети интернет открывающий административную панель». ✗ 371 печатал три равных адреса — человек
  // не знал, какой его. Главная строка — пульт в интернете (свой домен → `architect.<зона>`, иначе временный адрес); адреса этого
  // компьютера — ниже, справкой. Агент отдаёт человеку только главную строку (README).
  const journey = own ? `https://${architectHost || own}` : internet ?? coreUrl
  console.log('')
  console.log(`===PUBLIC_URL=== ${journey}`)
  console.log(`Здесь начинается ваше путешествие в мире AGI: ${journey}`)
  console.log(`Your journey into the world of AGI starts here: ${journey}`)
  console.log('')
  console.log('===ADDRESSES=== (справка: на этом компьютере)')
  console.log(`Пульт узла на этом компьютере: ${coreUrl}`)
  console.log(`Сайт на этом компьютере: ${rootPort ? `http://localhost:${rootPort}` : 'элемент root не установлен'}`)
  if (!own && internet) printAddressPrice()
  if (freshInstall) openOnce(journey)
}

// 🔒 ОТКРЫТЬ ССЫЛКУ В БРАУЗЕРЕ — ОДИН РАЗ, ПОСЛЕ ПЕРВОЙ УСТАНОВКИ (372-3). Слово владельца 2026-10-02: «вместо того чтобы
// показывать мне эту ссылку он сразу бы открывал её в браузере». Только один раз на узел (метка `logs/browser-opened.json`):
// повторные `serve:start` (агент перезапускает узел, автозапуск) окон не открывают. Браузер по умолчанию средствами ОС:
// macOS `open`, Windows `rundll32 url.dll,FileProtocolHandler` (без cmd — без экранирования), Linux `xdg-open`; не вышло (нет экрана, сервер без браузера) — молча, ссылка напечатана выше.
function openOnce(url) {
  const mark = path.join(root, 'logs', 'browser-opened.json')
  if (!url || existsSync(mark)) return
  try { writeFileSync(mark, JSON.stringify({ url, at: new Date().toISOString() }) + '\n') } catch { return }
  const [cmd, args] = isWindows ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  try { spawnSync(cmd, args, { stdio: 'ignore', windowsHide: true, timeout: 15000 }) } catch { /* без браузера — ссылка напечатана */ }
}

function stop() {
  // Останавливаем обоих жителей: сторож, оставленный один, перезапускал бы
  // сервер, который человек только что попросил остановить, — и выглядело бы
  // это как «кнопка не работает».
  pm2run(['stop', 'fractera-agi-watch'], { quiet: true })
  pm2run(['stop', 'fractera-agi'], { quiet: true })
  console.log('AGI остановлен. Запустить снова: npm run serve:start')
}

// ── СНЯТЬ УЗЕЛ С МАШИНЫ ЦЕЛИКОМ (371-3) ─────────────────────────────────────
//
// 🔒 ЗАЧЕМ. «Один компьютер — один узел» (369): `check-local` отказывает, пока в pm2 или в его снимке `dump.pm2` числится
// `fractera-agi` из другой папки. ✗ Оплачено на Mac 2026-10-02: узел встал не в ту папку, а команды, которая убирает его,
// не было — повторить установку можно было только ручной чисткой pm2. `serve:stop` останавливает, но снимок остаётся.
//
// 🔒 ЧТО СНИМАЕТСЯ: все процессы pm2 этого узла (ядро, сторож, оба туннеля, элементы и их сторожа) — по имени И по папке
// (рабочая папка процесса внутри папки узла: чужие процессы pm2 человека не трогаются); снимок пересохраняется
// (`pm2 save --force` — без него пустой список не пишется, и снимок продолжал бы числить узел); файл автозапуска Windows
// удаляется. 🛑 ЧЕГО НЕ ДЕЛАЕТ: не удаляет папку и данные (путь печатается — удаляет человек), не трогает Cloudflare (туннель
// и DNS своего домена остаются в аккаунте человека), не снимает `pm2 startup` на macOS/Linux (ему нужен sudo, и им могут
// пользоваться другие программы человека — без узла в снимке он не поднимает ничего нашего).
//
// 🔒 ТОЛЬКО С `--yes`: без него печатает, что будет снято, и ничего не меняет. Сайты узла перестают отвечать сразу.
function nodeApps() {
  let apps = []
  try { apps = JSON.parse(pm2run(['jlist'], { quiet: true }).stdout) } catch { apps = [] }
  const inside = (dir) => {
    if (typeof dir !== 'string' || !dir) return false
    const rel = path.relative(root, dir)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  }
  return apps.filter((a) => /^fractera-(agi|svc-)/.test(a.name) && inside(a.pm2_env?.pm_cwd ?? a.pm2_env?.cwd))
}

function remove() {
  const apps = nodeApps()
  const startupFile = isWindows
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `${TASK_NAME}.cmd`)
    : null
  console.log(`Узел в папке: ${root}`)
  console.log(`Процессы узла (${apps.length}): ${apps.map((a) => a.name).join(', ') || 'нет'}`)
  if (startupFile && existsSync(startupFile)) console.log(`Автозапуск: ${startupFile}`)
  if (!process.argv.includes('--yes')) {
    console.log('\nНичего не изменено. Снять узел с этого компьютера (сайты перестанут отвечать): npm run serve:remove -- --yes')
    return
  }
  if (deployLock.isRunning()) {
    console.error('Идёт развёртывание элемента — дождитесь его окончания и повторите.')
    process.exit(1)
  }
  // 🛑 По номеру pm2, не по имени: pm2 допускает одинаковые имена, и `delete fractera-agi` снял бы одноимённый процесс
  // другой папки (ровно случай «узел встал не туда»).
  for (const a of apps) pm2run(['delete', String(a.pm_id)], { quiet: true })
  pm2run(['save', '--force'], { quiet: true })
  // 🛑 Файл автозапуска ОДИН на учётную запись (`pm2 resurrect`), а не на папку узла. ✗ Измерено 2026-10-02: снятие пробного
  // узла рядом с живым удалило и автозапуск живого. Поэтому он удаляется, только если в pm2 не осталось ни одного ядра узла.
  let otherCore = false
  try { otherCore = JSON.parse(pm2run(['jlist'], { quiet: true }).stdout).some((a) => a.name === 'fractera-agi') } catch { otherCore = true }
  if (startupFile && existsSync(startupFile) && !otherCore) {
    try { rmSync(startupFile) } catch (error) { console.error(`Файл автозапуска не удалён: ${error.message}`) }
  }
  const left = nodeApps()
  if (left.length) {
    console.error(`Не сняты: ${left.map((a) => a.name).join(', ')}`)
    process.exit(1)
  }
  console.log(`===NODE_REMOVED=== ${root}`)
  console.log('Процессы узла сняты, автозапуск убран. Папку с проектом и его данными удалите сами, если она не нужна.')
  console.log('Туннель и записи DNS своего домена (если подключали) остаются в вашем аккаунте Cloudflare.')
}

async function status() {
  const list = pm2run(['jlist'], { quiet: true })
  let apps = []
  try {
    apps = JSON.parse(list.stdout)
  } catch {
    console.log('AGI не запущен (pm2 не отвечает или ничего не запущено).')
    return
  }

  const server = apps.find((a) => a.name === 'fractera-agi')
  const watch = apps.find((a) => a.name === 'fractera-agi-watch')

  if (!server) {
    console.log('AGI не запущен. Запустить: npm run serve:start')
    return
  }

  const runtime = readRuntime()
  const url = runtime?.port ? `http://${runtime.hostname || 'localhost'}:${runtime.port}` : null

  console.log(`процесс: ${server.pm2_env.status}, pid ${server.pid}, перезапусков ${server.pm2_env.restart_time}`)
  console.log(`сторож здоровья: ${watch ? watch.pm2_env.status : 'не запущен'}`)
  console.log(`адрес: ${url ?? 'неизвестен — сервер ещё не поднимался'}`)

  // 🔒 СОСТОЯНИЕ ПРОЦЕССА И ЖИВОСТЬ САЙТА — РАЗНЫЕ ВОПРОСЫ, И СПРАШИВАЮТСЯ ОНИ
  // ОТДЕЛЬНО. Весь шаг 232 стоит на том, что `online` ничего не обещает.
  //
  // 🔒 И СЛОВО «ЛОКАЛЬНО» ЗДЕСЬ ОБЯЗАТЕЛЬНО. ✗ оплачено 2026-09-19: строка
  // «сайт отвечает: 200» стояла рядом со строкой о публичном адресе и читалась
  // как ответ на вопрос «виден ли сайт из интернета». Сайт был виден только
  // хозяину машины, а в интернете три часа висела ошибка 1016.
  let localCommit = null
  if (url) {
    const local = await ask(`${url}/api/health`)
    localCommit = local.body?.commit ?? null
    console.log(
      local.ok
        ? `сайт отвечает локально: 200, сборка ${localCommit ?? 'неизвестна'}`
        : `⚠ процесс жив, но сайт не отвечает локально (${local.status}) — сторож перезапустит его сам`,
    )
  }

  await reportServices(apps)
  await reportInternet(apps, localCommit)
  await reportDomain(apps, localCommit)
}

// 🔒 СОСТАВ УЗЛА ПЕЧАТАЕТСЯ ИЗМЕРЕНИЕМ, А НЕ ПЕРЕСКАЗОМ РЕЕСТРА (257-5).
//
// ✗ Оплачено дважды в этом проекте: прибор, печатающий запомненное значение,
// врёт именно тогда, когда на него полагаются. Реестр говорит, КАК ЗАДУМАНО;
// сеть говорит, КАК ЕСТЬ, и расхождение между ними и есть отказ. Поэтому у
// каждого блока спрашивается его собственная дверь здоровья — та, которую он
// назвал в паспорте, — и ответ печатается рядом с состоянием процесса.
async function reportServices(apps) {
  let registry
  try {
    registry = JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8'))
  } catch {
    return // реестра нет — узлу нечего докладывать
  }
  const services = registry.services || []
  if (services.length === 0) return

  console.log('')
  console.log('сменные блоки узла:')

  for (const s of services) {
    const proc = apps.find((a) => a.name === `fractera-svc-${s.id}`)
    const watch = apps.find((a) => a.name === `fractera-svc-${s.id}-watch`)

    let stamp = null
    try {
      stamp = JSON.parse(readFileSync(path.join(paths.entryDir(s), '.install-stamp.json'), 'utf8'))
    } catch { /* не установлен */ }

    if (!stamp) {
      console.log(`  ${s.id} — ${s.version} — ОБЪЯВЛЕН, НО НЕ УСТАНОВЛЕН. Поставить: npm run services:install`)
      continue
    }

    const parts = [`${s.id} — ${s.version} — порт ${s.port ?? 'не назначен'}`]
    parts.push(`процесс: ${proc ? proc.pm2_env.status : 'не запущен'}`)
    parts.push(`сторож: ${watch ? watch.pm2_env.status : 'не запущен'}`)

    if (s.port && stamp.health) {
      const r = await ask(`http://127.0.0.1:${s.port}${stamp.health}`)
      parts.push(r.ok
        ? `дверь ${stamp.health} отвечает локально: 200`
        : `⚠ дверь ${stamp.health} НЕ отвечает (${r.status})`)
    } else {
      parts.push('дверь здоровья не объявлена — проверить нечем')
    }

    console.log('  ' + parts.join(' · '))
  }
}


// ПОСТОЯННЫЙ АДРЕС ЧЕЛОВЕКА — ОТДЕЛЬНОЙ СТРОКОЙ, И ТОЖЕ ИЗМЕРЯЕТСЯ (259-4).
//
// 🔒 У КАЖДОЙ СТРОКИ НАЗВАН АДРЕСАТ. Двусмысленная правда работает как ложь: ✗
// оплачено 2026-09-19, когда «сайт отвечает: 200» о localhost читалось как ответ
// на вопрос «виден ли сайт снаружи». Поэтому здесь сказано «свой домен», и
// проверяется он запросом ПО ЭТОМУ ИМЕНИ через интернет, а не чтением файла.
async function reportDomain(apps, localCommit) {
  let domain = null
  try { domain = JSON.parse(readFileSync(path.join(root, "logs", "domain.json"), "utf8")) } catch { /* домен не подключали */ }
  if (!domain?.hostname) {
    console.log("свой домен: не подключён (вкладка «Активация домена» в слое архитектора)")
    return
  }

  const app = apps.find((a) => a.name === "fractera-agi-domain")
  const alive = app && app.pm2_env.status === "online"
  const probe = await ask(`https://${domain.hostname}/api/health`)

  if (probe.ok) {
    console.log(`свой домен: https://${domain.hostname} — отвечает, сборка ${probe.body?.commit ?? "неизвестна"}`)
    if (localCommit && probe.body?.commit && probe.body.commit !== localCommit) {
      console.log(`⚠ по домену отвечает ДРУГАЯ сборка (${probe.body.commit}), локально — ${localCommit}`)
    }
    return
  }

  // 🛑 «ПРОЦЕСС ЖИВ» И «АДРЕС ОТВЕЧАЕТ» — РАЗНЫЕ ФАКТЫ, И РАСХОЖДЕНИЕ НАЗЫВАЕТСЯ.
  // Именно оно и есть отказ: cloudflared переживает смерть своего туннеля.
  console.log(`⚠ свой домен: https://${domain.hostname} — НЕ ОТВЕЧАЕТ (${probe.status})`)
  console.log(`⚠ житель туннеля: ${alive ? "online — процесс жив, а адрес молчит" : "не запущен"}`)
  if (!alive) console.log("⚠ поднять: npx pm2 start ecosystem.config.cjs --only fractera-agi-domain")
}
// 🔒 «РАБОТАЕТ ЛОКАЛЬНО» И «ВИДЕН ИЗ ИНТЕРНЕТА» — РАЗНЫЕ ВОПРОСЫ, И ВТОРОЙ
// ИЗМЕРЯЕТСЯ, А НЕ ВСПОМИНАЕТСЯ. Файл `logs/tunnel.json` говорит, как было
// ЗАДУМАНО; сеть говорит, как ЕСТЬ. ✗ оплачено 2026-09-19: команда печатала
// адрес из файла, пока Cloudflare отдавал по нему ошибку 1016, — прибор врал
// ровно там, где на него полагались, и простой нашёл человек, а не он.
async function reportInternet(apps, localCommit) {
  const tunnel = apps.find((a) => a.name === 'fractera-agi-tunnel')
  if (!tunnel || tunnel.pm2_env.status !== 'online') {
    console.log('в интернете: нет (включить: npm run serve:publish)')
    return
  }

  const state = readTunnel()
  if (!state?.url) {
    console.log('в интернете: адрес ещё не получен, подождите несколько секунд')
    return
  }

  const probe = await ask(`${state.url}/api/health`)

  if (probe.ok) {
    console.log(`в интернете: ${state.url} — отвечает, сборка ${probe.body?.commit ?? 'неизвестна'}`)
    // 🔒 РАЗОШЁЛСЯ ХЭШ — ЗНАЧИТ СНАРУЖИ ОТВЕЧАЕТ НЕ ТОТ ПРОЦЕСС. Тот же класс,
    // что сирота на порту: снаружи всё выглядит работающим, а показывается
    // чужая сборка. Молчать об этом нельзя.
    if (localCommit && probe.body?.commit && probe.body.commit !== localCommit) {
      console.log(`⚠ снаружи отвечает ДРУГАЯ сборка (${probe.body.commit}), локально — ${localCommit}`)
    }
  } else if (probe.status === 'имя не резолвится') {
    // Это и есть Error 1016: быстрый туннель удалён со стороны Cloudflare.
    console.log(`⚠ в интернете: ${state.url} — АДРЕС МЁРТВ (имя не резолвится)`)
    if (state.deadSince) console.log(`⚠ дозорный заметил это ${state.deadSince}`)
    console.log('⚠ сайт локально работает — это протух адрес, а не сломался сайт.')
    console.log('⚠ Вернитесь в чат и попросите агента обновить адрес сайта')
    console.log('⚠ (или выполните сами: npm run serve:publish).')
    // 🔒 Почему не поднимается сам — решение владельца 2026-09-19: адрес при
    // перезапуске всегда новый, и менять ссылку за спиной человека нельзя.
  } else {
    console.log(`⚠ в интернете: ${state.url} — не отвечает (${probe.status})`)
    console.log('⚠ сайт локально работает. Если повторится — поднимите новый адрес: npm run serve:publish')
  }

  // Смена адреса — событие для человека: по прежней ссылке кто-то уже мог
  // прийти, и она не воскреснет никогда.
  if (state.rotations > 0 && state.previousUrl) {
    console.log(`адрес менялся ${state.rotations} раз(а), последний раз ${state.rotatedAt}:`)
    console.log(`прежний ${state.previousUrl} больше не работает`)
  }
}

// Один опрос на всю команду — и для локального адреса, и для публичного. Род
// отказа различается: «имя не резолвится» значит, что туннеля больше нет, а
// таймаут значит, что он есть и молчит.
async function ask(target) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(target, { signal: controller.signal, cache: 'no-store' })
    const body = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, body }
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, status: 'таймаут', body: null }
    const text = String(error?.cause?.code || error?.code || error?.message || '')
    if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return { ok: false, status: 'имя не резолвится', body: null }
    return { ok: false, status: 'нет ответа', body: null }
  } finally {
    clearTimeout(timer)
  }
}

// ── АВТОЗАПУСК ПРИ ВКЛЮЧЕНИИ КОМПЬЮТЕРА ──────────────────────────────────────
//
// 🛑 ЗДЕСЬ ТРИ СИСТЕМЫ РАСХОДЯТСЯ, И ЭТО НЕ НАШ ВЫБОР. Способ «поднять программу
// при загрузке» принадлежит операционной системе: Linux — systemd, macOS —
// launchd, Windows — служба или Планировщик. pm2 умеет первые два сам; Windows
// он НЕ поддерживает — `pm2 startup` там отвечает отказом. Притворяться, что
// поддерживает, нельзя: человек узнал бы правду только следующей перезагрузкой.
function autostart() {
  pm2run(['save'], { quiet: true })

  if (!isWindows) {
    console.log(`Прошу ${process.platform === 'darwin' ? 'launchd' : 'systemd'} поднимать AGI при входе…`)
    const result = pm2run(['startup'])
    if (result.status !== 0) {
      console.log('\npm2 напечатал команду, которую нужно выполнить от администратора — скопируйте её выше.')
    }
    console.log('Готово. Проверить после перезагрузки: npm run serve:status')
    return
  }

  // Windows: файл в папке автозагрузки. Windows выполняет её содержимое при
  // каждом входе пользователя; `pm2 resurrect` поднимает ровно тот набор
  // процессов, который сохранил `pm2 save`.
  //
  // 🛑 ПОЧЕМУ НЕ ПЛАНИРОВЩИК ЗАДАЧ, ХОТЯ ОН ПРАВИЛЬНЕЕ ПО УЧЕБНИКУ. Измерено
  // 2026-09-18: `schtasks /create` на этой машине отвечает `Access is denied`
  // и с `/ru`, и без него — нужен терминал администратора. Человек, ставящий
  // AGI, администратором не является и не должен им становиться ради сайта на
  // своём же компьютере. Папка автозагрузки прав не требует вовсе.
  //
  // ✗ ПО ДОРОГЕ ОПЛАЧЕНО ВТОРОЕ, И ОНО ПЕРЕЖИВЁТ ЭТОТ ВЫБОР: имя учётной записи
  // нельзя собирать из `os.hostname()`. На этой машине hostname =
  // `BOLSHIYANOV-ASUSF1500`, а `USERDOMAIN` = `BOLSHIYANOV-ASU`: имя NetBIOS
  // обрезано до пятнадцати символов. Отказ «No mapping between account names and
  // security IDs» ждал бы ровно того человека, чей компьютер назван длинно.
  const startupDir = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
  )
  const startupFile = path.join(startupDir, `${TASK_NAME}.cmd`)

  // Путь к pm2 записывается ПОЛНЫЙ. При входе в систему PATH собран иначе, чем в
  // открытом терминале, и короткое имя `pm2` может не найтись — а отказ в этот
  // момент никто не увидит: окна нет.
  const pm2Path = path.join(process.env.APPDATA || '', 'npm', 'pm2.cmd')
  const pm2Call = existsSync(pm2Path) ? `"${pm2Path}"` : 'pm2'

  try {
    mkdirSync(startupDir, { recursive: true })
    writeFileSync(
      startupFile,
      ['@echo off', 'rem AGI Fractera — автозапуск при входе в систему (npm run serve:autostart)', `call ${pm2Call} resurrect`, ''].join('\r\n'),
    )
  } catch (error) {
    console.error(`Не удалось записать файл автозапуска: ${error.message}`)
    process.exit(1)
  }

  console.log(`Автозапуск включён: ${startupFile}`)
  console.log('AGI поднимется при следующем входе в систему. Проверить: npm run serve:status')
}

// ── ПЕРЕСБОРКА ───────────────────────────────────────────────────────────────
//
// 🔒 ЦЕНА ПРОДАКШНА: собранный сайт не перечитывает исходники. Поправил код —
// пересобери, иначе страница отдаёт прежнюю сборку, и это выглядит как «правка
// не применилась». В режиме разработки пересборки не нужно, но там каждая
// страница компилируется при заходе — ровно то, от чего мы ушли.
// 337-1: перезапуск ядра посреди развёртывания элемента — ✗ 2026-09-29 он оборвал развёртывание mzjce и оставил вечный
// спиннер. Развёртывание теперь живёт вне дерева ядра, но отказ на старте и ожидание перед перезапуском остаются: одна
// тяжёлая сборка за раз на машине человека.
function waitDeploy() {
  if (!deployLock.isRunning()) return
  console.log("Идёт развёртывание элемента — жду его окончания, прежде чем перезапустить сайт…")
  while (deployLock.isRunning()) spawnSync(process.execPath, ["-e", "setTimeout(()=>{},5000)"])
}

function rebuild() {
  if (deployLock.isRunning()) {
    console.error("Сейчас идёт развёртывание элемента (страница «Развёртывания»). Сборка сайта не начата: дождитесь его окончания и повторите.")
    process.exit(1)
  }
  console.log("Собираю сайт заново. Это занимает около минуты; сайт всё это время работает.")
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  })
  // 🛑 Код выхода берётся у самой сборки. ✗ оплачено в 232-1: конвейер (| tail)
  // печатает код последней команды, и упавшая сборка выглядит успешной.
  if (build.status !== 0) {
    console.error("\nСборка НЕ УДАЛАСЬ — сайт продолжает работать на прежней сборке. Ошибки выше.")
    process.exit(1)
  }
  // 🔒 СТОРОЖ ЯЗЫКОВЫХ СИГНАЛОВ — МЕЖДУ СБОРКОЙ И ПЕРЕЗАПУСКОМ (256-8).
  //
  // Место выбрано по устройству, а не по вкусу: он читает предрендеренный HTML,
  // которого в `prebuild` ещё не существует. Здесь же он оказывается последним
  // рубежом — сайт с дорвейной разметкой просто не выкладывается, и прежняя
  // сборка продолжает работать.
  //
  // 🛑 ЗАЧЕМ ОН, ЕСЛИ ЕСТЬ `check:seo` В `prebuild`. Тот читает ИСХОДНИК: зовёт ли
  // страница `buildAlternates`. Измерено 2026-09-20 — он печатал `SEO_OK`, когда в
  // отданном HTML было НОЛЬ тегов `canonical` и `hreflang`. Этот читает ФАКТ.
  const seo = spawnSync(process.execPath, [path.join(root, "scripts", "check-seo-html.mjs")], {
    cwd: root,
    stdio: "inherit",
  })
  if (seo.status !== 0) {
    console.error("\nСборка собралась, но языковые сигналы в ней противоречат друг другу —")
    console.error("сайт НЕ выложен и продолжает работать на прежней сборке. Разбор выше.")
    console.error("Это защита от ярлыка «дорвей»: набор почти одинаковых адресов,")
    console.error("обещанных поисковику, стоит сайту присутствия в выдаче целиком.")
    process.exit(1)
  }

  waitDeploy()
  console.log("\nСборка готова, перезапускаю сайт…")
  pm2run(["restart", "fractera-agi"], { quiet: true })
  console.log("Готово. Проверить: npm run serve:status")
}

// 🔒 ПРЕДУПРЕЖДЕНИЕ ГОВОРИТСЯ В МОМЕНТ ВЫДАЧИ АДРЕСА, А НЕ В МОМЕНТ ОТКАЗА —
// решение владельца 2026-09-19: «в момент когда пользователь устанавливает,
// инструкция должна ему сообщить, что домен который вы получаете является
// временным». Человек, узнавший об этом заранее, видит в ошибке Cloudflare
// понятное событие; человек, узнающий впервые, видит сломанный продукт.
//
// 🔒 ОДНА ФУНКЦИЯ, А НЕ ДВЕ КОПИИ: текст печатается и при новой публикации, и
// при повторной. Две копии расходятся молча — здесь это значило бы, что половина
// людей цену адреса не услышит.
function printAddressPrice() {
  console.log('')
  console.log('🛑 ЭТОТ АДРЕС ВРЕМЕННЫЙ. Он живёт, пока живёт туннель, и меняется при перезапуске.')
  console.log('   Однажды сайт по нему перестанет открываться, и Cloudflare покажет страницу')
  console.log('   с ошибкой 1016 или 1033. Это значит, что адрес устарел, — САЙТ ПРИ ЭТОМ ЦЕЛ')
  console.log('   и продолжает работать у вас на компьютере.')
  console.log('   Что делать: вернуться в чат и попросить агента обновить адрес сайта')
  console.log('   (или выполнить самому: npm run serve:publish -- --new).')
  console.log('   Постоянный адрес, который не протухает, — это свой домен.')
}

// 🔒 ПОВТОРНАЯ ПУБЛИКАЦИЯ НЕ МЕНЯЕТ АДРЕС — ✗ оплачено 2026-09-19 самим
// владельцем: он открыл ссылку, которую я дал ему двадцатью минутами раньше, и
// получил ошибку 1016. Адрес сменился не от отказа, а от МОЕЙ доставки: команда
// перезапускала живой и здоровый туннель при каждом вызове.
//
// 🛑 ЭТО ПОЛОВИНА ЗАКОНА ВЛАДЕЛЬЦА, ИСПОЛНЕННАЯ НЕ ДО КОНЦА. «Не трогать, только
// честно сообщать» запрещает машине менять адрес самой — а право менять его при
// каждой доставке я оставил себе. Для человека разницы нет: ссылка, которую он
// кому-то дал, перестала работать, и он об этом не знает.
//
// Поэтому: туннель жив и адрес отвечает → печатаем ТОТ ЖЕ адрес. Новый выдаётся
// только по явной просьбе — `npm run serve:publish -- --new`.
async function publish({ quietPrice = false } = {}) {
  const wantNew = process.argv.includes('--new')

  if (!wantNew) {
    const list = pm2run(['jlist'], { quiet: true })
    let apps = []
    try {
      apps = JSON.parse(list.stdout)
    } catch {
      apps = []
    }
    const tunnel = apps.find((a) => a.name === 'fractera-agi-tunnel')
    const state = readTunnel()
    if (tunnel?.pm2_env?.status === 'online' && state?.url) {
      // Спрашиваем сеть, а не файл: адрес мог умереть, пока мы не смотрели.
      const probe = await ask(`${state.url}/api/health`)
      if (probe.ok) {
        console.log(`\nСАЙТ УЖЕ В ИНТЕРНЕТЕ: ${state.url}`)
        console.log('Адрес не меняю — по нему могли уже прийти люди.')
        console.log('Нужен именно новый адрес: npm run serve:publish -- --new')
        if (!quietPrice) printAddressPrice()
        return
      }
      console.log(`Прежний адрес (${state.url}) больше не отвечает — поднимаю новый.`)
    }
  }

  // 🪦 «Публикация — отдельное решение человека» отменено владельцем 2026-10-02: первый `serve:start` зовёт эту же функцию сам (371-1).
  // Сайт при этом должен уже работать: туннель без сайта отдаёт наружу пустоту.
  //
  // 🔒 СТАРЫЙ АДРЕС УДАЛЯЕТСЯ ДО ЗАПУСКА, И ЭТО НЕ УБОРКА, А СУТЬ. ✗ оплачено
  // 2026-09-18 сразу при первой проверке: команда напечатала адрес прошлого
  // туннеля, потому что прочитала файл раньше, чем новый туннель успел его
  // переписать. Человек получил бы ссылку, отдающую 530, и решил бы, что
  // публикация сломана. Файла нет — значит ждать нечего, кроме настоящего
  // нового адреса.
  // 🛑 НО СТИРАТЬ ФАЙЛ ЦЕЛИКОМ НЕЛЬЗЯ — ✗ найдено 2026-09-19 в шаге 238 на
  // собственной работе: вместе с адресом уезжала ИСТОРИЯ адресов, и строка
  // «адрес менялся, прежний больше не работает» не печаталась никогда, хотя код
  // для неё написан. Уходит только сам адрес, память о нём остаётся.
  try {
    const previous = readTunnel()
    const stale = previous?.url || previous?.previousUrl || null
    writeFileSync(
      tunnelFile,
      JSON.stringify(
        {
          previousUrl: stale,
          rotatedAt: previous?.url ? new Date().toISOString() : (previous?.rotatedAt ?? null),
          rotations: previous?.url ? (Number(previous?.rotations) || 0) + 1 : (Number(previous?.rotations) || 0),
        },
        null,
        2,
      ),
    )
  } catch {
    /* не вышло — хуже не станет: сверка ниже всё равно ждёт поля `url`, которого нет */
  }

  // 371-8: без cloudflared туннель не поднимется — узел скачивает официальный файл Cloudflare сам (есть — ничего не делает).
  spawnSync(process.execPath, [path.join(here, 'ensure-cloudflared.mjs')], { stdio: 'inherit', windowsHide: true })

  // Живой процесс поднимается перезапуском, мёртвый — запуском. `pm2 start` на
  // уже запущенном жителе ведёт себя неочевидно, а нам нужен предсказуемый
  // новый туннель.
  const online = (() => {
    try {
      return JSON.parse(pm2run(['jlist'], { quiet: true }).stdout)
        .some((a) => a.name === 'fractera-agi-tunnel' && a.pm2_env?.status === 'online')
    } catch {
      return false
    }
  })()

  const result = online
    ? pm2run(['restart', 'fractera-agi-tunnel'], { quiet: true })
    : pm2run(['start', ecosystem, '--only', 'fractera-agi-tunnel'])
  if (result.status !== 0) {
    console.error("Не удалось открыть туннель. Журнал: logs/tunnel-err.log")
    process.exit(1)
  }
  pm2run(["save"], { quiet: true })
  console.log("Открываю адрес в интернете, это занимает несколько секунд…")
  // Адрес приходит из вывода cloudflared, поэтому ждём его появления в файле,
  // а не печатаем предположение.
  const срок = Date.now() + 30000
  while (Date.now() <= срок) {
    const адрес = readTunnel()
    if (адрес?.url) {
      console.log(`\nСАЙТ В ИНТЕРНЕТЕ: ${адрес.url}`)
      if (!quietPrice) printAddressPrice()
      return
    }
    await new Promise((res) => setTimeout(res, 1000))
  }
  console.log("Адрес пока не получен. Посмотрите: npm run serve:status")
}

function unpublish() {
  pm2run(["stop", "fractera-agi-tunnel"], { quiet: true })
  // 371-1: метка «человек сам убрал сайт» — следующий `serve:start` не выводит его в интернет без команды.
  try { writeFileSync(tunnelFile, JSON.stringify({ ...(readTunnel() ?? {}), url: null, unpublished: true }, null, 2)) } catch { /* без метки start опубликует снова */ }
  pm2run(["save"], { quiet: true })
  console.log("Сайт убран из интернета. Локально он продолжает работать.")
}

const command = process.argv[2]

if (command === 'start') await start()
else if (command === 'stop') stop()
else if (command === 'status') await status()
else if (command === 'autostart') autostart()
else if (command === 'rebuild') rebuild()
else if (command === 'publish') await publish()
else if (command === 'unpublish') unpublish()
else if (command === 'remove') remove()
// Только сказать, каких обязательных элементов нет, — ничего не ставя и не запуская (280-7).
else if (command === 'elements') {
  const missing = missingElements()
  console.log(missing.length ? `нет элементов: ${missing.join(', ')}` : 'элементы узла на месте')
}
else {
  console.log('Команды: start · stop · status · rebuild · publish · unpublish · autostart · elements · remove')
  console.log('Новый адрес в интернете вместо прежнего: publish -- --new')
  process.exit(1)
}
