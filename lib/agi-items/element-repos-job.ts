import "server-only"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createAllElementRepos, type RepoResult } from "@/lib/agi-items/element-github"
import { saveNodeMap, type NodeMapResult } from "@/lib/agi-items/node-map"

// «КЛЮЧ ВПИСАН — РЕПОЗИТОРИИ СОЗДАЮТСЯ САМИ» (шаг 374-2). Слово владельца 2026-10-02: «как только вёл сразу же в его репозитории
// создаются классические репозитории под каждой AGI ITEMS». Работа длится минуты (дотянуть историю обязательных элементов с
// Fractera, выгрузить каждый), поэтому идёт в процессе ядра без ожидания ответа, а ход — в `data/node/github/repos.json`.
// 🔒 Действие — только в ответ на человека (сохранение ключа или кнопка «Создать репозитории»): таймеров и повторов нет.

const FILE = join(process.cwd(), "data", "node", "github", "repos.json")
const g = globalThis as unknown as { __agiReposJob?: Promise<void> | null }
export type ReposJob = { running: boolean; retryAt?: string; pid?: number; current?: string; done?: number; total?: number; interrupted?: boolean; startedAt?: string; finishedAt?: string; results?: RepoResult[]; map?: NodeMapResult }

// 🔒 «ИДЁТ» ИЗМЕРЯЕТСЯ, А НЕ ПОМНИТСЯ (378, тот же закон, что у замка развёртываний 337): работа живёт в процессе ядра, и
// перезапуск ядра (пересборка, pm2) её убивает. Запись несёт `pid`; «идёт» — только если это тот же живой процесс и работа в нём
// действительно идёт. Иначе — «прервано», и кнопка снова доступна. ✗ Mac 2026-10-02: «Узел создаёт репозитории (начал в 22:41)»
// висело, хотя ядро пересобирали после старта.
export function readReposJob(): ReposJob {
  let job: ReposJob
  try { job = JSON.parse(readFileSync(FILE, "utf8")) as ReposJob } catch { return { running: false } }
  if (job.running && (job.pid !== process.pid || !g.__agiReposJob)) return { ...job, running: false, interrupted: true }
  return job
}

function write(job: ReposJob) {
  mkdirSync(join(process.cwd(), "data", "node", "github"), { recursive: true })
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(job, null, 2) + "\n", "utf8")
  renameSync(tmp, FILE)
}

/** Запустить создание репозиториев, если оно не идёт. Возвращает сразу. */
export function startReposJob(): ReposJob {
  if (g.__agiReposJob) return readReposJob()
  const prev = readReposJob()
  if (prev.retryAt && Date.parse(prev.retryAt) > Date.now()) return prev
  const startedAt = new Date().toISOString()
  write({ running: true, pid: process.pid, startedAt })
  g.__agiReposJob = (async () => {
    try {
      // 378: ход виден — какой элемент сейчас и сколько готово (владелец ждал «4 минуты» вслепую).
      const r = await createAllElementRepos((current, done, total) => write({ running: true, pid: process.pid, startedAt, current, done, total }))
      write({ running: false, startedAt, finishedAt: new Date().toISOString(), results: r.results, retryAt: r.retryAt, map: saveNodeMap() })
    } catch {
      write({ running: false, startedAt, finishedAt: new Date().toISOString(), results: [] })
    } finally {
      g.__agiReposJob = null
    }
  })()
  return readReposJob()
}
