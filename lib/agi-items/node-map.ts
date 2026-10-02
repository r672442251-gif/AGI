import "server-only"
import { spawnSync } from "node:child_process"
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { syncRegistryMap } from "@/lib/agi-items/registry-map.mjs"
import { storedToken } from "@/app/[lang]/(architectLayer)/architect/build/github/_github/server/token.cjs"

// КАРТА ПРОЕКТА УЕЗЖАЕТ В ФОРК ЧЕЛОВЕКА (шаг 374-1/374-5). Слово владельца 2026-10-02: «Если нужно восстановить весь проект то
// просто делаем Fork основного проекта» — уточнено: клон СВОЕГО форка, в нём карта, по ней установщик поднимает каждый элемент
// из репозитория человека.
//
// 🔒 СНИМОК — ОТДЕЛЬНЫЙ ФАЙЛ `AGI-ITEMS-CONFIG/agi-items.node.json`, А НЕ `agi-items.json`. Тот Fractera сама меняет, поднимая
// теги, — коммит человека в нём ломал бы «Sync fork» конфликтом при каждом выпуске. Снимок Fractera не выпускает никогда.
// 🔒 УЗЕЛ АВТОРА НИКУДА НЕ ОТПРАВЛЯЕТ: его `origin` — сам оригинал (`logs/origin.json` verdict `author`), и состояние узла ушло бы
// в публичный репозиторий Fractera. Отправляет только узел, чей `origin` — форк (verdict `fork`, шаг 368).
// 🔒 КОММИТ — ТОЛЬКО ЭТОГО ФАЙЛА (pathspec): прочие изменённые конфиги ядра не трогаются. Ключ — разовым адресом, не в `git remote`.

const ROOT = process.cwd()
const SNAPSHOT = join("AGI-ITEMS-CONFIG", "agi-items.node.json")

function git(args: string[]) {
  const r = spawnSync("git", ["-C", ROOT, "-c", "credential.helper=", ...args], {
    encoding: "utf8", windowsHide: true, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })
  return { rc: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

export type NodeMapResult = { ok: boolean; written: boolean; pushed: boolean; reason?: string }

/** Освежить карту, записать снимок и (на форке) закоммитить и отправить его. */
export function saveNodeMap(): NodeMapResult {
  const { registry } = syncRegistryMap(ROOT)
  if (!registry) return { ok: false, written: false, pushed: false, reason: "registry-unreadable" }
  const file = join(ROOT, SNAPSHOT)
  const next = JSON.stringify({ _: "Snapshot of this node's AGI ITEMS (step 374): every item with its port, address, own domain, description and repository. Restored by the installer on a fresh clone of this fork.", services: registry.services }, null, 2) + "\n"
  let prev = ""
  try { prev = readFileSync(file, "utf8") } catch { /* первый снимок */ }
  const written = prev !== next
  if (written) {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(tmp, next, "utf8")
    renameSync(tmp, file)
  }
  let origin: { verdict?: string; url?: string; branch?: string; slug?: string } | null = null
  try { origin = JSON.parse(readFileSync(join(ROOT, "logs", "origin.json"), "utf8")) } catch { /* нет отметки */ }
  if (origin?.verdict !== "fork" || !origin.slug) return { ok: true, written, pushed: false, reason: origin?.verdict === "author" ? "author-node" : "no-fork" }
  const token = storedToken()
  if (!token) return { ok: true, written, pushed: false, reason: "no-token" }
  if (git(["diff", "--quiet", "HEAD", "--", SNAPSHOT]).rc !== 0 || git(["ls-files", "--error-unmatch", SNAPSHOT]).rc !== 0) {
    if (git(["add", "--", SNAPSHOT]).rc !== 0) return { ok: false, written, pushed: false, reason: "commit-failed" }
    const c = git(["-c", "user.name=Fractera node", "-c", "user.email=node@fractera.local", "commit", "--quiet", "-m", "AGI ITEMS map (step 374)", "--", SNAPSHOT])
    if (c.rc !== 0) return { ok: false, written, pushed: false, reason: "commit-failed" }
  }
  const p = git(["push", `https://x-access-token:${token}@github.com/${origin.slug}.git`, `HEAD:refs/heads/${origin.branch || "main"}`])
  if (p.rc !== 0) return { ok: false, written, pushed: false, reason: /non-fast-forward|fetch first/i.test(p.out) ? "fork-ahead" : /403|denied/i.test(p.out) ? "no-write" : "push-failed" }
  return { ok: true, written, pushed: true }
}
