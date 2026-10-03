// ПОДЛИННОСТЬ УЗЛА: ставится только ПРЯМОЙ ФОРК оригинала Fractera (шаг 368). Запуск: первым звеном `prebuild` и в `serve:start`.
//
// Слово владельца 2026-10-01: «… продвижение моего проекта … зависит от количества Форк. Если кто-то будет например продавать свои
// обновления при помощи моего стартера то это нужно сделать невозможным … хард кодом оставить проверку на соответствии того что Форк
// сделан именно из моего репозитория … в процессе установки … отказ с ошибкой … что вы пытаетесь установить неоригинальный проект
// Fractera»; «Название нашего репозитория должно быть зашито где-то в той части проекта которая будет обфусцирована».
//
// 🔒 ОРИГИНАЛ ЗАШИТ ЗДЕСЬ, а не в окружении: переменную подменил бы кто угодно. В окружение узла пишется только адрес форка
// человека (`NODE_REPO_URL`) — как факт для проекта, не для проверки.
// 🔒 ПРАВИЛО: `origin` узла — прямой форк оригинала (GitHub: fork = true, parent = оригинал). Сам оригинал без форка, форк форка,
// чужой репозиторий — отказ. GitHub не ответил — отказ «повторите позже» (решение владельца: «Не ставить, повторить позже»).
// 🔒 ОТМЕТКА `logs/origin.json` (файл этой машины, не в git): проверенный адрес не спрашивается снова — пересборка и запуск
// проверенного узла не требуют сети; смена `origin` — новая проверка.
// 🛑 Пока этот файл не обфусцирован, проверку можно вырезать правкой кода или подделать отметку — так и сказано владельцу.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ORIGINAL = 'fractera/agi'
const ORIGINAL_URL = 'https://github.com/fractera/agi'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RECORD = join(root, 'logs', 'origin.json')
const ENV = join(root, '.env.local')

function refuse(why) {
  console.error('')
  console.error('Вы пытаетесь установить неоригинальный проект Fractera.')
  console.error(why)
  console.error(`Установка Fractera — только из СВОЕГО форка оригинала: откройте ${ORIGINAL_URL}, нажмите Fork и установите по ссылке на вашу копию.`)
  console.error(`===ORIGIN_FAILED=== ${why}`)
  process.exit(1)
}

/** `owner/repo` из адреса GitHub (https или ssh), в нижнем регистре; иначе null. */
function slugOf(url) {
  const m = String(url).trim().match(/github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i)
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null
}

// 383 (владелец 2026-10-03: «почини красный крестик в Actions»): проверка трёх систем (`.github/workflows/three-os.yml`) собирает
// САМ оригинал — узла там не ставят, и отказ «это сам оригинал» держал её красной с 368 (76bca67). Пропуск — только прогон GitHub
// Actions в репозитории оригинала; форк в своих Actions проверяется как обычно. Переменные подменяемы — как и весь файл до обфускации.
if (process.env.GITHUB_ACTIONS === 'true' && String(process.env.GITHUB_REPOSITORY ?? '').toLowerCase() === ORIGINAL) {
  console.log(`===ORIGIN_CI=== ${ORIGINAL}: сборка-проверка GitHub Actions самого оригинала, узел не ставится`)
  process.exit(0)
}

const remote = spawnSync('git',['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', windowsHide: true })
const url = remote.status === 0 ? remote.stdout.trim() : ''
const slug = slugOf(url)
if (!slug) refuse(url ? `Адрес репозитория узла «${url}» — не GitHub.` : 'У папки узла нет адреса репозитория (git remote origin) — узел поставлен не клонированием форка.')

let record = null
try { record = JSON.parse(readFileSync(RECORD, 'utf8')) } catch { /* первой проверки ещё не было */ }
// 368 (владелец 2026-10-01: «то что касается версионности то никакой запрет представить не будем, но если это возможно будем выводить
// уведомления что вы пытаетесь сделать развёртывание из собственного репозитория но ваша версия уже устарела … или продолжите»).
// Отставание форка от оригинала — сравнение веток GitHub; без сети, на пределе запросов или у узла автора — молча пропускается:
// работающий узел никогда не зависит от оригинала (закон «нет единой точки отказа»). Число пишется в отметку — его показывает ядро.
async function versionNotice(rec) {
  if (rec.verdict !== 'fork' || !rec.parent) return
  try {
    const [owner] = rec.slug.split('/')
    const base = rec.parentBranch || 'main'
    const head = rec.branch || 'main'
    const r = await fetch(`https://api.github.com/repos/${rec.parent}/compare/${base}...${owner}:${head}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'fractera-node' }, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return
    const c = await r.json()
    const behindBy = Number(c.behind_by) || 0
    writeFileSync(RECORD, JSON.stringify({ ...rec, version: { behindBy, status: c.status, checkedAt: new Date().toISOString() } }, null, 2) + '\n', 'utf8')
    if (behindBy > 0) {
      console.log('')
      console.log(`⚠ Вы разворачиваете проект из своего репозитория, но ваша версия устарела: в оригинале Fractera ${behindBy} новых изменений.`)
      console.log(`  Чтобы обновиться, откройте ${rec.url.replace(/\.git$/, '')} и нажмите «Sync fork», затем повторите развёртывание — или продолжайте как есть.`)
      console.log(`===ORIGIN_OUTDATED=== behind ${behindBy}`)
    }
  } catch { /* нет сети — уведомления нет, развёртывание идёт */ }
}

if (record?.slug === slug && (record.verdict === 'fork' || record.verdict === 'author')) {
  console.log(`===ORIGIN_OK=== ${slug} (${record.verdict}, проверено ${record.checkedAt})`)
  await versionNotice(record)
  process.exit(0)
}

let res
try {
  res = await fetch(`https://api.github.com/repos/${slug}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'fractera-node' }, signal: AbortSignal.timeout(15_000) })
} catch {
  refuse('Не удалось проверить репозиторий у GitHub (нет связи). Повторите установку позже.')
}
if (res.status === 403 || res.status === 429) refuse('GitHub временно ограничил проверки с этого адреса. Повторите установку позже (через час).')
if (res.status === 404) refuse(`Репозиторий ${slug} не найден у GitHub или закрыт.`)
if (!res.ok) refuse(`GitHub ответил ${res.status} — проверить не удалось. Повторите установку позже.`)
const repo = await res.json()
const name = String(repo.full_name ?? '').toLowerCase()
const parent = String(repo.parent?.full_name ?? '').toLowerCase()
if (name === ORIGINAL) refuse('Это сам оригинал, а не ваш форк.')
if (!repo.fork || parent !== ORIGINAL) refuse(repo.fork ? `${repo.full_name} — форк ${repo.parent?.full_name}, а не оригинала.` : `${repo.full_name} — не форк оригинала Fractera.`)

mkdirSync(dirname(RECORD), { recursive: true })
const fresh = { slug, url, verdict: 'fork', parent: repo.parent.full_name, branch: repo.default_branch, parentBranch: repo.parent.default_branch, checkedAt: new Date().toISOString() }
writeFileSync(RECORD, JSON.stringify(fresh, null, 2) + '\n', 'utf8')
// Адрес форка — в окружение узла (факт для проекта; проверка его не читает).
const env = existsSync(ENV) ? readFileSync(ENV, 'utf8') : ''
const line = `NODE_REPO_URL=${repo.html_url}`
writeFileSync(ENV, /^NODE_REPO_URL=.*$/m.test(env) ? env.replace(/^NODE_REPO_URL=.*$/m, line) : `${env}${env === '' || env.endsWith('\n') ? '' : '\n'}${line}\n`, 'utf8')
console.log(`===ORIGIN_OK=== ${repo.full_name} — форк ${repo.parent.full_name}`)
await versionNotice(fresh)
