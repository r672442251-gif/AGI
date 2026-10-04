// @api create the named tunnel and the DNS record, then remember what happened
import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { getSession } from "@/lib/auth/get-session"
import { isTemporaryPublicAddress } from "@/lib/auth/temporary-address"
import {
  accountOfZone, createTunnel, deleteAddressRecords, findTunnel, listAddressRecords, listZones, setIngress, tunnelToken, upsertTunnelRecord,
  type IngressRule,
} from "@/lib/domain/cloudflare"
import { serviceUrl } from "@/lib/microservices/registry"
import { startDomainResident } from "@/lib/domain/resident"
import { applyDomainToAuth } from "@/lib/domain/auth-env"
import { startStaticCopyAll } from "@/lib/agi-items/static-copy-start.cjs"
import { spawnSync } from "node:child_process"
import { staleElements } from "@/lib/domain/stale-addresses.cjs"
import deployLock from "@/lib/deploy/deploy-lock.cjs"

// ДВЕРЬ АКТИВАЦИИ ДОМЕНА (259-3).
//
// 🔒 ПЯТЬ ДЕЙСТВИЙ ПО ПОРЯДКУ, И КАЖДОЕ МОЖЕТ ОТКАЗАТЬ ОТДЕЛЬНО: найти зону →
// узнать её учётную запись → создать туннель → взять его токен → задать правила
// входа и завести запись DNS. Общий ответ «не получилось» здесь был бы тупиком:
// лечение у каждого отказа своё.
//
// 🔒 АДРЕС УЗЛА СПРАШИВАЕТСЯ У НЕГО САМОГО (`logs/runtime.json`). Порт назначается
// при запуске и меняется; код, помнящий порт, в день смены стучится в пустоту.
//
// 🛑 ТОКЕН ЗАПУСКА ТУННЕЛЯ — ВТОРОЙ СЕКРЕТ, И ОН НЕ ВОЗВРАЩАЕТСЯ НАРУЖУ. Он
// ложится в `.env.local` рядом с ключом API; в ответе его нет.
//
// 🔒 ЧТО ВЫШЛО — ЗАПИСЫВАЕТСЯ В `logs/domain.json`, ОТКУДА ЧИТАЕТ ДВЕРЬ СОСТОЯНИЯ.
// Островок ничего не помнит сам: перезагрузи страницу — и он спросит заново.

export const dynamic = "force-dynamic"

const ROOT = process.cwd()
const ENV_FILE = join(ROOT, ".env.local")
const STATE_FILE = join(ROOT, "logs", "domain.json")
const KEY_NAME = "CLOUDFLARE_API_TOKEN"
const RUN_TOKEN = "CLOUDFLARE_TUNNEL_TOKEN"

function envValue(name: string): string | null {
  const fromProcess = process.env[name]?.trim()
  if (fromProcess) return fromProcess
  if (!existsSync(ENV_FILE)) return null
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && m[1] === name && m[2].trim()) return m[2].trim()
  }
  return null
}

function putEnv(name: string, value: string) {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : ""
  const re = new RegExp(`^${name}=.*$`, "m")
  const text = re.test(existing)
    ? existing.replace(re, `${name}=${value}`)
    : `${existing}${existing.endsWith("\n") || existing === "" ? "" : "\n"}${name}=${value}\n`
  writeFileSync(ENV_FILE, text, "utf8")
}

function nodeService(): string {
  try {
    const rt = JSON.parse(readFileSync(join(ROOT, "logs", "runtime.json"), "utf8")) as { port?: number }
    if (typeof rt.port === "number") return `http://localhost:${rt.port}`
  } catch { /* узел не сказал — ниже честный отказ */ }
  return ""
}

const fail = (reason: string, status = 400) => NextResponse.json({ ok: false, reason }, { status })

export async function POST(req: NextRequest) {
  // 🛑 ДВЕ РАЗНЫЕ БЕДЫ — ДВА РАЗНЫХ ОТВЕТА (найдено владельцем 2026-09-21).
  // Прежде обе отвечали `not-owner`, и человек, сидящий ЗА ЭТИМ САМЫМ
  // компьютером, читал «это можно сделать только на том компьютере, где работает
  // узел» — то есть чистую неправду. На деле он открыл страницу по публичному
  // адресу туннеля, а узел различает только имя хоста, не человека.
  // Отказ, называющий неверную причину, дороже отказа без причины: он уводит в
  // сторону, и человек ищет несуществующую поломку.
  if (isTemporaryPublicAddress(req)) return fail("temporary-address", 403)
  // 🔒 ВОШЕДШИЙ АРХИТЕКТОР, А НЕ «ЗАПРОС С ЭТОЙ МАШИНЫ» (324-1, решение владельца 2026-09-27). На собственном домене слой
  // закрыт входом; хозяин за клавиатурой проходит по-прежнему — `getSession` даёт ему роль.
  if (!(await getSession(req))?.roles.includes("architect")) return fail("not-owner", 403)

  const key = envValue(KEY_NAME)
  if (!key) return fail("no-key")

  let hostname = ""
  let removeAddressRecords = false
  try {
    const body = (await req.json()) as { hostname?: unknown; removeAddressRecords?: unknown }
    hostname = typeof body.hostname === "string" ? body.hostname.trim().toLowerCase() : ""
    removeAddressRecords = body.removeAddressRecords === true
  } catch { return fail("bad-request") }
  if (!hostname || !hostname.includes(".")) return fail("bad-hostname")

  const service = nodeService()
  if (!service) return fail("node-port-unknown")

  // Зона выбирается по САМОМУ ДЛИННОМУ совпадению с хвостом имени: у человека
  // может быть и `example.com`, и `sub.example.com` — короткое совпало бы первым.
  const zones = await listZones(key)
  if (!zones.ok) return fail(zones.reason)
  const zone = zones.result
    .filter((z) => hostname === z.name || hostname.endsWith(`.${z.name}`))
    .sort((a, b) => b.name.length - a.name.length)[0]
  if (!zone) return fail("zone-not-found")
  if (zone.status !== "active") return fail(`zone-${zone.status}`)

  // 🔒 ЧУЖИЕ АДРЕСНЫЕ ЗАПИСИ НА ИМЕНАХ УЗЛА — ПОКАЗАТЬ, А НЕ МОЛЧА СНЕСТИ (372). Слово владельца 2026-10-02: «может быть нам
  // надо посвятить кнопку исправить эту ошибку и ты сам уберешь лишние записи? … записи для … Google, recent, то наверное их и
  // не стоит удалять». Cloudflare переносит в новую зону записи, найденные у домена, и A/AAAA на корне, `architect.` или
  // `auth.` не дают завести CNAME туннеля. Без подтверждения — ничего не меняется, ответ 409 со списком; с подтверждением
  // снимаются ТОЛЬКО A и AAAA на этих именах (`deleteAddressRecords`, тот же закон, что у элементов, 324-3). MX, TXT и всё
  // прочее (почта Google, Resend, проверки) не трогаются никогда. Проверка — до создания туннеля, чтобы не оставлять полдела.
  const plannedNames = [hostname, serviceUrl("root") ? `architect.${zone.name}` : null, serviceUrl("auth") ? `auth.${zone.name}` : null]
    .filter((n): n is string => !!n)
  const conflicts = await listAddressRecords(key, zone.id, plannedNames)
  if (!conflicts.ok) return fail(conflicts.reason)
  if (conflicts.result.length > 0) {
    if (!removeAddressRecords) return NextResponse.json({ ok: false, reason: "address-records", records: conflicts.result }, { status: 409 })
    for (const n of plannedNames) {
      const removed = await deleteAddressRecords(key, zone.id, n)
      if (!removed.ok) return fail(removed.reason)
    }
  }

  const account = await accountOfZone(key, zone.id)
  if (!account.ok) return fail(account.reason)

  const name = `fractera-${hostname.replace(/[^a-z0-9]+/g, "-")}`
  const known = await findTunnel(key, account.result, name)
  if (!known.ok) return fail(known.reason)
  const tunnel = known.result
    ? { ok: true as const, result: known.result }
    : await createTunnel(key, account.result, name)
  if (!tunnel.ok) return fail(tunnel.reason)

  const runToken = await tunnelToken(key, account.result, tunnel.result)
  if (!runToken.ok) return fail(runToken.reason)

  // 🔒 ВХОД ИДЁТ ТЕМ ЖЕ ТУННЕЛЕМ НА `auth.<зона>` (259-8). Без этого правила кнопка
  // «Войти» на домене вела на петлю машины посетителя. Имя строится от ЗОНЫ, а не
  // от подключённого имени: сертификат Cloudflare покрывает `*.<зона>`, а
  // `auth.site.<зона>` — нет. Службы входа нет — правила нет, и это честно.
  const authService = serviceUrl("auth")
  const authHostname = authService ? `auth.${zone.name}` : null

  // 🔒 КОРЕНЬ ДОМЕНА — САЙТУ, ЯДРО — НА `architect.<зона>` (280-3, решение владельца 2026-09-23,
  // вариант «а»). Сайт — элемент `root`, сменный и независимый: упадёт ядро — корень домена
  // продолжит отвечать. Элемента `root` нет — корень, как раньше, ведёт на ядро, и поддомена
  // ядра не заводится: делить нечего.
  const siteService = serviceUrl("root")
  const architectHostname = siteService ? `architect.${zone.name}` : null
  const rules: IngressRule[] = [{ hostname, service: siteService ?? service }]
  if (architectHostname) rules.push({ hostname: architectHostname, service })
  if (authHostname && authService) rules.push({ hostname: authHostname, service: authService })

  const ingress = await setIngress(key, account.result, tunnel.result, rules)
  if (!ingress.ok) return fail(ingress.reason)

  const record = await upsertTunnelRecord(key, zone.id, hostname, tunnel.result)
  if (!record.ok) return fail(record.reason)

  if (architectHostname) {
    const architectRecord = await upsertTunnelRecord(key, zone.id, architectHostname, tunnel.result)
    if (!architectRecord.ok) return fail(`architect-${architectRecord.reason}`)
  }

  if (authHostname) {
    const authRecord = await upsertTunnelRecord(key, zone.id, authHostname, tunnel.result)
    if (!authRecord.ok) return fail(`auth-${authRecord.reason}`)
  }

  putEnv(RUN_TOKEN, runToken.result)
  process.env[RUN_TOKEN] = runToken.result

  // 🔒 ПОСТОЯННЫЙ АДРЕС ЗАПИСЫВАЕТСЯ В APP-CONFIG, И БЕЗ ЭТОГО ПОЛОВИНА РАБОТЫ
  // НАПРАСНА. `cfg.url` — единственное место, откуда узел узнаёт своё имя в
  // интернете, и от него зависят: канонический адрес каждой страницы, карта
  // сайта, разметка для поисковиков и сам факт разрешения индексации
  // (`hasPermanentAddress` в `lib/construct-metadata.ts`). Пока значение пусто,
  // сайт честно объявляет себя неиндексируемым — ровно ради этого и подключают
  // домен. Оставить его пустым значило бы построить дверь и не открыть её.
  //
  // 🛑 ЦЕНА НАЗВАНА: эти значения попадают в страницы НА СБОРКЕ. Домен заработает
  // сразу, а канонические адреса и карта сайта обновятся после пересборки —
  // человеку это говорится, а не выясняется им потом.
  const appConfigFile = join(ROOT, "APP-CONFIG", "app-config.json")
  let siteUrlWritten = false
  try {
    let cfg: Record<string, unknown> = {}
    if (existsSync(appConfigFile)) {
      try { cfg = JSON.parse(readFileSync(appConfigFile, "utf8")) as Record<string, unknown> } catch { cfg = {} }
    }
    // 280-3: адрес ЯДРА — его поддомен, когда корень отдан сайту; сайт держит свой адрес сам.
    cfg.url = `https://${architectHostname ?? hostname}`
    mkdirSync(join(ROOT, "APP-CONFIG"), { recursive: true })
    writeFileSync(appConfigFile, `${JSON.stringify(cfg, null, 2)}
`, "utf8")
    siteUrlWritten = true
  } catch {
    // Не смогли записать — это не повод считать активацию неудачной: туннель и
    // запись DNS уже созданы. Но и молчать нельзя: скажем человеку в ответе.
    siteUrlWritten = false
  }

  mkdirSync(join(ROOT, "logs"), { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify({
    zone: zone.name,
    zoneStatus: zone.status,
    tunnelName: name,
    tunnelId: tunnel.result,
    hostname,
    service,
    authHostname,
    architectHostname,
    authRouted: !!authHostname,
    siteUrlWritten,
    activatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8")

  // Порядок не случаен: окружение службы входа читает только что записанный
  // `logs/domain.json`, а житель туннеля — только что записанный токен.
  const auth = authHostname ? applyDomainToAuth() : { files: 0, restarted: false, reason: "no-auth-service" }
  const resident = startDomainResident()
  // 385-3: главный домен подключён — копия в Cloudflare каждому адресу узла (корень → root, поддомены элементов). Владелец
  // 2026-10-03: «Да, главный домен тоже». Выкладка вне дерева ядра, итог — строки на этой же странице.
  startStaticCopyAll(ROOT)
  // 387-2 (владелец 2026-10-04: «да, исправляй»): элементы, установленные ДО домена, помнят адреса компьютера (`ARCHITECT_URL`,
  // `NEXT_PUBLIC_AUTH_URL` — пишет только установщик), и вход с телефона вёл на `localhost:24680`. Узел сам пересобирает их тем же
  // путём, что «Развернуть» (`scripts/deploy-elements.mjs`, вне дерева ядра): сборка идёт рядом, сайт без простоя. Идёт другое
  // развёртывание — не перебиваем, называем в ответе.
  const stale = staleElements(ROOT).map((x: { id: string }) => x.id)
  let rebuilding: string[] = []
  let rebuildPostponed = false
  if (stale.length) {
    if (deployLock.isRunning()) rebuildPostponed = true
    else {
      spawnSync(process.execPath, [join(ROOT, "scripts", "spawn-free.mjs"), join(ROOT, "scripts", "deploy-elements.mjs"), ...stale], { cwd: ROOT, windowsHide: true, stdio: "ignore", timeout: 10_000 })
      rebuilding = stale
    }
  }
  // 324-1: страница «Активация домена» скрывает тексты «как получить домен», когда он подключён — перерисовать слой.
  revalidatePath("/[lang]", "layout")

  return NextResponse.json({
    ok: true, hostname, zone: zone.name, tunnel: name, siteUrlWritten, authHostname, architectHostname, auth, resident, rebuilding, rebuildPostponed, stale,
  })
}
