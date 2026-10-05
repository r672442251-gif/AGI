// ОТКАТ ЭЛЕМЕНТА УЗЛА ДО ПРЕДЫДУЩЕЙ РАБОЧЕЙ ВЕРСИИ (шаг 287) — `npm run deploy:rollback -- <элемент>`.
//
// 🔒 РАБОТАЕТ С МАШИНЫ, КОГДА ВХОД СЛОМАН. Повод — слово владельца: повреждённая авторизация закрывает защищённые
// маршруты, «в том числе архитекторам», то есть до «Дашборда развёртываний» тогда не дойти. Команда не спрашивает
// никакой сессии: она работает там, где лежит узел. Кнопка дашборда зовёт ту же команду.
//
// Что делает: берёт предыдущую рабочую версию (`lib/deploy/previous-version.cjs`), ставит её в реестр
// `AGI-ITEMS-REGISTRY/agi-items.json` и развёртывает элемент тем же установщиком (`deploy-elements.mjs`) — сборка в
// соседнюю папку без остановки. 🛑 База данных элемента (`data/services/<id>`) откатом кода НЕ откатывается.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)
const { previousVersion, currentVersion, REGISTRY_REL } = createRequire(import.meta.url)('../lib/deploy/previous-version.cjs')

const id = process.argv[2]
if (!id || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) {
  console.error('deploy:rollback: укажите элемент — npm run deploy:rollback -- auth')
  process.exit(1)
}
// 353-1: предпросмотр ждёт решения — откат (это развёртывание) не начинается ДО смены версии в реестре.
if (createRequire(import.meta.url)('../lib/deploy/preview-lock.cjs').pendingPreview(ROOT, id)) {
  console.error(`deploy:rollback: у «${id}» предпросмотр ждёт «Принять» или «Отклонить» — сначала решите его`)
  process.exit(1)
}
const current = currentVersion(id)
const prev = previousVersion(id)
if (!current || !prev) {
  console.error(`deploy:rollback: для «${id}» нет предыдущей версии (текущая ${current ?? '—'})`)
  process.exit(1)
}
console.log(`deploy:rollback: ${id} ${current} → ${prev.version} (${prev.source === 'history' ? 'последняя успешная по журналу' : 'предыдущая по истории реестра, успех не записан'})`)

const path = join(ROOT, REGISTRY_REL)
const reg = JSON.parse(readFileSync(path, 'utf8'))
const entry = reg.services.find((s) => s.id === id)
entry.version = prev.version
writeFileSync(path, JSON.stringify(reg, null, 2) + '\n')

const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'deploy-elements.mjs'), id], { cwd: ROOT, stdio: 'inherit', windowsHide: true })
const state = JSON.parse(readFileSync(join(ROOT, 'logs', 'deploy-state.json'), 'utf8'))
const res = (state.results || []).find((x) => x.id === id)
if (r.status !== 0 || !res?.ok) {
  console.error(`deploy:rollback: развёртывание ${prev.version} не удалось — ${res?.note ?? 'см. logs/deploy.log'}`)
  process.exit(1)
}
console.log(`===ROLLBACK_OK=== ${id} ${prev.version}`)
