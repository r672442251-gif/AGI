// ПРОВЕРКА АДРЕСОВ ДЛЯ ПОИСКОВИКОВ ПО КАЖДОМУ САЙТУ УЗЛА (шаг 395, владелец 2026-10-05: «check seo for each site if was used
// owen domain, for example for example.com if it exist inside parent-site.com»).
//
// 🔒 У САЙТА ОДИН ГЛАВНЫЙ АДРЕС, и поисковик обязан видеть только его: robots (`Host`, `Sitemap`), каждая `<loc>` карты,
// canonical и hreflang главной ведут туда; прочие адреса того же сайта отвечают 301/308 на главный. ✗ 394: элемент на
// `roman.<зона>` полгода называл себя адресом корня, и ни один прибор этого не видел.
//
// Главный адрес — то же правило, что `domainRecord` (`lib/agi-items/element-domain.ts`, 324-5) и дверь preview-url (393):
// `domain.json` → `primary` решает, домен или поддомен; без него — поддомен `<адрес>.<зона>`; корень — `hostname ?? zone`.
// Сайты — элементы группы `user`; службы ядра (auth, data, config, design) — служебные адреса, не страницы для поиска.
//
// Только чтение и сеть: файлов узла команда не пишет, таймеров нет. Код выхода 1 — хотя бы одно нарушение.
// `--expect <id>=<url>` — страницы берутся с настоящего адреса, а сверяются с подменённым (негативный контроль прибора:
// воспроизводит 394 — сайт отвечает, но называет себя не тем адресом).
//
//   npm run check:addresses                  все сайты
//   npm run check:addresses -- mzjce root    только названные

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addressOf } from '../lib/agi-items/address-file.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

const args = process.argv.slice(2)
const expect = new Map()
const only = []
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--expect') { const [id, url] = String(args[++i] ?? '').split('='); if (id && url) expect.set(id, url.replace(/\/+$/, '')) }
  else only.push(args[i])
}

const node = readJson(join(ROOT, 'logs', 'domain.json'))
if (!node?.zone) {
  console.log('У узла нет своего домена: сайты живут на временном адресе, проверять для поисковиков нечего.')
  process.exit(0)
}
const zone = node.zone

const services = readJson(join(ROOT, 'AGI-ITEMS-CONFIG', 'agi-items.json'))?.services ?? []
const sites = services.filter((s) => s.kind === 'user' && (only.length === 0 || only.includes(s.id)))

/** Главный адрес и прочие адреса сайта — правило `domainRecord`. */
function addressesOf(id) {
  if (id === 'root') return { main: `https://${node.hostname ?? zone}`, others: [], how: 'корень узла' }
  const sub = `${addressOf(id, ROOT)}.${zone}`
  const d = readJson(join(ROOT, 'data', 'services', id, 'domain.json'))
  if (!d || typeof d.domain !== 'string' || !d.domain) return { main: `https://${sub}`, others: [], how: 'поддомен (своего домена нет)' }
  const domain = d.domain
  return d.primary === 'subdomain'
    ? { main: `https://${sub}`, others: [`https://${domain}`, `https://www.${domain}`], how: `поддомен главный, свой домен ${domain}` }
    : { main: `https://${domain}`, others: [`https://www.${domain}`, `https://${sub}`], how: `свой домен главный, поддомен ${sub}` }
}

const originOf = (u) => { try { return new URL(u).origin } catch { return null } }
const bust = () => `check=${Date.now()}`

async function get(url, redirect = 'follow') {
  try {
    const r = await fetch(url, { redirect, signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'fractera-check-addresses' } })
    return { status: r.status, location: r.headers.get('location'), url: r.url, text: redirect === 'follow' ? await r.text() : '' }
  } catch (e) {
    return { status: 0, error: e?.cause?.code ?? e?.name ?? String(e) }
  }
}

let violations = 0
for (const s of sites) {
  const a = addressesOf(s.id)
  const main = expect.get(s.id) ?? a.main
  const base = a.main
  const name = s.id === addressOf(s.id, ROOT) ? s.id : `${addressOf(s.id, ROOT)} (${s.id})`
  const bad = []
  const notes = []
  const wrong = (where, value) => { if (originOf(value) !== main) bad.push(`${where}: ${value}`) }

  // robots.txt
  const robots = await get(`${base}/robots.txt?${bust()}`)
  if (robots.status !== 200) bad.push(`robots.txt не отвечает (${robots.status || robots.error})`)
  else {
    const lines = robots.text.split(/\r?\n/)
    const host = lines.find((l) => /^host:/i.test(l))?.replace(/^host:\s*/i, '').trim()
    const maps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.replace(/^sitemap:\s*/i, '').trim())
    if (host) wrong('robots Host', host)
    for (const m of maps) wrong('robots Sitemap', m)
    if (!host && maps.length === 0) notes.push('robots без Host и Sitemap (сайт закрыт для поиска или без адреса)')
  }

  // sitemap.xml — каждая строка
  const map = await get(`${base}/sitemap.xml?${bust()}`)
  if (map.status === 200) {
    const locs = [...map.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
    const off = locs.filter((l) => originOf(l) !== main)
    if (off.length) bad.push(`sitemap: ${off.length} из ${locs.length} строк не на главном адресе, например ${off[0]}`)
    else notes.push(`sitemap: ${locs.length} строк на главном адресе`)
  } else notes.push(`карты сайта нет (${map.status || map.error})`)

  // главная: canonical и hreflang
  const home = await get(`${base}/`)
  if (home.status !== 200) bad.push(`главная не отвечает (${home.status || home.error})`)
  else {
    if (originOf(home.url) !== base) bad.push(`главная увела на другой адрес: ${home.url}`)
    const links = [...home.text.matchAll(/<link\b[^>]*>/g)].map((m) => m[0])
    const href = (tag) => tag.match(/\bhref="([^"]+)"/)?.[1]
    const canonical = links.find((l) => /\brel="canonical"/.test(l))
    if (canonical) wrong('canonical', href(canonical))
    else notes.push('canonical на главной нет')
    for (const alt of links.filter((l) => /\brel="alternate"/.test(l) && /\bhreflang=/.test(l))) wrong(`hreflang ${alt.match(/hreflang="([^"]+)"/)?.[1]}`, href(alt))
  }

  // прочие адреса — 301/308 на главный
  for (const other of expect.has(s.id) ? [] : a.others) {
    const r = await get(`${other}/`, 'manual')
    if (r.status !== 301 && r.status !== 308) bad.push(`${other} отвечает ${r.status || r.error} вместо 301 на ${main}`)
    else if (originOf(new URL(r.location ?? '', other).href) !== main) bad.push(`${other} ведёт 301 на ${r.location}, а не на ${main}`)
  }

  violations += bad.length
  console.log(`\n${bad.length ? '✗' : '✓'} ${name} — ${main} · ${a.how}`)
  for (const b of bad) console.log(`   нарушение: ${b}`)
  for (const n of notes) console.log(`   ${n}`)
}

console.log(violations ? `\nНарушений: ${violations}.` : `\nНарушений нет (сайтов: ${sites.length}).`)
process.exit(violations ? 1 : 0)
