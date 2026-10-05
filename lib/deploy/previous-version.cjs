// ПРЕДЫДУЩАЯ РАБОЧАЯ ВЕРСИЯ ЭЛЕМЕНТА — для отката (шаг 287).
//
// Слово владельца 2026-09-24: «…зайдёте в ядро на вкладку дашборд развертываний и выполните откат до предыдущей рабочей
// версии». Источник первый — журнал развёртываний `logs/deploy-history.jsonl` (его пишет `scripts/deploy-elements.mjs`
// после каждого развёртывания: элемент, версия, успех, время): последняя УСПЕШНАЯ версия, отличная от текущей.
// Журнала ещё нет (узел развёртывался до 287) — история реестра в git: последняя другая версия, успех неизвестен, и это
// говорится (`source: 'git'`).
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = process.cwd()
const REGISTRY_REL = 'AGI-ITEMS-REGISTRY/agi-items.json'

function currentVersion(id) {
  try {
    const reg = JSON.parse(readFileSync(join(ROOT, REGISTRY_REL), 'utf8'))
    return (reg.services || []).find((s) => s.id === id)?.version ?? null
  } catch {
    return null
  }
}

function fromHistory(id, current) {
  const file = join(ROOT, 'logs', 'deploy-history.jsonl')
  if (!existsSync(file)) return null
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const e = JSON.parse(lines[i])
      if (e.id === id && e.ok && e.version && e.version !== current) return { version: e.version, at: e.at, source: 'history' }
    } catch { /* битая строка — пропустить */ }
  }
  return null
}

function fromGit(id, current) {
  try {
    const shas = execFileSync('git', ['log', '--format=%H', '-n', '60', '--', REGISTRY_REL], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      .split(/\r?\n/).filter(Boolean)
    for (const sha of shas) {
      const text = execFileSync('git', ['show', `${sha}:${REGISTRY_REL}`], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
      const v = (JSON.parse(text).services || []).find((s) => s.id === id)?.version
      if (v && v !== current) return { version: v, at: null, source: 'git' }
    }
  } catch { /* нет git — нечего сказать */ }
  return null
}

function previousVersion(id) {
  const current = currentVersion(id)
  if (!current) return null
  return fromHistory(id, current) || fromGit(id, current)
}

module.exports = { previousVersion, currentVersion, REGISTRY_REL }
