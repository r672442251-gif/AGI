// ИМПОРТ ПРОЕКТА НА МЕСТО AGI ITEM (шаг 374-6). `node scripts/element-import.mjs <id> <owner/name>` — зовёт дверь ядра через
// `spawn-free.mjs` (работа длится минуты: архив, скачивание, сборка; пересборка ядра не должна её убить).
//
// Слово владельца 2026-10-02: «импортировать существующей проект на место того AGI ITEM который существует сейчас. Например
// пользователь пытался сделать красивый сайт … решил купить. Приехал новый встал на место старого»; собственный ключ элемента —
// «возможность подключить сюда другой источник и его ключ и начать работать с ним»; старая история — «y» (остаётся архивом в
// прежнем репозитории).
//
// Порядок, и каждый шаг — до следующего:
//   1. АРХИВ: прежняя история уезжает в прежний репозиторий элемента (незакоммиченный остаток — коммитом «before import»). Нет
//      прежнего репозитория — отказ: иначе история пропала бы, а решение владельца — сохранить её.
//   2. Новый проект скачивается целиком в соседнюю папку ключом элемента (его кладёт дверь до запуска).
//   3. Чужой проект без паспорта получает паспорт, запускатель и файлы агента тем же кирпичом, что рождение из репозитория (367).
//   4. Служба останавливается, папки меняются местами (прежняя — в `AGI-ITEMS/.replaced/`), Windows держит файлы живого процесса.
//   5. Установщик `--only <id>` собирает и пишет окружение; служба поднимается; id, порт, адрес и домен — прежние.
// Ход — `data/services/<id>/import.json`.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import paths from '../lib/agi-items/paths.cjs'
import { syncRegistryMap } from '../lib/agi-items/registry-map.mjs'

const ROOT = process.cwd()
const IS_WIN = process.platform === 'win32'
const [id, target] = process.argv.slice(2)
const stateFile = join(ROOT, 'data', 'services', id ?? '_', 'import.json')
const ghDir = join(ROOT, 'data', 'services', id ?? '_', 'github')
const startedAt = new Date().toISOString()

function save(state, extra = {}) {
  mkdirSync(dirname(stateFile), { recursive: true })
  writeFileSync(stateFile, JSON.stringify({ state, target, startedAt, at: new Date().toISOString(), ...extra }, null, 2) + '\n', 'utf8')
}
function fail(reason) {
  save('failed', { reason })
  console.error(`===IMPORT_FAILED=== ${reason}`)
  process.exit(1)
}
function git(args, cwd) {
  const r = spawnSync('git', ['-c', 'credential.helper=', ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 300_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  return { rc: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}
function readToken(file) {
  try {
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GITHUB_TOKEN='))
    return line?.slice('GITHUB_TOKEN='.length).trim() || null
  } catch { return null }
}
// 🛑 Чистое окружение (351): импорт зовёт дверь ядра (сервер Next) — без чистки элемент получил бы `__NEXT_PROCESSED_ENV` ядра и не
// прочитал бы свой `.env.local`. То же для установщика.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !(k.startsWith('__NEXT') || k.startsWith('NEXT_') || k.startsWith('AGI_') || k === 'PORT' || k === 'HOSTNAME' || k === 'NODE_ENV')))
const pm2 = (args) => spawnSync(IS_WIN ? 'pm2.cmd' : 'pm2', args, { cwd: ROOT, encoding: 'utf8', shell: IS_WIN, windowsHide: true, env: cleanEnv })

if (!id || !/^[a-z][a-z0-9-]{0,39}$/.test(id) || !target || !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(target)) {
  console.error('===IMPORT_FAILED=== usage: node scripts/element-import.mjs <id> <owner/name>')
  process.exit(1)
}
const registry = JSON.parse(readFileSync(paths.REGISTRY_FILE, 'utf8'))
const entry = registry.services.find((e) => e.id === id)
if (!entry) fail('элемента нет в реестре')
const dir = paths.entryDir(entry)
if (!existsSync(join(dir, '.git'))) fail('у элемента нет папки с историей')

// 1. Архив.
save('archiving')
let state = {}
try { state = JSON.parse(readFileSync(join(ghDir, 'state.json'), 'utf8')) } catch { /* нет связи */ }
// 384-5: `--typed` — человек ввёл токен (он уже лежит своим токеном элемента, прежний — в `.env.previous`); без него токен — по
// порядку «свой элемента → общий узла», а публичный репозиторий скачивается и без токена. `--detach` — токен не пишет в источник:
// после замены элемент от него отвязан (план 384 «отвязать», подтверждён владельцем 2026-10-03).
const typed = process.argv.includes('--typed')
const detach = process.argv.includes('--detach')
const nodeToken = readToken(join(ROOT, 'data', 'node', 'github', '.env'))
const importToken = typed ? readToken(join(ghDir, '.env')) : readToken(join(ghDir, '.env')) || nodeToken
const oldToken = (typed ? readToken(join(ghDir, '.env.previous')) : readToken(join(ghDir, '.env'))) || nodeToken || importToken
if (!state.repo || state.repo === target) fail('у элемента нет прежнего репозитория — сначала создайте его («Создать репозитории»), иначе прежняя история пропадёт')
if (!oldToken) fail('нет ключа, которым выгрузить прежнюю историю')
const ident = ['-c', 'user.name=Fractera node', '-c', 'user.email=node@fractera.local']
if (git(['status', '--porcelain'], dir).out.trim()) {
  git(['add', '-A', '--', '.', ':(exclude)tsconfig.json'], dir)
  git([...ident, 'commit', '--quiet', '-m', `before import of ${target}`], dir)
}
const arch = git(['push', `https://x-access-token:${oldToken}@github.com/${state.repo}.git`, 'HEAD:refs/heads/main'], dir)
if (arch.rc !== 0) fail(`прежняя история не выгружена в ${state.repo} — импорт остановлен, ничего не тронуто`)

// 2. Новый проект.
save('downloading')
const tmp = `${dir}.import-${Date.now()}`
const from = importToken ? `https://x-access-token:${importToken}@github.com/${target}.git` : `https://github.com/${target}.git`
const c = git(['clone', '--quiet', from, tmp], ROOT)
if (c.rc !== 0) fail(`репозиторий ${target} не скачан (токен не видит его или сети нет)`)
// Введённый токен не пишет в источник — он был нужен только чтобы скачать: элементу возвращается прежний свой токен (или общий узла),
// иначе «Создать и выгрузить» создало бы репозиторий в чужом аккаунте этого токена.
if (detach && typed) {
  const prev = join(ghDir, '.env.previous')
  if (existsSync(prev)) renameSync(prev, join(ghDir, '.env'))
  else rmSync(join(ghDir, '.env'), { force: true })
}
git(['remote', 'set-url', 'origin', `https://github.com/${target}.git`], tmp)

// 3. Паспорт чужому проекту.
if (!existsSync(join(tmp, 'OWN-SERVICE-PROPS.json'))) {
  const { prepareRepoElement } = await import('./repo-element.mjs')
  let template = null
  try { template = JSON.parse(readFileSync(join(ROOT, 'AGI-ITEMS-REGISTRY', 'item-template.json'), 'utf8')) } catch { /* шаблона нет */ }
  const r = prepareRepoElement({ dir: tmp, id, template, root: ROOT, git: (args, cwd) => git(args, cwd) })
  if (!r.ok) fail(`проект не распознан: ${r.reason}`)
}
{
  const propsFile = join(tmp, 'OWN-SERVICE-PROPS.json')
  const props = JSON.parse(readFileSync(propsFile, 'utf8'))
  props.id = id
  props.name = id
  writeFileSync(propsFile, JSON.stringify(props, null, 2) + '\n', 'utf8')
  if (git(['status', '--porcelain'], tmp).out.trim()) {
    git(['add', '-A'], tmp)
    git([...ident, 'commit', '--quiet', '-m', 'Fractera: element files (passport, launcher, agent instruction)'], tmp)
  }
}

// 4. Смена папок при остановленной службе.
save('swapping')
const names = [`fractera-svc-${id}`, `fractera-svc-${id}-watch`]
for (const n of names) pm2(['stop', n])
const trash = join(paths.ITEMS_DIR, '.replaced', `${id}-${Date.now()}`)
mkdirSync(dirname(trash), { recursive: true })
try {
  renameSync(dir, trash)
} catch (e) {
  for (const n of names) pm2(['start', n])
  fail(`папку элемента держит процесс (${e.code ?? e.message}) — закройте терминал элемента и повторите`)
}
renameSync(tmp, dir)
mkdirSync(ghDir, { recursive: true })
// Отвязан — `repo` нет: полоса 382 назовёт элемент, «Создать и выгрузить» даст ему свой репозиторий; откуда код — `importedFrom`.
writeFileSync(join(ghDir, 'state.json'), JSON.stringify(detach
  ? { importedFrom: target, importedAt: new Date().toISOString(), previous: state.repo }
  : { repo: target, importedAt: new Date().toISOString(), previous: state.repo }, null, 2) + '\n', 'utf8')
// Реестр: элемент теперь живёт из нового репозитория — для установщика он самостоятельный (не переводится на тег Fractera).
if (!entry.born) entry.born = { from: 'repository', url: `https://github.com/${target}.git`, version: 'repo', at: new Date().toISOString() }
else entry.born = { ...entry.born, from: 'repository', url: `https://github.com/${target}.git`, version: 'repo' }
writeFileSync(paths.REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n', 'utf8')
syncRegistryMap(ROOT)

// 5. Сборка и запуск.
save('building', { previous: state.repo, replacedFolder: trash })
const inst = spawnSync(process.execPath, [join(ROOT, 'scripts', 'services-install.mjs'), '--only', id], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 1_800_000, env: cleanEnv })
const ok = /===SERVICES_INSTALL_OK===/.test(`${inst.stdout ?? ''}`)
for (const n of names) pm2(['start', 'ecosystem.config.cjs', '--only', n])
pm2(['save'])
if (!ok) fail('новый проект не собрался — прежняя версия лежит в AGI-ITEMS/.replaced и в прежнем репозитории; журнал — в выводе установщика')
save('done', { previous: state.repo, replacedFolder: trash, detached: detach })
console.log(`===IMPORT_OK=== ${id} ← ${target} (прежняя история — ${state.repo})${detach ? ' — отвязан от источника' : ''}`)
