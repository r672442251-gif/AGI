// РЕЕСТР — КАРТА ПРОЕКТА (шаг 374-1). Слово владельца 2026-10-02: новые репозитории «прокинем одновременно в AGI ITEMS json, и как
// ты помнишь я надеюсь сохрани его вместе с портом, субдоменом или и собственным доменом, ну разумеется ещё и описание».
//
// 🔒 ИСТОЧНИКИ ОСТАЮТСЯ ПРЕЖНИМИ, РЕЕСТР ИХ ДУБЛИРУЕТ: адрес — `data/services/<id>/address.json`, свой домен — `domain.json`,
// репозиторий человека — `github/state.json` там же, описание — `summary` («Забрать в ядро», 325), порт — уже в записи. Данные
// живут вне git, а реестр едет в форк человека: по нему клон форка восстанавливает проект (374-5).
// 🔒 ОДНА ФУНКЦИЯ, ВЫЗЫВАЕМАЯ ПЕРЕД ТЕМ, КАК КАРТА ПОКИДАЕТ МАШИНУ (создание репозиториев, выгрузка, установка), а не правка в
// каждом месте записи адреса и домена: копия, обновляемая в десяти местах, расходится в одиннадцатом.
// Голый `node` (установщик) — поэтому `.mjs`. Пишет файл, только если что-то изменилось.

import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addressOf } from './address-file.mjs'

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

/** Поля карты одного элемента из его данных. */
export function mapFieldsOf(id, root = process.cwd()) {
  const dir = join(root, 'data', 'services', id)
  const domain = readJson(join(dir, 'domain.json'))
  const github = readJson(join(dir, 'github', 'state.json'))
  return {
    address: addressOf(id, root),
    domain: typeof domain?.url === 'string' ? domain.url : null,
    github: typeof github?.repo === 'string' && github.repo ? github.repo : null,
  }
}

/** Освежить поля карты у каждой записи реестра. Возвращает `{ changed, registry }`. */
export function syncRegistryMap(root = process.cwd()) {
  const file = join(root, 'AGI-ITEMS-REGISTRY', 'agi-items.json')
  const registry = readJson(file)
  if (!registry || !Array.isArray(registry.services)) return { changed: false, registry: null }
  const before = JSON.stringify(registry)
  for (const entry of registry.services) {
    if (!entry || typeof entry.id !== 'string') continue
    const f = mapFieldsOf(entry.id, root)
    entry.address = f.address
    if (f.domain) entry.domain = f.domain
    else delete entry.domain
    if (f.github) entry.github = f.github
    else delete entry.github
  }
  const after = JSON.stringify(registry)
  if (after === before) return { changed: false, registry }
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(registry, null, 2) + '\n', 'utf8')
  renameSync(tmp, file)
  return { changed: true, registry }
}

// Прямой запуск: `node lib/agi-items/registry-map.mjs` (npm run registry:map) — освежить и напечатать карту.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('lib/agi-items/registry-map.mjs')) {
  const r = syncRegistryMap()
  if (!r.registry) { console.error('===REGISTRY_MAP_FAILED=== реестр не прочитан'); process.exit(1) }
  for (const e of r.registry.services) {
    console.log(`${e.id.padEnd(8)} ${String(e.kind).padEnd(5)} port ${String(e.port ?? '-').padEnd(6)} address ${String(e.address).padEnd(10)} domain ${e.domain ?? '-'}  github ${e.github ?? '-'}  summary ${e.summary ? 'yes' : '-'}`)
  }
  console.log(r.changed ? '===REGISTRY_MAP_UPDATED===' : '===REGISTRY_MAP_UNCHANGED===')
}
