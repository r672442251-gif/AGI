// РОЖДЕНИЕ ЭЛЕМЕНТА ИЗ ШАБЛОНА (узел, шаг 319-1). Запуск из корня узла: `npm run items:birth -- <id>`.
//
// 🎯 Слово владельца 2026-09-27: «стартер Fractera item starter скачивался [из] репозитория Fractera, но при этом чтобы была
// возможность пользователя … сохранить его обновлённую версию на своем гит хаб». Отсюда устройство:
//   1. черновик `<id>` (кнопка «Создать микросервис», 314-1) — единственный вход: рождается только то, что человек завёл;
//   2. шаблон берётся по ЗАКРЕПЛЁННОМУ тегу из `AGI-ITEMS-CONFIG/item-template.json` в `AGI-ITEMS/user/<id>`;
//   3. история шаблона отрезается: у элемента своя история с первым коммитом «born from …» и НЕТ `origin` шаблона —
//      это самостоятельный проект; в GitHub человека он уходит позже кнопкой (319-5);
//   4. паспорт `OWN-SERVICE-PROPS.json` получает `id` элемента — все имена элемент читает оттуда;
//   5. запись реестра с полем `born`: установщик и `serve.mjs` такую папку не клонируют и не переводят на тег (иначе
//      следующая установка стёрла бы работу агента); `repo`/`version` — правда о происхождении (их требует сторож реестра);
//   6. дальше — ТОТ ЖЕ путь, что установка службы: `services-install.mjs --only <id>` (порт, `.env`, сборка);
//   7. запуск службы и сторожа в pm2 + `pm2 save` (установщик новые службы не поднимает) и ожидание `/api/health` по факту.
//
// 🔒 Процессы — `windowsHide: true` (закон 2026-09-18). Ничего не делается само: прибор запускает человек (или кнопка 319-3).
// 🔒 Отказ до записи реестра не оставляет следов; отказ сборки оставляет папку и запись — повтор одной командой (печатается).

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { REGISTRY_FILE, itemDir, entryDir } = require('../lib/agi-items/paths.cjs')

const ROOT = process.cwd()
const DRAFTS_FILE = join(ROOT, 'data', 'agi-drafts.json')
const TEMPLATE_FILE = join(ROOT, 'AGI-ITEMS-CONFIG', 'item-template.json')
const ID = /^[a-z][a-z0-9]{4,23}$/
const t0 = Date.now()
const say = (m) => console.log(m)
const stage = (m) => say(`[${((Date.now() - t0) / 1000).toFixed(1)} с] ${m}`)

function fail(reason, cleanDir = null) {
  if (cleanDir && existsSync(cleanDir)) rmSync(cleanDir, { recursive: true, force: true })
  say(`===BIRTH_FAILED=== ${reason}`)
  process.exit(1)
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  return { rc: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const id = process.argv[2]
if (!id || !ID.test(id)) fail(`имя «${id ?? ''}» — не имя черновика (буква, затем 4–23 строчных латинских или цифр)`)
// 367: облик — ответ человека в окне рождения (`--look project|own`); вызов из командной строки без него — «как проект» (как до 367).
const lookAt = process.argv.indexOf('--look')
const look = lookAt > 0 ? process.argv[lookAt + 1] : 'project'
if (look !== 'project' && look !== 'own') fail(`облик «${look ?? ''}» — не из списка: project | own`)

// 1. Черновик существует и ещё не родился.
let drafts = []
try { drafts = JSON.parse(readFileSync(DRAFTS_FILE, 'utf8')).drafts ?? [] } catch { /* нет файла — нет черновиков */ }
if (!drafts.some((d) => d?.id === id)) fail(`черновика «${id}» нет — рождается только то, что заведено кнопкой «Создать AGI ITEM»`)

const registry = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8'))
if (registry.services.some((s) => s.id === id)) fail(`«${id}» уже есть в реестре узла — второй раз не рождается`)

const dir = itemDir(id, 'user')
if (existsSync(dir)) fail(`папка ${dir} уже существует — рождение не пишет поверх чужих файлов`)

const template = JSON.parse(readFileSync(TEMPLATE_FILE, 'utf8'))
// 367-4 (владелец 2026-10-01: «старт из своего репозитория введите ссылку на репозиторий»; «Агентские файлы добавляй, агента только
// по кнопке»): самостоятельный элемент из репозитория человека. Источник ниже — `origin` — и есть правда о происхождении.
const repoAt = process.argv.indexOf('--repo')
const repoUrl = repoAt > 0 ? process.argv[repoAt + 1] : null
if (repoUrl && look !== 'own') fail('элемент из своего репозитория рождается только самостоятельным')
if (repoUrl && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?\/?$/.test(repoUrl)) fail(`адрес репозитория «${repoUrl}» — не https://хост/владелец/имя`)
// 367-5: только ваш репозиторий — владелец совпадает с аккаунтом узла (`lib/agi-items/repo-owner.mjs`; та же проверка в двери).
let repoOwned = null
if (repoUrl) {
  const { checkRepoOwner } = await import('../lib/agi-items/repo-owner.mjs')
  repoOwned = checkRepoOwner(repoUrl, ROOT)
  if (!repoOwned.ok) fail(repoOwned.message)
}
const origin = repoUrl ? { from: 'repository', version: repoUrl } : template
stage(`рождаю «${id}» из ${origin.from} ${origin.version}`)

// 2. Код: шаблон по закреплённому тегу — или репозиторий человека целиком, с его историей.
const clone = repoUrl
  ? git(['clone', '--quiet', repoUrl, dir], ROOT)
  : git(['clone', '--quiet', '--depth', '1', '--branch', template.version, template.repo, dir], ROOT)
if (clone.rc !== 0) fail(`${repoUrl ? 'репозиторий' : 'шаблон'} не скачан: ${clone.out.trim().split('\n').slice(-1)[0]}`, dir)
stage(repoUrl ? 'репозиторий скачан' : 'шаблон скачан')

// 3. Своя история вместо истории шаблона (у репозитория человека история его — остаётся).
if (!repoUrl) rmSync(join(dir, '.git'), { recursive: true, force: true })
if (repoUrl) {
  const { prepareRepoElement } = await import('./repo-element.mjs')
  const r = prepareRepoElement({ dir, id, template, root: ROOT, git })
  if (!r.ok) fail(r.reason, dir)
  stage(`проект распознан: ${r.kind} — паспорт, запускатель и файлы агента добавлены`)
}

// 4. Паспорт.
const propsFile = join(dir, 'OWN-SERVICE-PROPS.json')
if (!existsSync(propsFile)) fail('в шаблоне нет OWN-SERVICE-PROPS.json — элементу не у кого спросить своё имя', dir)
const props = JSON.parse(readFileSync(propsFile, 'utf8'))
props.id = id
props.name = id
// 325-1: СВОЁ ОПИСАНИЕ, А НЕ ШАБЛОННОЕ. ✗ Замерено: рождённый `as8kp` описывал себя словами шаблона («The template of a node
// element…»). Первичная запись говорит, кто это и откуда; что элемент умеет, пишет его агент (Настройки → Описание, 325-2).
props.summary = `AGI element ${id}, born from ${origin.from} ${origin.version} on ${new Date().toISOString().slice(0, 10)}. Its capabilities are written by its agent from Settings → Capabilities description.`
writeFileSync(propsFile, JSON.stringify(props, null, 2) + '\n', 'utf8')

// 4б. ЭЛЕМЕНТ РОЖДАЕТСЯ В ОБЛИКЕ ПРОЕКТА (слово владельца 2026-10-01: «стартовый шаблон … по дефолту должен сразу подключиться к
// настройкам всего проекта … если у меня даже страницы архитектора и авторизации жёлтые то и новый проект должен покраситься сразу»).
// ✗ Замерено кодом: шаблон приезжает со своим `DESIGN-CONFIG`, поэтому шаг 4а установщика («если своего файла ещё нет») его
// пропускал, а копию CONFIG элемент забирал только при запуске — ПОСЛЕ первой сборки: первая сборка выходила цветом и меню шаблона.
// Файл шаблона — не «свой файл» элемента: здесь он заменяется оформлением проекта (у сайта root, подписанного на «Дизайн»), а в
// папку данных элемента кладётся последняя копия настроек проекта (её получил root от CONFIG) — сборка читает обе. Нет root или
// его файлов — элемент рождается с файлами шаблона и догоняет проект при запуске, как прежде.
// 367 (слово владельца 2026-10-01: «тема зелёная стартер синий, в одном случае стартер приедет синий а другой зелёный»): рычаги
// `data/services/<id>/links.json` ставятся ДО установки — её и первую сборку читают те же рычаги (`linkOn` шаблона).
// `own` — файлы шаблона нетронуты, CONFIG и «Дизайн» выключены, «Блоки» включены; `project` — всё включено и облик проекта ниже.
{
  const links = join(ROOT, 'data', 'services', id, 'links.json')
  mkdirSync(dirname(links), { recursive: true })
  writeFileSync(links, JSON.stringify(look === 'own' ? { config: false, design: false, blocks: true } : { config: true, design: true, blocks: true }, null, 2) + '\n', 'utf8')
  stage(look === 'own'
    ? 'облик: самостоятельный — дизайн и настройки шаблона, связи с CONFIG и «Дизайном» выключены'
    : 'облик: как весь проект — связи с CONFIG, «Дизайном» и «Блоками» включены')
}
if (look === 'project') {
  const site = registry.services.find((x) => x.id === 'root')
  const siteDir = site ? entryDir(site) : null
  const design = siteDir ? join(siteDir, 'DESIGN-CONFIG', 'design-config.json') : null
  if (design && existsSync(design)) {
    mkdirSync(join(dir, 'DESIGN-CONFIG'), { recursive: true })
    copyFileSync(design, join(dir, 'DESIGN-CONFIG', 'design-config.json'))
    stage('оформление проекта взято у сайта (DESIGN-CONFIG)')
  }
  const copy = join(ROOT, 'data', 'services', 'root', 'project-settings.json')
  const mine = join(ROOT, 'data', 'services', id, 'project-settings.json')
  if (existsSync(copy) && !existsSync(mine)) {
    mkdirSync(dirname(mine), { recursive: true })
    copyFileSync(copy, mine)
    stage('настройки проекта (копия CONFIG) переданы элементу')
  }
}

const ident = ['-c', 'user.name=Fractera node', '-c', 'user.email=node@fractera.local']
// 367-4: у репозитория человека история его — один коммит с файлами узла поверх неё; у шаблона — своя история с нуля.
const historySteps = repoUrl
  ? [['add', '-A'], [...ident, 'commit', '--quiet', '-m', 'Fractera: element files (passport, launcher, agent instruction)']]
  : [['init', '--quiet', '-b', 'main'], ['add', '-A'], [...ident, 'commit', '--quiet', '-m', `born from ${template.from} ${template.version}`]]
for (const step of historySteps) {
  const r = git(step, dir)
  if (r.rc !== 0) fail(`своя история не заведена (git ${step.filter((a) => !a.startsWith('user.')).join(' ')}): ${r.out.trim().split('\n').slice(-1)[0]}`, dir)
}
stage(`своя история: ${git(['rev-parse', '--short', 'HEAD'], dir).out.trim()}, паспорт — «${id}»`)
// 367-5 (владелец: «сразу записываешь … этого AGI ITEM его собственный репозиторий»): адрес — в данные GitHub элемента (страница
// GitHub элемента сразу показывает репозиторий; ключ нужен только для выгрузки — его человек добавляет там же) и в окружение
// (`ELEMENT_REPO_URL`, установщик берёт из `born.url` реестра).
if (repoOwned?.ok) {
  const gh = join(ROOT, 'data', 'services', id, 'github')
  mkdirSync(gh, { recursive: true })
  writeFileSync(join(gh, 'state.json'), JSON.stringify({ repo: `${repoOwned.owner}/${repoOwned.name}` }, null, 2) + '\n', 'utf8')
  stage(`репозиторий элемента записан: ${repoOwned.owner}/${repoOwned.name}`)
}

// 5. Запись реестра.
registry.services.push({
  id,
  // Сторож реестра требует https-адрес с .git (repo-https); версия — коммит (исключение для born.from repository).
  repo: repoUrl ? `${repoUrl.endsWith('/') ? repoUrl.slice(0, -1) : repoUrl}`.replace(/\.git$/, '') + '.git' : template.repo,
  version: repoUrl ? git(['rev-parse', '--short', 'HEAD'], dir).out.trim() : template.version,
  born: repoUrl ? { from: 'repository', url: repoUrl, version: 'repo', at: new Date().toISOString() } : { from: template.from, version: template.version, at: new Date().toISOString() },
  provides: ['element-site'],
  // 333-3: навык дизайна шаблона едет в реестр с рождения (паспорт шаблона `designSkill`); дальше его обновляет «Забрать в ядро».
  ...(typeof props.designSkill === 'string' && props.designSkill ? { designSkill: props.designSkill } : {}),
  required: false,
  note: `Рождён из ${origin.from} ${origin.version} (319${repoUrl ? ', 367-4' : ''}). Самостоятельный проект: установщик его код не трогает.`,
  kind: 'user',
})
writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n', 'utf8')
stage('записан в реестр узла')

// 6. Тот же путь, что установка службы.
stage('ставлю: порт, окружение, зависимости, сборка, запуск (минуты)')
// 2026-10-01 (владелец: «после десятой секунды я не вижу больше никаких обновлений … создается впечатление что зависло»): `npm ci` и
// сборка — минуты рождения — шли молча до конца. Журнал хода установщика (тот же, что у «Развернуть», 353-3) — в ОТДЕЛЬНЫЙ файл:
// журнал рождения открыт на перезапись, второй писатель в нём затирал бы строки. Экран рождения показывает хвост этого файла.
const liveFile = join(ROOT, 'logs', `birth-${id}-live.log`)
rmSync(liveFile, { force: true })
const install = spawnSync(process.execPath, [join(ROOT, 'scripts', 'services-install.mjs'), '--only', id], { stdio: 'inherit', windowsHide: true, env: { ...process.env, FRACTERA_LIVE_LOG: liveFile } })
if (install.status !== 0) {
  say(`\nустановка не завершилась — папка и запись реестра остаются, повтор: npm run services:install -- --only ${id}`)
  say(`===BIRTH_FAILED=== установка «${id}» (код ${install.status})`)
  process.exit(1)
}
const port = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')).services.find((s) => s.id === id)?.port ?? null

// 7. Запуск. 🛑 Установщик перезапускает только то, что уже жило в pm2 (закон «Настройки и дизайн на лету»: новые службы он
// не поднимает) — рождённый элемент запускается здесь: служба и её сторож из `ecosystem.config.cjs`, затем `pm2 save`,
// чтобы элемент пережил перезагрузку машины. `.cmd` на Windows — только через оболочку и с постоянными аргументами
// (закон CVE-2024-27980); `id` уже сверен с образцом выше.
const IS_WIN = process.platform === 'win32'
const pm2 = (args) => spawnSync(IS_WIN ? 'pm2.cmd' : 'pm2', args, { cwd: ROOT, encoding: 'utf8', shell: IS_WIN, windowsHide: true })
for (const name of [`fractera-svc-${id}`, `fractera-svc-${id}-watch`]) {
  const r = pm2(['start', 'ecosystem.config.cjs', '--only', name])
  if (r.status !== 0) {
    say(`запуск ${name} не удался — повтор: pm2 start ecosystem.config.cjs --only ${name}`)
    say(`===BIRTH_FAILED=== запуск «${id}»`)
    process.exit(1)
  }
}
pm2(['save'])
stage('запущен в pm2, жду ответа элемента')

// Ждём ответ по ФАКТУ, а не паузой (закон «после pm2 reload ждать порт по факту»).
const health = JSON.parse(readFileSync(join(dir, 'OWN-SERVICE-PROPS.json'), 'utf8')).health?.path ?? '/'
let answered = 0
for (let i = 0; i < 60 && !answered; i++) {
  try {
    const r = await fetch(`http://localhost:${port}${health}`, { signal: AbortSignal.timeout(3000) })
    if (r.ok) answered = r.status
  } catch { /* ещё поднимается */ }
  if (!answered) await new Promise((res) => setTimeout(res, 1000))
}
if (!answered) {
  say(`элемент запущен, но за минуту не ответил на ${health} — журнал: logs/svc-${id}-err.log`)
  say(`===BIRTH_FAILED=== «${id}» не отвечает`)
  process.exit(1)
}
stage(`родился: порт ${port}, ${health} → ${answered}`)
// 374/379 (владелец 2026-10-02: «разработать процедуру как именно мы повторяем этот процесс с новыми когда создаем нажатием кнопку
// add AGI ITEMS»): у узла есть ключ GitHub — новорождённый получает свой приватный репозиторий той же дверью «создать недостающие»,
// что и все элементы (уже связанные она пропускает без единого запроса к GitHub; предел GitHub — та же остановка и отсчёт). Ядро —
// по петле машины, порт из logs/runtime.json. Нет ключа или ядро молчит — рождение не страдает: элемент ждёт на странице GitHub.
if (existsSync(join(ROOT, 'data', 'node', 'github', '.env'))) {
  try {
    const rt = JSON.parse(readFileSync(join(ROOT, 'logs', 'runtime.json'), 'utf8'))
    const core = `http://${typeof rt.hostname === 'string' && rt.hostname ? rt.hostname : 'localhost'}:${rt.port}`
    const r = await fetch(`${core}/api/node/github-backup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create' }), signal: AbortSignal.timeout(15_000) })
    stage(r.ok ? 'репозиторий GitHub: узел создаёт его (ход — «Строительство → GitHub»)' : `репозиторий GitHub: ядро ответило ${r.status} — создайте его кнопкой на «Строительство → GitHub»`)
  } catch {
    stage('репозиторий GitHub: ядро не ответило — создайте его кнопкой на «Строительство → GitHub»')
  }
}
say(`===BIRTH_OK=== ${id} port ${port}`)
