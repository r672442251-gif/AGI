// ЗАПУСК КОПИИ ПУБЛИЧНЫХ СТРАНИЦ В CLOUDFLARE — ОДНО МЕСТО (узел, шаги 344-3 и 385-3). Решение владельца 2026-09-30: копия
// обновляется «После «Принять» и «Развернуть»», а при подключении домена ставится сама. Шаг 385 (владелец 2026-10-03: «Да,
// главный домен тоже» и «каждый из них имеет свой рут статик»): копию получает каждый адрес узла, не только свой домен элемента.
// Зовут: `scripts/element-preview.mjs` (Принять), `scripts/deploy-elements.mjs` (Развернуть), `lib/agi-items/element-domain.ts`
// (свой домен элемента), `app/api/node/reach` (поддомен элемента), `lib/agi-items/element-subdomain.ts` (адрес переехал),
// `lib/agi-items/element-delete.ts` (`--remove`), `app/api/domain/activate` и `scripts/services-install.mjs` (все адреса,
// `startStaticCopyAll`), кнопка «Обновить копии» на «Активации домена» (`app/api/domain/static-copy`). Таймеров нет.
//
// Процесс рождается, только если адрес в зоне человека возможен: свой домен элемента (`data/services/<id>/domain.json`) или свой
// домен узла с туннелем (`logs/domain.json`). Временный адрес trycloudflare копии не получает — его зона не в аккаунте человека.
// Запуск вне дерева процессов ядра (`scripts/spawn-free.mjs`): пересборка ядра не убивает выкладку. Итог —
// `data/services/<id>/static-copy.json` (отказ — с причиной, например нет прав Workers у ключа).

const { spawn } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

function nodeHasDomain(root) {
  try {
    const d = JSON.parse(readFileSync(path.join(root, 'logs', 'domain.json'), 'utf8'))
    return !!(d && d.zone && d.tunnelId)
  } catch {
    return false
  }
}

function launch(root, args) {
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'spawn-free.mjs'), path.join(root, 'scripts', 'static-copy.mjs'), ...args], {
    cwd: root, detached: true, windowsHide: true, stdio: 'ignore',
  })
  child.unref()
  return true
}

function startStaticCopy(root, id, extra = []) {
  const remove = extra.includes('--remove')
  if (!remove && !existsSync(path.join(root, 'data', 'services', id, 'domain.json')) && !nodeHasDomain(root)) return false
  return launch(root, [id, ...extra])
}

// Все адреса узла разом (`static-copy.mjs --all`): каждому элементу, на чей порт ведёт туннель, — копия; ушедшему адресу — снятие.
function startStaticCopyAll(root) {
  if (!nodeHasDomain(root)) return false
  return launch(root, ['--all'])
}

module.exports = { startStaticCopy, startStaticCopyAll, nodeHasDomain }
