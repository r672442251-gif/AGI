// КОПИЯ ПУБЛИЧНЫХ СТРАНИЦ ЭЛЕМЕНТА В CLOUDFLARE WORKERS (узел, шаг 344): `node scripts/static-copy.mjs <id>`.
//
// Слово владельца 2026-09-30: «все статические страницы отдаются через Cloud Flyer до тех пор пока пользователь не перешёл например
// защищенный режим. Но щас получается что когда я выключаю домашний компьютер со сети интернет больше не виден». Первоисточник
// Cloudflare (см. development-docs, шаг 344): кэш HTML не держит страницу гарантированно («Retention … is not configurable»), а
// файлы Workers static assets хранятся постоянно и отдаются бесплатно («Requests to static assets are free and unlimited»).
//
// Что делает: берёт у ЖИВОГО сервера элемента (петля, `127.0.0.1:<порт>`) HTML всех публичных страниц на всех языках сайта,
// кладёт рядом всю папку `static` текущей сборки (`/_next/static/**` — и чанки, которые островки грузят позже) и весь `public/`,
// дописывает страницу «хозяин сайта не в сети» и выкладывает это в Worker `fractera-copy-<id>` аккаунта человека (Direct Upload,
// три вызова REST) с маршрутом `<хост>/*` в режиме «Fail open». Как отвечает домен после этого:
//   файл есть в копии → его отдаёт Cloudflare, компьютер не нужен;
//   файла нет (вход, API, защищённый режим, `/_next/image`) → Worker спрашивает дом по туннелю; дом не ответил (5xx/530) →
//   картинка — исходный файл из копии, остальное — страница «не в сети» (503);
//   суточный лимит Worker кончился (Free: 100 000) → маршрут пропускает Worker, запрос идёт в туннель, как до шага.
// 🔒 Денег это не стоит на Free: превышение — отказ, а не счёт (workers/platform/pricing).
// 🛑 Копия — снимок момента выкладки: правка текста без развёртывания в неё не попадает (владелец выбрал: копия обновляется
//   после «Принять» и «Развернуть», шаг 344-3).
// Состояние — `data/services/<id>/static-copy.json`, журнал — `logs/static-copy-<id>.log`.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import paths from '../lib/agi-items/paths.cjs'

const ROOT = join(paths.ITEMS_DIR, '..')
const id = process.argv[2]
const API = 'https://api.cloudflare.com/client/v4'
const LOG = join(ROOT, 'logs', `static-copy-${id}.log`)
const STATE = join(ROOT, 'data', 'services', id ?? '_', 'static-copy.json')
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }
const say = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); try { appendFileSync(LOG, l + '\n') } catch { /* журнал не главное */ } }
const save = (s) => { try { mkdirSync(join(ROOT, 'data', 'services', id), { recursive: true }); writeFileSync(STATE, JSON.stringify({ ...s, at: new Date().toISOString() }, null, 2) + '\n') } catch { /* не главное */ } }
function fail(reason, detail = '') { say(`ОТКАЗ: ${reason} ${detail}`); save({ ok: false, reason, detail }); console.log('===COPY_FAILED==='); process.exit(1) }

// `--all` (шаг 385): копия каждому адресу узла — каждому элементу, на чей порт ведёт туннель (`architect.` ведёт на ядро, его в
// реестре нет — он пропускается сам), плюс элементам со своим доменом. Элемент, у которого прошлая копия есть, а адреса больше нет, —
// `--remove`. По одному, не параллельно: у машины человека может быть 400 МБ свободной памяти. Сводка — `logs/static-copy-all.log`.
// 385-3, возврат владельца 2026-10-04 («хотелось бы чтобы выпали список доменов которые будут обновлены … понимание процесса
// отсутствует»): проход ведёт файл работы `logs/static-copy-all.json` — план (каждый элемент: адреса и что с ним будет), текущий
// элемент и его фаза, сколько готово, итог по каждому. Его читает табло на «Активации домена» (стандарт табло шага 380). Файл же —
// замок: pid жив и `running` — второй проход не начинается (кнопка и подключение домена могут совпасть).
if (id === '--all') {
  const { spawnSync } = await import('node:child_process')
  const { addressOf } = await import('../lib/agi-items/address-file.mjs')
  const ALL_LOG = join(ROOT, 'logs', 'static-copy-all.log')
  const JOB = join(ROOT, 'logs', 'static-copy-all.json')
  const note = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); try { appendFileSync(ALL_LOG, l + '\n') } catch { /* не главное */ } }
  const held = readJson(JOB)
  if (held?.running && held.pid && held.pid !== process.pid) { try { process.kill(held.pid, 0); note(`проход уже идёт (pid ${held.pid}) — второй не начинается`); console.log('===COPY_ALL_BUSY==='); process.exit(0) } catch { /* умер — замок ничей */ } }
  const job = { pid: process.pid, running: true, startedAt: new Date().toISOString(), plan: [], current: null, phase: null, done: 0, total: 0, results: [] }
  const write = () => { try { mkdirSync(join(ROOT, 'logs'), { recursive: true }); writeFileSync(JOB, JSON.stringify(job, null, 2) + '\n') } catch { /* табло без хода — не повод останавливать выкладку */ } }
  const finish = (code, error) => { job.running = false; job.current = null; job.phase = null; job.finishedAt = new Date().toISOString(); if (error) job.error = error; write(); process.exit(code) }
  write()
  const tok = (() => { try { return readFileSync(join(ROOT, '.env.local'), 'utf8') } catch { return '' } })().match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)?.[1]?.trim()
  const node = readJson(join(ROOT, 'logs', 'domain.json'))
  if (!tok) { note('ОТКАЗ: у узла нет ключа Cloudflare'); finish(1, 'no-key') }
  if (!node?.zone || !node?.tunnelId) { note('ОТКАЗ: у узла нет своего домена'); finish(1, 'no-domain') }
  // Порт → адреса туннеля, как есть (один порт — несколько имён: главный домен и www, поддомен).
  const hostsByPort = new Map()
  {
    const h = { Authorization: `Bearer ${tok}` }
    const zr = await (await fetch(`${API}/zones?name=${encodeURIComponent(node.zone)}`, { headers: h })).json().catch(() => ({}))
    const acc = zr.result?.[0]?.account?.id
    if (!acc) { note('ОТКАЗ: зона узла не видна ключу'); finish(1, 'zone-not-visible') }
    const ing = await (await fetch(`${API}/accounts/${acc}/cfd_tunnel/${node.tunnelId}/configurations`, { headers: h })).json().catch(() => ({}))
    if (!ing.result?.config) { note('ОТКАЗ: туннель узла не виден ключу'); finish(1, 'tunnel-not-visible') }
    for (const r of ing.result.config.ingress ?? []) {
      try { if (r.hostname) { const p = Number(new URL(r.service).port); hostsByPort.set(p, [...(hostsByPort.get(p) ?? []), r.hostname]) } } catch { /* не адрес */ }
    }
  }
  for (const s of readJson(paths.REGISTRY_FILE)?.services ?? []) {
    const st = readJson(join(paths.entryDir(s), '.install-stamp.json'))
    const own = readJson(join(ROOT, 'data', 'services', s.id, 'domain.json'))
    const prev = readJson(join(ROOT, 'data', 'services', s.id, 'static-copy.json'))
    const hosts = own?.url ? [new URL(own.url).host] : (st?.port ? hostsByPort.get(Number(st.port)) ?? [] : [])
    const action = hosts.length ? 'copy' : prev?.ok ? 'remove' : 'skip'
    job.plan.push({ id: s.id, address: addressOf(s.id, ROOT) || s.id, hosts, action, removedHosts: action === 'remove' ? (prev.hosts ?? [prev.host]) : undefined })
  }
  job.total = job.plan.filter((p) => p.action !== 'skip').length
  write()
  for (const p of job.plan) {
    if (p.action === 'skip') continue
    job.current = p.id
    job.phase = p.action === 'remove' ? 'remove' : 'start'
    write()
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'static-copy.mjs'), p.id, ...(p.action === 'remove' ? ['--remove'] : [])], { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: { ...process.env, FRACTERA_COPY_JOB: JOB } })
    Object.assign(job, { ...readJson(JOB), plan: job.plan, results: job.results, done: job.done, total: job.total })
    const after = readJson(join(ROOT, 'data', 'services', p.id, 'static-copy.json'))
    const ok = p.action === 'remove' ? true : !!after?.ok
    job.results.push({ id: p.id, ok, removed: p.action === 'remove', files: after?.files ?? null, reason: ok ? null : after?.reason ?? String(r.status), detail: ok ? null : after?.detail ?? null })
    job.done += 1
    note(p.action === 'remove' ? `${p.id}: адреса нет — копия снята` : ok ? `${p.id}: ${p.hosts.join(', ')} — ${after.files} файлов` : `${p.id}: ОТКАЗ ${after?.reason ?? r.status} ${after?.detail ?? ''}`)
    write()
  }
  const bad = job.results.filter((x) => !x.ok).length
  note(`итог: адресов ${job.results.length}, отказов ${bad}, без адреса ${job.plan.filter((p) => p.action === 'skip').length}`)
  console.log(bad ? '===COPY_ALL_PARTIAL===' : '===COPY_ALL_OK===')
  finish(bad ? 1 : 0)
}

// Фаза одной выкладки для табло (385-3): пишется в файл работы прохода `--all`, если выкладка идёт внутри него. Родитель в это
// время ждёт ребёнка (`spawnSync`), поэтому файл пишет только один процесс.
const phase = (p) => {
  const jf = process.env.FRACTERA_COPY_JOB
  if (!jf) return
  try { const j = readJson(jf); if (j) { j.phase = p; writeFileSync(jf, JSON.stringify(j, null, 2) + '\n') } } catch { /* табло без фазы */ }
}

const envText0 = (() => { try { return readFileSync(join(ROOT, '.env.local'), 'utf8') } catch { return '' } })()
const token0 = envText0.match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)?.[1]?.trim()

// `--remove` (344-3): домен отключён от элемента — снять маршрут и Worker копии, иначе Cloudflare раздавал бы старые страницы
// отключённого домена, а всё остальное отвечало бы «не в сети». Хост и имя — из прошлой выкладки (`static-copy.json`).
if (process.argv.includes('--remove')) {
  // `--state=<файл>` (385-3): элемент удаляется, его `data/services/<id>` стирается сразу — состояние приходит копией.
  const stateArg = process.argv.find((a) => a.startsWith('--state='))?.slice('--state='.length)
  const last = readJson(stateArg || STATE)
  if (!last?.host || !last?.script || !token0) { say('снимать нечего'); console.log('===COPY_REMOVED==='); process.exit(0) }
  const h = { Authorization: `Bearer ${token0}` }
  let account = null
  for (const hh of last.hosts ?? [last.host]) {
    const zr = await (await fetch(`${API}/zones?name=${encodeURIComponent(hh.split('.').slice(-2).join('.'))}`, { headers: h })).json().catch(() => ({}))
    const zz = zr.result?.[0]
    if (!zz) continue
    account = zz.account.id
    const rr = await (await fetch(`${API}/zones/${zz.id}/workers/routes`, { headers: h })).json().catch(() => ({}))
    for (const r of rr.result ?? []) if (r.script === last.script) await fetch(`${API}/zones/${zz.id}/workers/routes/${r.id}`, { method: 'DELETE', headers: h })
  }
  if (account) {
    const del = await fetch(`${API}/accounts/${account}/workers/scripts/${last.script}?force=true`, { method: 'DELETE', headers: h })
    say(`копия снята: маршруты ${(last.hosts ?? [last.host]).join(', ')}, Worker ${last.script} (${del.status})`)
  }
  save({ ok: false, removed: true, host: last.host, hosts: last.hosts ?? [last.host] })
  console.log('===COPY_REMOVED===')
  process.exit(0)
}

const entry = (readJson(paths.REGISTRY_FILE)?.services ?? []).find((s) => s.id === id)
if (!entry) { console.error('usage: static-copy.mjs <id> [--dry | --remove]'); process.exit(2) }
const dir = paths.entryDir(entry)
const stamp = readJson(join(dir, '.install-stamp.json'))
if (!stamp?.port || !stamp?.dist) fail('not-installed')
const envText = (() => { try { return readFileSync(join(ROOT, '.env.local'), 'utf8') } catch { return '' } })()
const token = envText.match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)?.[1]?.trim()
if (!token) fail('no-key')

async function cf(method, path, body, headers = {}) {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, ok: r.ok && j.success !== false, result: j.result, errors: (j.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ') }
}

// ── 0. Адреса элемента (шаг 385). Свой домен элемента (`domain.json`) — главный и единственный: его поддомен отвечает 301, и
// копия там подменила бы перенаправление страницей. Иначе — КАК ЕСТЬ: хосты туннеля узла, ведущие на порт элемента (главный домен
// узла → root, `<адрес>.<зона>` → элемент). Владелец 2026-10-03: «каждый из них имеет свой рут статик».
const domain = readJson(join(ROOT, 'data', 'services', id, 'domain.json'))
let hosts = domain?.url ? [new URL(domain.url).host] : []
if (!hosts.length) {
  const node = readJson(join(ROOT, 'logs', 'domain.json'))
  // 385-3: адреса нет — это не отказ, а отсутствие предмета. Прошлая копия есть — она снимается (иначе Cloudflare раздавал бы
  // страницы адреса, которого у элемента больше нет); нет — выходим молча, не затирая состояние ложным отказом.
  const noAddress = async (why) => {
    if (readJson(STATE)?.ok) {
      const { spawnSync } = await import('node:child_process')
      say(`адреса больше нет (${why}) — прежняя копия снимается`)
      spawnSync(process.execPath, [join(ROOT, 'scripts', 'static-copy.mjs'), id, '--remove'], { cwd: ROOT, stdio: 'inherit', windowsHide: true })
    } else say(`адреса нет (${why}) — копия не нужна`)
    console.log('===COPY_NO_ADDRESS===')
    process.exit(0)
  }
  if (!node?.zone || !node?.tunnelId) await noAddress('у узла нет своего домена')
  const nz = await cf('GET', `/zones?name=${encodeURIComponent(node.zone)}`)
  const nzr = nz.result?.[0]
  if (!nz.ok || !nzr) fail('zone-not-visible', nz.errors)
  const ing = await cf('GET', `/accounts/${nzr.account.id}/cfd_tunnel/${node.tunnelId}/configurations`)
  if (!ing.ok) fail('tunnel-not-visible', `${ing.status} ${ing.errors}`)
  const portOf = (s) => { try { return Number(new URL(s).port) } catch { return 0 } }
  hosts = (ing.result?.config?.ingress ?? []).filter((r) => r.hostname && portOf(r.service) === Number(stamp.port)).map((r) => r.hostname)
  if (!hosts.length) await noAddress(`в туннеле нет адреса, ведущего на порт ${stamp.port}`)
}
const host = hosts[0]

phase('pages')
// ── 1. Страницы: корень, главная и каждая страница публичной ветки на каждом языке сайта ─────────────────────────────────────
const envLocal = (() => { try { return readFileSync(join(dir, '.env.local'), 'utf8') } catch { return '' } })()
const langs = (envLocal.match(/^NEXT_PUBLIC_SUPPORTED_LANGUAGES=(.*)$/m)?.[1] ?? 'en').split(',').map((s) => s.trim()).filter(Boolean)
const pagesDir = join(dir, 'app', '[lang]', '(publicLayer)', '_pages')
const slugs = []
;(function walk(d, prefix) {
  if (!existsSync(d)) return
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const p = join(d, e.name)
    if (existsSync(join(p, 'meta.json'))) slugs.push(prefix + e.name)
    walk(p, prefix + e.name + '/')
  }
})(pagesDir, '')
const origin = `http://127.0.0.1:${stamp.port}`
// 2026-10-01: копия запускается сразу после «Принять»/«Развернуть», а элемент в этот момент ещё перезапускается. ✗ Замерено: 14:45:27
// копия упала «no-pages» через 7 с после старта элемента, и aifa.dev сутки отдавал прежнюю копию. Ждём ответа ПО ФАКТУ, до 90 с.
// По `/`, а не `/api/health`: у auth и data этой двери нет (385, замер), а `/` есть у всех (200 или перенаправление).
for (const until = Date.now() + 90_000; Date.now() < until;) {
  const h = await fetch(origin + '/', { redirect: 'manual', signal: AbortSignal.timeout(5_000) }).catch(() => null)
  if (h && h.status < 500) break
  await new Promise((r) => setTimeout(r, 2_000))
}
// Страницы из карты сайта самого элемента (385): у root их 18, у auth/data карты нет — тогда остаются `/` и `/<язык>`. Хост в
// `<loc>` отбрасывается: карта бывает собрана со старым адресом (замер: roman пишет throughsongs.com).
const fromSitemap = await (async () => {
  const r = await fetch(origin + '/sitemap.xml', { signal: AbortSignal.timeout(30_000) }).catch(() => null)
  if (!r?.ok) return []
  return [...(await r.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => { try { return new URL(m[1]).pathname.replace(/\/+$/, '') || '/' } catch { return null } }).filter(Boolean)
})()
// Манифест сборки — точный список того, что Next собрал статикой (у auth: `/en`, `/ru`, `/login`…). Берутся только страницы с языком
// первым сегментом: это публичный слой. `/login`, `/register` — формы, без дома они не работают; честнее «хозяин не в сети».
const fromManifest = Object.keys(readJson(join(dir, stamp.dist, 'prerender-manifest.json'))?.routes ?? {}).filter((p) => /^\/[a-z]{2}(-[A-Za-z]{2,4})?(\/|$)/.test(p))
const pagePaths = [...new Set(['/', ...langs.flatMap((l) => [`/${l}`, ...slugs.map((s) => `/${l}/${s}`)]), ...fromSitemap, ...fromManifest])]

const files = new Map() // путь в копии → Buffer
const redirects = {} // путь → куда; Worker отдаёт их, только когда дом молчит (дом сам решает язык по заголовкам)
// Языковые двойники страницы — из её же `<link rel="alternate" hreflang>`: у auth в окружении нет списка языков, а `/ru` есть (385).
const alternates = (html) => [...html.matchAll(/<link[^>]*hreflang="[^"]+"[^>]*>/g)].map((m) => m[0].match(/href="([^"]+)"/)?.[1])
  .map((u) => { try { return new URL(u, 'http://x').pathname.replace(/\/+$/, '') || '/' } catch { return null } }).filter(Boolean)
for (let i = 0; i < pagePaths.length && pagePaths.length < 2000; i++) {
  const p = pagePaths[i]
  const r = await fetch(origin + p, { redirect: 'manual', signal: AbortSignal.timeout(60_000) }).catch(() => null)
  const loc = r?.headers.get('location')
  if (r && r.status >= 300 && r.status < 400 && loc && (loc.startsWith('/') || loc.startsWith(origin))) { redirects[p] = loc.startsWith('/') ? loc : loc.slice(origin.length); continue }
  if (!r || r.status !== 200 || !(r.headers.get('content-type') ?? '').includes('text/html')) { say(`пропущена ${p}: ${r ? r.status : 'нет ответа'}`); continue }
  // Только статика: страница, которую сервер собирает на каждый запрос (private / no-store), из копии отдала бы чужое состояние.
  if (/private|no-store/i.test(r.headers.get('cache-control') ?? '')) { say(`пропущена ${p}: динамическая`); continue }
  const buf = Buffer.from(await r.arrayBuffer())
  files.set(p === '/' ? '/index.html' : `${p}.html`, buf)
  for (const a of alternates(buf.toString('utf8'))) if (!pagePaths.includes(a)) pagePaths.push(a)
}
if (files.size === 0) fail('no-pages', `сервер ${origin} не отдал ни одной страницы`)
for (const f of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/llms.txt']) {
  const r = await fetch(origin + f).catch(() => null)
  if (r?.status === 200) files.set(f, Buffer.from(await r.arrayBuffer()))
}

phase('files')
// ── 2. Файлы сборки и public ─────────────────────────────────────────────────────────────────────────────────────────────────
function addTree(base, prefix) {
  if (!existsSync(base)) return
  ;(function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (statSync(p).size <= 25 * 1024 * 1024) files.set(prefix + '/' + relative(base, p).split('\\').join('/'), readFileSync(p))
    }
  })(base)
}
addTree(join(dir, stamp.dist, 'static'), '/_next/static')
addTree(join(dir, 'public'), '')

// ── 3. Страница «не в сети» ─────────────────────────────────────────────────────────────────────────────────────────────────
// 390 (владелец 2026-10-04, D3: «ты какой-то причине вводишь ответ сразу на двух языках … используя существующие стандарт
// мультиязычности»): страница «не в сети» — своя на каждый язык (`/__offline-<язык>.html`), Worker выбирает язык посетителя.
// Слова — основа `en` и перевод `ru` (стандарт узла AGI: два языка); язык сайта без перевода получает английскую.
const OFFLINE_WORDS = {
  en: { title: 'The site owner is offline right now', text: `Public pages of ${host} stay open; this part needs the owner's computer and will work again when it is back online.`, home: 'Home page' },
  ru: { title: 'Хозяин сайта сейчас не в сети', text: `Публичные страницы ${host} открыты; этой части нужен компьютер хозяина, и она заработает, когда он снова будет в сети.`, home: 'Главная' },
}
const defaultLang = (envLocal.match(/^NEXT_PUBLIC_DEFAULT_LOCALE=(.*)$/m)?.[1] ?? langs[0] ?? 'en').trim()
for (const lang of langs) {
  const w = OFFLINE_WORDS[lang] ?? OFFLINE_WORDS.en
  files.set(`/__offline-${lang}.html`, Buffer.from(`<!doctype html><html lang="${OFFLINE_WORDS[lang] ? lang : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${host}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6f6f7;color:#1b1b1f}
main{max-width:34rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .6rem}p{line-height:1.55;margin:.4rem 0;color:#44444c}a{color:inherit}</style></head>
<body><main><h1>${w.title}</h1><p>${w.text}</p><p><a href="/${lang}">${w.home}</a></p></main></body></html>`))
}
if (files.size > 20000) fail('too-many-files', String(files.size))
say(`копия собрана: ${files.size} файлов (страниц: ${[...files.keys()].filter((k) => k.endsWith('.html')).length - 1})`)
// `--dry` — собрать и показать, ничего не выкладывать (проверка без ключа с правами Workers).
if (process.argv.includes('--dry')) {
  say(`  адреса: ${hosts.join(', ')}`)
  for (const k of [...files.keys()].filter((k) => k.endsWith('.html')).sort()) say(`  ${k} ${files.get(k).length} б`)
  for (const [k, v] of Object.entries(redirects)) say(`  ${k} → ${v}`)
  console.log('===COPY_DRY_OK===')
  process.exit(0)
}

// ── 4. Worker: спросить дом, если файла нет в копии; дом молчит — «не в сети» ────────────────────────────────────────────────
const WORKER = `const REDIRECTS = ${JSON.stringify(redirects)}
const LANGS = ${JSON.stringify(langs)}
const DEFAULT_LANG = ${JSON.stringify(langs.includes(defaultLang) ? defaultLang : langs[0] ?? 'en')}
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    let res = null
    try { res = await fetch(request) } catch { res = null }
    // Дом не на связи — только сбои связи (502–504, 52x Cloudflare, 530 туннеля); настоящая ошибка сайта (500) идёт как есть.
    const down = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]
    if (res && !down.includes(res.status)) return res
    const to = REDIRECTS[url.pathname.replace(/\\/+$/, '') || '/']
    if (to) return Response.redirect(new URL(to, url).toString(), 307)
    if (url.pathname === '/_next/image') {
      const src = url.searchParams.get('url')
      if (src && src.startsWith('/')) { const a = await env.ASSETS.fetch(new URL(src, url)); if (a.ok) return a }
    }
    // 390: язык посетителя — из адреса (/ru/...), из ?lang= (кнопка «Войти»), из браузера, иначе язык сайта по умолчанию.
    const seg = url.pathname.split('/')[1]
    const asked = (request.headers.get('accept-language') || '').split(',').map((x) => x.trim().slice(0, 2).toLowerCase())
    const lang = [seg, url.searchParams.get('lang'), ...asked].find((x) => x && LANGS.includes(x)) || DEFAULT_LANG
    const off = await env.ASSETS.fetch(new URL('/__offline-' + lang + '.html', url))
    return new Response(off.body, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '300', 'cache-control': 'no-store', 'x-fractera-copy': 'offline' } })
  },
}
`

phase('upload')
// ── 5. Выкладка (Direct Upload) ─────────────────────────────────────────────────────────────────────────────────────────────
const zone = await cf('GET', `/zones?name=${encodeURIComponent(host.split('.').slice(-2).join('.'))}`)
const z = zone.result?.[0]
if (!zone.ok || !z) fail('zone-not-visible', zone.errors)
const account = z.account.id
const script = `fractera-copy-${id}`
const hashOf = (buf, path) => createHash('sha256').update(buf.toString('base64') + extname(path).slice(1)).digest('hex').slice(0, 32)
const manifest = {}
const byHash = new Map()
for (const [p, buf] of files) { const h = hashOf(buf, p); manifest[p] = { hash: h, size: buf.length }; byHash.set(h, { p, buf }) }
const session = await cf('POST', `/accounts/${account}/workers/scripts/${script}/assets-upload-session`, JSON.stringify({ manifest }), { 'content-type': 'application/json' })
if (!session.ok) fail('upload-session', `${session.status} ${session.errors}`)
let completion = session.result.jwt
const buckets = session.result.buckets ?? []
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' }
for (const bucket of buckets) {
  const form = new FormData()
  for (const h of bucket) { const f = byHash.get(h); form.append(h, new File([f.buf.toString('base64')], h, { type: MIME[extname(f.p)] ?? 'application/octet-stream' }), h) }
  const r = await fetch(`${API}/accounts/${account}/workers/assets/upload?base64=true`, { method: 'POST', headers: { Authorization: `Bearer ${session.result.jwt}` }, body: form })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.success === false) fail('upload', `${r.status} ${(j.errors ?? []).map((e) => e.message).join('; ')}`)
  if (j.result?.jwt) completion = j.result.jwt
}
say(`загружено пачек: ${buckets.length} (новых файлов: ${buckets.flat().length})`)
const meta = {
  main_module: 'worker.js',
  compatibility_date: '2026-09-01',
  assets: { jwt: completion, config: { html_handling: 'drop-trailing-slash', not_found_handling: 'none' } },
  bindings: [{ name: 'ASSETS', type: 'assets' }],
}
const form = new FormData()
form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
form.append('worker.js', new File([WORKER], 'worker.js', { type: 'application/javascript+module' }))
const put = await fetch(`${API}/accounts/${account}/workers/scripts/${script}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form })
const pj = await put.json().catch(() => ({}))
if (!put.ok || pj.success === false) fail('script', `${put.status} ${(pj.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ')}`)
say(`Worker ${script} выложен`)

phase('route')
// ── 6. Маршрут `<хост>/*`, Fail open ────────────────────────────────────────────────────────────────────────────────────────
// Адрес ушёл (смена главного адреса, поддомен ↔ домен) — маршрут прежнего хоста снимается: там копия больше не главная.
const last = readJson(STATE)
for (const old of (last?.hosts ?? (last?.host ? [last.host] : [])).filter((h) => !hosts.includes(h))) {
  const oz = await cf('GET', `/zones?name=${encodeURIComponent(old.split('.').slice(-2).join('.'))}`)
  const ozid = oz.result?.[0]?.id
  const orr = ozid ? await cf('GET', `/zones/${ozid}/workers/routes`) : null
  for (const r of orr?.result ?? []) if (r.script === script && r.pattern === `${old}/*`) {
    await cf('DELETE', `/zones/${ozid}/workers/routes/${r.id}`)
    say(`снят маршрут прежнего адреса ${r.pattern}`)
  }
}
for (const h of hosts) {
  const hz = h === host ? z : (await cf('GET', `/zones?name=${encodeURIComponent(h.split('.').slice(-2).join('.'))}`)).result?.[0]
  if (!hz) fail('zone-not-visible', h)
  const pattern = `${h}/*`
  const routes = await cf('GET', `/zones/${hz.id}/workers/routes`)
  if (!routes.ok) fail('routes-read', `${routes.status} ${routes.errors}`)
  const same = (routes.result ?? []).find((r) => r.pattern === pattern)
  if (same && same.script !== script) fail('route-taken', `${pattern} → ${same.script}`)
  if (!same) {
    const add = await cf('POST', `/zones/${hz.id}/workers/routes`, JSON.stringify({ pattern, script, request_limit_fail_open: true }), { 'content-type': 'application/json' })
    if (!add.ok) fail('route', `${add.status} ${add.errors}`)
    say(`маршрут ${pattern} → ${script} (fail open: ${add.result?.request_limit_fail_open ?? 'не сообщено'})`)
  } else say(`маршрут ${pattern} уже ведёт на ${script}`)
}

save({ ok: true, host, hosts, script, files: files.size, pages: pagePaths.length, redirects: Object.keys(redirects).length, version: stamp.version })
console.log('===COPY_OK===')
