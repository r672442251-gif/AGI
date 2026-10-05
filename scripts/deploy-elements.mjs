// РАЗВЁРТЫВАНИЕ ЭЛЕМЕНТОВ УЗЛА ПО ОДНОМУ (280-11b).
//
// Слово владельца 2026-09-24: «кнопку повторить развёртывание … перечисление всех сервисов и выборочно
// сделать развёртывание либо одного из сервисов либо сразу всех одной кнопкой». Зовёт его дверь
// `POST /api/node/deploy`; вручную — `node scripts/deploy-elements.mjs root auth`.
//
// 🔒 ПО ОДНОМУ, А НЕ РАЗОМ. Каждая сборка Next съедает процессор и память машины человека; две
// параллельные на домашнем компьютере делают обе медленнее и чаще падают (`kill EPERM`, 2026-09-24).
// Каждый элемент пересобирается установщиком (`--only <id> --rebuild`): элемент со сборкой в соседнюю
// папку (280-9) не гаснет, прочие — гаснут на время сборки и откатываются при провале.
//
// 🔒 ХОД ПИШЕТСЯ В ФАЙЛ, А НЕ ПОМНИТСЯ. `logs/deploy-state.json` читает дверь — страница спрашивает её
// раз в несколько секунд. Файл держит и замок: пока `running`, вторая кнопка получает отказ.

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const { startStaticCopy } = createRequire(import.meta.url)('../lib/agi-items/static-copy-start.cjs')
const { pendingPreview } = createRequire(import.meta.url)('../lib/deploy/preview-lock.cjs')
const liveLog = createRequire(import.meta.url)('../lib/deploy/live-log.cjs')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE = join(ROOT, 'logs', 'deploy-state.json')
const LOG = join(ROOT, 'logs', 'deploy.log')
const ids = process.argv.slice(2).filter((a) => /^[a-z][a-z0-9-]{0,31}$/.test(a))

mkdirSync(join(ROOT, 'logs'), { recursive: true })
// 337-1: `pid` — по нему читающий узнаёт, жив ли этот процесс (`lib/deploy/deploy-lock.cjs`).
const state = { running: true, pid: process.pid, startedAt: new Date().toISOString(), finishedAt: null, queue: ids, current: null, results: [] }
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n')
save()

for (const id of ids) {
  state.current = id
  save()
  // 353-1: тот же запрет, что у двери, — и для запуска из терминала (✗ 2026-09-30 предпросмотр собрал агент, дверь о нём не знала).
  if (pendingPreview(ROOT, id)) {
    state.results.push({ id, ok: false, seconds: 0, note: 'предпросмотр ждёт «Принять» или «Отклонить» — развёртывание не начато' })
    save()
    continue
  }
  const t0 = Date.now()
  // 353-3: ход — в `logs/deploy-<id>.log` по мере работы (установщик пишет туда же сборку); страница читает его хвост.
  const live = liveLog.logPath(ROOT, 'deploy', id)
  liveLog.startLog(live, `▶ ${new Date().toISOString()} — развёртывание ${id} начато`)
  const r = liveLog.runLive(process.execPath, [join(ROOT, 'scripts', 'services-install.mjs'), '--only', id, '--rebuild'], {
    cwd: ROOT, windowsHide: true, env: { ...process.env, FRACTERA_LIVE_LOG: live },
  }, live)
  const out = r.out
  appendFileSync(LOG, `\n=== ${new Date().toISOString()} ${id}\n${out}`)
  const ok = r.rc === 0 && !/ОШИБКА/.test(out)
  appendFileSync(live, ok ? '■ готово\n' : '■ не удалось — работает прежняя версия\n')
  state.results.push({
    id,
    ok,
    seconds: Math.round((Date.now() - t0) / 1000),
    note: (out.match(/собран[^\n]*|ОШИБКА[^\n]*|прежняя сборка[^\n]*/g) || []).join(' · ').slice(0, 300),
  })
  save()
  // 287: журнал развёртываний — откат берёт из него последнюю УСПЕШНУЮ версию элемента.
  let version = null
  try {
    version = (JSON.parse(readFileSync(join(ROOT, 'AGI-ITEMS-REGISTRY', 'agi-items.json'), 'utf8')).services || []).find((s) => s.id === id)?.version ?? null
  } catch { /* реестр не прочитан — версия неизвестна */ }
  appendFileSync(join(ROOT, 'logs', 'deploy-history.jsonl'), JSON.stringify({ id, version, ok, at: new Date().toISOString() }) + '\n')
  // 344-3: развёрнутая версия уходит и в копию публичных страниц в Cloudflare (только у элемента со своим доменом).
  if (ok) startStaticCopy(ROOT, id)
}

state.running = false
state.current = null
state.finishedAt = new Date().toISOString()
save()
