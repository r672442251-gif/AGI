// ПРЕДПРОСМОТР ЭЛЕМЕНТА ДО РАЗВЁРТЫВАНИЯ (узел, шаг 337-4): `node scripts/element-preview.mjs stage|promote|discard <id>`.
//
// Слово владельца 2026-09-29: «посмотреть как это выглядит до развёртывания прежде чем принять или отклонить … на странице
// развёртывания показать две кнопки: развернуть и привью». Зовёт дверь `/api/architect/items/<id>/preview` через
// `scripts/spawn-free.mjs` (вне дерева процессов ядра — перезапуск ядра его не убьёт).
//
// 🔒 ТЕ ЖЕ ПРИЁМЫ, ЧТО У УСТАНОВЩИКА (280-9), РАЗДЕЛЁННЫЕ ВО ВРЕМЕНИ. Установщик собирает в соседнюю папку, прогревает на
// запасном порту и СРАЗУ переключает. Здесь:
//   stage   — собрать в соседнюю папку и оставить сервер на запасном порту: работающая версия не тронута, её отдаёт прежний
//             адрес; новую видно только на машине узла (`127.0.0.1:<порт>`).
//   promote — «Принять»: отметка установки переводится на новую папку, служба перезапускается pm2 (секунды, без сборки).
//   discard — «Отклонить»: сервер предпросмотра гасится, папка удаляется, работающая версия как была.
// 🔒 СОСТОЯНИЕ — `data/services/<id>/preview.json`, с pid; живость измеряется при чтении (как у замка развёртывания).
// 🛑 Только у элементов со сборкой в соседнюю папку (`runtime.distDirEnv` в паспорте): у остальных сборка останавливает службу.

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import paths from '../lib/agi-items/paths.cjs'
import deployLock from '../lib/deploy/deploy-lock.cjs'
import { elementLanguages } from '../lib/agi-items/element-languages.mjs'
import { dropStaleTypes } from '../lib/deploy/stale-types.mjs'

const require = createRequire(import.meta.url)
const { isFree, PORT_BLOCK_START, blockPorts } = require('../lib/server-port.cjs')

const ROOT = join(paths.ITEMS_DIR, '..')
const IS_WIN = process.platform === 'win32'
const [action, id] = process.argv.slice(2)
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

const registry = readJson(paths.REGISTRY_FILE) ?? { services: [] }
const entry = (registry.services ?? []).find((s) => s.id === id)
if (!entry || !/^(stage|promote|discard)$/.test(action ?? '')) { console.error('usage: stage|promote|discard <id>'); process.exit(2) }
const dir = paths.entryDir(entry)
const dataDir = join(ROOT, 'data', 'services', id)
const FILE = join(dataDir, 'preview.json')
const stampFile = join(dir, '.install-stamp.json')
mkdirSync(dataDir, { recursive: true })
const save = (s) => writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n')
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e?.code === 'EPERM' } }

// Окружение машины, а не ядра: метки Next ядра заставили бы сборку элемента не читать свой `.env.local` (урок установщика).
function childEnv(extra = {}) {
  const out = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('__NEXT') || k.startsWith('NEXT_') || k.startsWith('AGI_') || k === 'PORT' || k === 'HOSTNAME' || k === 'NODE_ENV') continue
    out[k] = v
  }
  return { ...out, ...extra }
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', shell: IS_WIN, windowsHide: true, env: childEnv(env) })
  return { rc: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

// 340-4: ЯЗЫКИ ИДУТ В СБОРКУ ПРЕДПРОСМОТРА ИЗ APP-CONFIG ЭЛЕМЕНТА, А НЕ ИЗ ПРЕЖНЕГО `.env.local`.
// «Развернуть» зовёт установщик, и тот переписывает `.env.local` из APP-CONFIG (`languages`); предпросмотр установщика не
// зовёт — без этого он собирал сайт со СТАРЫМ набором языков, и кнопка «Запустить новое развёртывание» на «Настройках
// сайта» вела бы к предпросмотру, в котором изменения нет. Переменные процесса у Next сильнее `.env.local`. Выборка одна с
// установщиком — `lib/agi-items/element-languages.mjs` (341-1: у подключённого к CONFIG — поверх копия настроек проекта);
// записи нет — пусто, и сборка читает `.env.local` как прежде.
function languagesEnv() {
  const l = elementLanguages(dir, id, ROOT)
  if (!l) return {}
  const out = { NEXT_PUBLIC_SUPPORTED_LANGUAGES: l.supported.join(','), NEXT_PUBLIC_DEFAULT_LOCALE: l.default }
  if (l.indexed) out.NEXT_PUBLIC_INDEXED_LANGUAGES = l.indexed.join(',')
  return out
}

function findServer(dist) {
  const stack = [join(dir, dist, 'standalone')]
  for (let depth = 0; depth < 5 && stack.length; depth += 1) {
    const next = []
    for (const d of stack) {
      if (!existsSync(d)) continue
      if (existsSync(join(d, 'server.js'))) return d
      for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && e.name !== 'node_modules') next.push(join(d, e.name))
    }
    stack.length = 0
    stack.push(...next)
  }
  return null
}

async function freePort() {
  const taken = new Set((registry.services ?? []).map((s) => s.port).filter(Number.isInteger))
  const nodePort = readJson(join(ROOT, 'logs', 'runtime.json'))?.port ?? PORT_BLOCK_START
  // С конца блока, на шаг ниже прогрева установщика (он берёт самый верхний свободный).
  // 370: по разрешённым портам блока (без чужих умолчаний), с конца, на шаг ниже прогрева установщика.
  for (const p of blockPorts().reverse().slice(1)) {
    if (taken.has(p) || p === nodePort) continue
    if (!(await isFree(p, '127.0.0.1'))) continue
    try { if (!(await isFree(p, '::1'))) continue } catch { /* без IPv6 */ }
    return p
  }
  return null
}

function killPreview(s) {
  if (!s?.serverPid || !alive(s.serverPid)) return
  if (IS_WIN) spawnSync('taskkill', ['/PID', String(s.serverPid), '/T', '/F'], { windowsHide: true })
  else try { process.kill(s.serverPid) } catch { /* уже нет */ }
}

const pm2 = IS_WIN ? 'pm2.cmd' : 'pm2'
const stamp = readJson(stampFile)
const passport = readJson(join(dir, 'OWN-SERVICE-PROPS.json'))
const distEnv = passport?.runtime?.distDirEnv
const current = readJson(FILE)

if (action === 'stage') {
  if (!stamp || !distEnv) { save({ state: 'failed', note: 'элемент не умеет собираться в соседнюю папку — предпросмотр невозможен' }); process.exit(1) }
  if (deployLock.isRunning()) { save({ state: 'failed', note: 'идёт развёртывание — предпросмотр не начат' }); process.exit(1) }
  if (current && ((current.state === 'building' && alive(current.pid)) || current.state === 'ready')) process.exit(0)
  if (current && current.state === 'discarding' && alive(current.pid)) process.exit(0)
  const live = typeof stamp.dist === 'string' && stamp.dist.startsWith('.next') ? stamp.dist : String(stamp.start?.args?.[0] ?? '').split(/[\\/]/)[0]
  const target = live === '.next-a' ? '.next-b' : '.next-a'
  const commit = spawnSync('git', ['-C', dir, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout?.trim() || null
  // 356-2: отчёт о задаче — `TASK-REPORT.json` элемента, но только если он менялся В ЭТОМ коммите: старый отчёт к новой правке не
  // прилипает. Сайт показывает его окном по `?report=`; здесь он нужен ядру для адреса предпросмотра и блока «Что сделано».
  const git1 = (args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true }).stdout?.trim() || ''
  let report = null
  if (git1(['log', '-1', '--format=%H', '--', 'TASK-REPORT.json']) === git1(['rev-parse', 'HEAD'])) {
    const r = readJson(join(dir, 'TASK-REPORT.json'))
    if (r && typeof r.task === 'string' && r.task.trim()) {
      const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20) : [])
      const path = typeof r.path === 'string' && /^\/[\w\-/]*$|^$/.test(r.path) ? r.path : ''
      const anchor = typeof r.anchor === 'string' && /^[\w-]*$/.test(r.anchor) ? r.anchor : ''
      report = { task: r.task.slice(0, 500), done: list(r.done), check: list(r.check), path, anchor }
    }
  }
  const t0 = Date.now()
  save({ state: 'building', pid: process.pid, target, commit, startedAt: new Date().toISOString() })
  try { rmSync(join(dir, target), { recursive: true, force: true }) } catch { /* next build очистит */ }
  // 402: типы работающей сборки не должны проверяться новой (lib/deploy/stale-types.mjs).
  dropStaleTypes(dir, target)
  const buildEnv = { [distEnv]: target, ...languagesEnv() }
  // 353-3: ход сборки — в `logs/preview-<id>.log` по мере работы; страница читает хвост, пока идёт сборка.
  const liveLog = require('../lib/deploy/live-log.cjs')
  const logFile = liveLog.logPath(ROOT, 'preview', id)
  liveLog.startLog(logFile, `▶ ${new Date().toISOString()} — сборка предпросмотра ${id} (${commit ?? '—'}) в ${target}`)
  const build = () => liveLog.runLive('npm', ['run', 'build'], { cwd: dir, shell: IS_WIN, windowsHide: true, env: childEnv(buildEnv) }, logFile)
  let b = build()
  if (b.rc !== 0) b = build()
  if (b.rc === 0) writeFileSync(logFile, '■ сборка готова — запускаю сервер предпросмотра\n', { flag: 'a' })
  if (b.rc !== 0) {
    writeFileSync(logFile, '■ сборка не удалась — работает прежняя версия\n', { flag: 'a' })
    try { rmSync(join(dir, target), { recursive: true, force: true }) } catch { /* пусть лежит */ }
    save({ state: 'failed', target, commit, note: 'сборка упала: ' + b.out.split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300) })
    process.exit(1)
  }
  const server = findServer(target)
  if (!server) { save({ state: 'failed', target, commit, note: 'сборка прошла, но сервера в ней нет' }); process.exit(1) }
  if (existsSync(join(dir, target, 'static'))) cpSync(join(dir, target, 'static'), join(server, target, 'static'), { recursive: true })
  if (existsSync(join(dir, 'public'))) cpSync(join(dir, 'public'), join(server, 'public'), { recursive: true })
  const start = { cmd: 'node', args: [relative(dir, join(server, 'server.js')).split('\\').join('/')], cwd: dir }
  const port = await freePort()
  if (!port) { save({ state: 'failed', target, commit, note: 'нет свободного порта для предпросмотра' }); process.exit(1) }
  const proc = spawn(process.execPath, start.args, {
    cwd: dir, detached: true, windowsHide: true, stdio: 'ignore',
    env: childEnv({ PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' }),
  })
  proc.unref()
  const health = passport?.health?.path || '/'
  let ok = false
  for (const t1 = Date.now(); Date.now() - t1 < 180000;) {
    try { if ((await fetch(`http://127.0.0.1:${port}${health}`, { signal: AbortSignal.timeout(15000) })).status < 500) { ok = true; break } } catch { /* ещё не слушает */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  if (!ok) { killPreview({ serverPid: proc.pid }); save({ state: 'failed', target, commit, note: 'сервер предпросмотра не ответил за 3 минуты' }); process.exit(1) }
  save({ state: 'ready', target, commit, report, port, serverPid: proc.pid, start, seconds: Math.round((Date.now() - t0) / 1000), readyAt: new Date().toISOString() })
  process.exit(0)
}

if (action === 'discard') {
  // 356 (✗ 2026-10-01): «Отклонить» стирает папку предпросмотра (~1 ГБ, секунды) и запись — а «Собрать», запущенное следом, выбирало
  // ту же соседнюю папку: стирание съедало новую сборку, а удаление записи — её состояние. Пока идёт уборка — запись «discarding».
  if (current) save({ ...current, state: 'discarding', pid: process.pid })
  killPreview(current)
  if (current?.target && current.target !== stamp?.dist) try { rmSync(join(dir, current.target), { recursive: true, force: true }) } catch { /* занято — удалит следующая сборка */ }
  rmSync(FILE, { force: true })
  process.exit(0)
}

// promote — «Принять»: без сборки, только переключение на уже собранную и проверенную папку.
if (!current || current.state !== 'ready' || !stamp) { console.error('нечего принимать'); process.exit(1) }
// 353-1: ✗ 2026-09-30 21:03:49 «Принять» переключило отметку на `.next-a`, которую за секунды до этого стёрло упавшее развёртывание, —
// сайт лёг. Принимается только при тихом развёртывании и только существующая папка с сервером; иначе работающая версия не трогается.
if (deployLock.isRunning()) { console.error('идёт развёртывание — «Принять» не выполнено'); process.exit(1) }
if (!current.target || !existsSync(join(dir, current.target))) {
  killPreview(current)
  save({ state: 'failed', target: current.target, commit: current.commit, note: 'папки предпросмотра нет — принимать нечего, работает прежняя версия' })
  process.exit(1)
}
// ✗ 2026-10-01 (владелец: «нажал кнопку принять появилась красная надпись предпросмотр ошибка … ошибки-то нет»): сервер предпросмотра
// гасится здесь, а запись удаляется в конце, через секунды перезапуска pm2; дверь в этом окне видела «ready» с мёртвым сервером и
// отвечала «сервер предпросмотра погас». Теперь на время приёма запись — `promoting` с pid этого процесса.
save({ ...current, state: 'promoting', pid: process.pid })
killPreview(current)
const base = String(stamp.version ?? '').split('+')[0]
writeFileSync(stampFile, JSON.stringify({
  ...stamp,
  version: current.commit ? `${base}+${current.commit}` : stamp.version,
  start: current.start,
  dist: current.target,
  at: new Date().toISOString(),
}, null, 2), 'utf8')
const listed = spawnSync(pm2, ['jlist'], { cwd: ROOT, encoding: 'utf8', shell: IS_WIN, windowsHide: true })
let names = []
try { names = JSON.parse(listed.stdout.slice(listed.stdout.indexOf('['))).map((a) => a.name) } catch { /* pm2 молчит */ }
for (const suffix of ['', '-watch']) {
  const name = `fractera-svc-${id}${suffix}`
  if (!names.includes(name)) continue
  // 🛑 pm2 передаёт новому процессу окружение ТОГО, КТО ЕГО ЗОВЁТ. «Принять» зовёт дверь ядра — сервер Next; без чистки элемент
  // получал `__NEXT_PROCESSED_ENV=true` ядра и потому НЕ читал свой `.env.local` (✗ 2026-09-30: на aifa.dev «Войти» вела на
  // несуществующий auth.aifa.dev, `/api/core-origin` отвечал null). Тот же закон, что у установщика.
  spawnSync(pm2, ['delete', name], { cwd: ROOT, shell: IS_WIN, windowsHide: true, env: childEnv() })
  spawnSync(pm2, ['start', 'ecosystem.config.cjs', '--only', name], { cwd: ROOT, shell: IS_WIN, windowsHide: true, env: childEnv() })
}
spawnSync(pm2, ['save'], { cwd: ROOT, shell: IS_WIN, windowsHide: true, env: childEnv() })
writeFileSync(join(ROOT, 'logs', 'deploy-history.jsonl'), JSON.stringify({ id, version: `${base}+${current.commit}`, ok: true, at: new Date().toISOString(), via: 'preview' }) + '\n', { flag: 'a' })
rmSync(FILE, { force: true })
// 344-3: принятая версия уходит и в копию публичных страниц в Cloudflare (только у элемента со своим доменом).
require('../lib/agi-items/static-copy-start.cjs').startStaticCopy(ROOT, id)
process.exit(0)
