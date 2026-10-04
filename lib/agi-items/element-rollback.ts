import "server-only"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { elementDir } from "@/lib/agi-items/element-github"
import { elementCodeState } from "@/lib/agi-items/element-code-state"
import deployLock from "@/lib/deploy/deploy-lock.cjs"
import previewLock from "@/lib/deploy/preview-lock.cjs"

// ОТКАТ РОЖДЁННОГО ЭЛЕМЕНТА К ВЫБРАННОЙ ВЕРСИИ — НОВЫМ КОММИТОМ (шаг 322). Владелец 2026-09-27: «я у тебя не увидел кнопку
// откатить изменения?»; 2026-10-04: «да, начинаем 322, откат новым коммитом» и «Сохранить и откатить» для несохранённых правок.
// 🔒 История не переписывается: файлы выбранной версии ложатся НОВЫМ коммитом «Откат к <hash>: <тема>», и к любой версии,
// включая ту, что была до отката, можно вернуться тем же откатом. Несохранённые правки агента сначала уходят коммитом
// «Сохранено перед откатом» — ничего не теряется. Файлы, которые пишет сам узел (`NODE_WRITES` — настройки дизайна и проекта,
// tsconfig, метка установки), не откатываются: это не версия кода элемента, а состояние узла.
// Сборка — тем же путём, что «Развернуть» (`scripts/deploy-elements.mjs` вне дерева ядра: соседняя папка, без простоя; неудача —
// работает прежняя). Идёт развёртывание или ждёт предпросмотр — отказ словами, ничего не меняется.

const IDENT = ["-c", "user.name=Fractera node", "-c", "user.email=node@fractera.local"]
// Те же файлы узла, что `NODE_WRITES` (element-code-state.ts), — пути для git.
const EXCLUDE = [
  ":(exclude)DESIGN-CONFIG", ":(exclude)APP-CONFIG", ":(exclude)PLATFORM-CONFIG",
  ":(exclude,glob)**/tsconfig.json", ":(exclude,glob)**/next-env.d.ts", ":(exclude).install-stamp.json",
]

function git(dir: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true, timeout: 30_000 })
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() }
}

export type RollbackResult =
  | { ok: true; commit: string; saved: string | null; target: string }
  | { ok: false; error: "not-born" | "bad-commit" | "not-in-history" | "deploy-running" | "preview-pending" | "same-version" | "git-failed"; detail?: string }

export function rollbackElement(id: string, commit: string): RollbackResult {
  const dir = elementDir(id)
  if (!dir) return { ok: false, error: "not-born" }
  if (!/^[0-9a-f]{7,40}$/i.test(commit)) return { ok: false, error: "bad-commit" }
  if (deployLock.isRunning()) return { ok: false, error: "deploy-running" }
  if (previewLock.pendingPreview(process.cwd(), id)) return { ok: false, error: "preview-pending" }
  // Коммит обязан быть в истории элемента (предок HEAD), а не просто существовать в базе git.
  const full = git(dir, ["rev-parse", "--verify", `${commit}^{commit}`])
  if (!full.ok || !git(dir, ["merge-base", "--is-ancestor", full.out, "HEAD"]).ok) return { ok: false, error: "not-in-history" }
  const target = full.out.slice(0, 7)
  const subject = git(dir, ["log", "-1", "--format=%s", full.out]).out

  // 1. Несохранённые правки (кроме файлов узла) — коммитом, чтобы откат их не стёр.
  let saved: string | null = null
  if ((elementCodeState(dir)?.changed ?? 0) > 0) {
    if (!git(dir, ["add", "-A", "--", ".", ...EXCLUDE]).ok) return { ok: false, error: "git-failed", detail: "add" }
    const c = git(dir, [...IDENT, "commit", "--quiet", "-m", "Сохранено перед откатом / Saved before rollback"])
    if (!c.ok) return { ok: false, error: "git-failed", detail: c.out.slice(0, 300) }
    saved = git(dir, ["rev-parse", "--short=7", "HEAD"]).out
  }

  // 2. Файлы выбранной версии — новым коммитом. Файл, которого в выбранной версии не было, удаляется (так работает restore).
  const restore = git(dir, ["restore", `--source=${full.out}`, "--staged", "--worktree", "--", ".", ...EXCLUDE])
  if (!restore.ok) return { ok: false, error: "git-failed", detail: restore.out.slice(0, 300) }
  if (git(dir, ["diff", "--cached", "--quiet"]).ok) return { ok: false, error: "same-version" }
  const c = git(dir, [...IDENT, "commit", "--quiet", "-m", `Откат к ${target}: ${subject} / Rollback to ${target}`])
  if (!c.ok) return { ok: false, error: "git-failed", detail: c.out.slice(0, 300) }
  const head = git(dir, ["rev-parse", "--short=7", "HEAD"]).out

  // 3. Сборка тем же путём, что «Развернуть» — вне дерева процессов ядра (пересборка ядра её не убьёт).
  spawnSync(process.execPath, [join(process.cwd(), "scripts", "spawn-free.mjs"), join(process.cwd(), "scripts", "deploy-elements.mjs"), id], {
    cwd: process.cwd(), windowsHide: true, stdio: "ignore", timeout: 10_000,
  })
  return { ok: true, commit: head, saved, target }
}
