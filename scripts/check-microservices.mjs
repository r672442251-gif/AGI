// СТОРОЖ СОСТАВА УЗЛА: AGI-ITEMS-REGISTRY/agi-items.json (257-3; имена — 272).
//
// 🔒 ЧТО ОН ОХРАНЯЕТ И ПОЧЕМУ ИМЕННО ЭТО. Реестр — единственное место, где узел
// узнаёт адрес службы, и он лежит в git, то есть уезжает КАЖДОМУ гостю. Три вещи
// здесь ломаются молча, и ни одну не видят ни типы, ни сборка:
//
//   1. версия, записанная веткой вместо тега → два человека, выполнившие одну и ту
//      же команду в разные дни, получают разные узлы, и отличие не записано нигде;
//   2. два блока на одном порту → они подерутся при запуске, и проигравший будет
//      выглядеть сломанной службой, а не занятым портом;
//   3. секрет, попавший в реестр → уедет каждому гостю вместе с репозиторием.
//
// 🛑 ПРИБОР ПРОВЕРЯЕТСЯ ПОРЧЕЙ, А НЕ ЗЕЛЁНЫМ ЦВЕТОМ. У каждого правила ниже есть
// своя порча, и она названа в его комментарии. Зелёный цвет означает порядок
// только после того, как доказано, что сторож умеет краснеть.
//
// 🔒 ПОЧЕМУ `port: null` — ЭТО НЕ ОШИБКА. Узел, который только что скопировали,
// ещё не выполнял установку: службы объявлены, но не поставлены. Это законное
// состояние, и сторож обязан его пропускать — иначе свежий клон не собирается.

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import paths from '../lib/agi-items/paths.cjs'
import serverPort from '../lib/server-port.cjs'

const ROOT = process.cwd()
const FILE = paths.REGISTRY_FILE

// 370: блок и чужие умолчания — из одного источника (lib/server-port.cjs), второй копии чисел здесь нет.
const PORT_MIN = serverPort.PORT_BLOCK_START
const PORT_MAX = serverPort.PORT_BLOCK_END

const out = []
let errors = 0
const fail = (rule, m) => { errors += 1; out.push(`  ОШИБКА [${rule}]: ${m}`) }
// Долги repo-https: элемент ещё не на GitHub и едет из локального репозитория. Закрывается ТОЙ ЖЕ правкой, что меняет адрес.
// Сейчас долгов нет. Закрыт 2026-09-26: design переехал на https://github.com/Fractera/fractera-design-starter.git.
const REPO_DEBTS = {}
const debts = []

// ── 1. registry-parse. Порча: сломать JSON запятой.
if (!existsSync(FILE)) {
  console.log(`  ОШИБКА [registry-missing]: нет файла ${FILE}`)
  console.log('===MICROSERVICES_FAILED===')
  process.exit(1)
}

let reg
try {
  reg = JSON.parse(readFileSync(FILE, 'utf8'))
} catch (e) {
  console.log(`  ОШИБКА [registry-parse]: файл не разбирается как JSON — ${e.message}`)
  console.log('===MICROSERVICES_FAILED===')
  process.exit(1)
}

if (!Array.isArray(reg.services)) {
  console.log('  ОШИБКА [registry-shape]: нет массива services')
  console.log('===MICROSERVICES_FAILED===')
  process.exit(1)
}

const ids = new Map()
const ports = new Map()

// Имена полей, само присутствие которых означает, что в реестр попал секрет.
// Список намеренно шире нужного: реестр описывает УСТРОЙСТВО, и ни одно значение
// такого рода здесь не имеет законного применения.
const SECRET_NAMES = /(secret|token|password|passwd|apikey|api_key|credential|private)/i

for (const [i, s] of reg.services.entries()) {
  const where = `services[${i}]${s && s.id ? ` (${s.id})` : ''}`

  if (!s || typeof s !== 'object') { fail('entry-shape', `${where}: не объект`); continue }

  // ── 2. id-format. Порча: написать id с пробелом или заглавными.
  if (typeof s.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(s.id)) {
    fail('id-format', `${where}: id обязан быть строчными латинскими, цифрами и дефисом, 1–32 знака`)
  } else {
    // ── 3. id-unique. Порча: продублировать блок.
    if (ids.has(s.id)) fail('id-unique', `${where}: id «${s.id}» уже занят в services[${ids.get(s.id)}]`)
    else ids.set(s.id, i)
  }

  // ── 4. repo-https. Порча: заменить адрес на ssh или на путь на диске.
  // 🔒 ДОЛГ, А НЕ ИСКЛЮЧЕНИЕ (закон трёх вердиктов): адрес назван, у долга есть дата и решающий, печатается каждый прогон.
  if (REPO_DEBTS[s.id] && s.repo === REPO_DEBTS[s.id].repo) { debts.push(`  ДОЛГ [repo-https] ${s.id}: ${REPO_DEBTS[s.id].why}`) }
  else if (typeof s.repo !== 'string' || !/^https:\/\/.+\.git$/.test(s.repo)) {
    fail('repo-https', `${where}: repo обязан быть https-адресом, оканчивающимся на .git — получено «${s.repo}»`)
  }

  // ── 5. version-pinned. Порча: поставить "main". ЭТО ГЛАВНОЕ ПРАВИЛО ФАЙЛА.
  // ИСКЛЮЧЕНИЕ (367-4): элемент, рождённый из репозитория человека (`born.from === 'repository'`), установщик не клонирует никогда,
  // а тегов узла у чужого проекта нет — версия у него коммит. Правило «тег» защищает клонирование и сюда не относится.
  if (s.born?.from === 'repository') { /* исключение — см. выше */ }
  else if (typeof s.version !== 'string' || !/^v\d+\.\d+\.\d+([-+].+)?$/.test(s.version)) {
    fail('version-pinned',
      `${where}: version обязана быть ТЕГОМ вида v1.2.3 — получено «${s.version}». ` +
      'Ветка здесь запрещена: следуя за ней, два гостя с одной командой получают разные узлы.')
  }

  // ── 6. port-block. Порча: поставить 3001 или 50505.
  if (s.port !== null && s.port !== undefined) {
    if (Number.isInteger(s.port) && serverPort.PORT_SKIP.has(s.port)) {
      fail('port-block', `${where}: порт ${s.port} — умолчание чужой программы человека (список пропуска в lib/server-port.cjs); узел его не занимает.`)
    } else if (!Number.isInteger(s.port) || s.port < PORT_MIN || s.port > PORT_MAX) {
      fail('port-block',
        `${where}: порт ${s.port} вне блока ${PORT_MIN}–${PORT_MAX}. ` +
        'Ниже блока мы отбираем порты у собственных проектов человека, выше 49152 их раздаёт ОС исходящим соединениям.')
    } else {
      // ── 7. port-unique. Порча: дать двум блокам один номер.
      if (ports.has(s.port)) fail('port-unique', `${where}: порт ${s.port} уже занят блоком «${ports.get(s.port)}»`)
      else ports.set(s.port, s.id)
    }
  }

  // ── 8. provides-nonempty. Порча: оставить пустой массив.
  if (!Array.isArray(s.provides) || s.provides.length === 0) {
    fail('provides-nonempty',
      `${where}: provides пуст. Блок, не назвавший, что он даёт, нечем заменить: ` +
      'покупатель не узнает, чью способность он берёт.')
  }

  // ── 9. no-secrets. Порча: дописать в блок "token": "abc…".
  for (const [k, v] of Object.entries(s)) {
    if (SECRET_NAMES.test(k)) {
      fail('no-secrets', `${where}: поле «${k}» похоже на секрет. Реестр лежит в git и уезжает каждому гостю.`)
    }
    if (typeof v === 'string' && /^[A-Za-z0-9+/_-]{24,}={0,2}$/.test(v) && !/^v\d/.test(v)) {
      fail('no-secrets', `${where}: значение поля «${k}» выглядит ключом (${v.length} знаков без пробелов).`)
    }
  }
}

// ── 9а. required-present (280-1). Порча: убрать из реестра строку data.
// 🔒 ТРИ ЭЛЕМЕНТА НУЖНЫ ЛЮБОМУ УЗЛУ, И ИХ МОЖНО ЗАМЕНИТЬ, НО НЕЛЬЗЯ УБРАТЬ: вход, данные и
// сайт. Слово владельца 2026-09-23: сайт «станет третьим обязательным сервисом». Заменяют их
// строкой repo + version; узел без одного из них собирается и молча не работает — вход без
// раздающей, данные без двери, домен без сайта.
// 297: root — пользовательский элемент (AGI-ITEMS/user), не обязательный. Слово владельца 2026-09-25: «это на ряду с root
// нужно передвинуть в AGI ITEMS /user как второй кастомный сервис».
const REQUIRED = ['auth', 'data']
for (const id of REQUIRED) {
  const s = reg.services.find((x) => x && x.id === id)
  if (!s) fail('required-present', `обязательного элемента «${id}» нет в составе узла. Его можно заменить другим репозиторием, но не убрать.`)
  else if (s.required !== true || s.kind !== 'core') {
    fail('required-present', `элемент «${id}» обязан стоять с required: true и kind: core.`)
  }
}


// ── 10. no-remembered-address. Порча: вернуть "http://localhost:3300" в любую
// дверь медиа. ПРАВИЛО НЕ ПРО РЕЕСТР, А ПРО КОД УЗЛА, и живёт здесь потому, что
// сторож реестра — единственное место, знающее, что адрес назначается, а не
// помнится. Порты узла берутся из блока 24680-25679 и чисел 3001/3300 не
// содержат никогда: умолчание с этими номерами есть тихий стук в пустоту.
{
  // Адрес бывает не только строкой целиком: `${hostname}:3001` — тот же адрес,
  // собранный из кусков. ✗ оплачено 257-6: правило видело только первое, и дверь
  // `/api/users` осталась с зашитым портом, отвечая 502 при живой службе.
  const ADDRESS = /(localhost|}):(3001|3300)\b/
  const ENV_ADDRESS = /process\.env\.(AUTH_SERVICE_URL|REMOTE_DATA_URL)/
  // Единственная дверь, которой это разрешено, — и она названа поимённо.
  // 🔒 ИСКЛЮЧЕНИЕ, А НЕ ПОСЛАБЛЕНИЕ: `runtime-urls.ts` помечен "use client" и
  // уезжает в браузер — прочитать реестр он не может, с ним уехал бы `node:fs`.
  // Браузерная половина получает адрес переменной, которую пишет установщик.
  const ALLOWED = /^lib\/(microservices\/urls\.(ts|mjs)|runtime-urls\.ts)$/
  const CODE = /\.(ts|tsx|mjs|cjs)$/

  let tracked = []
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 })
      .split('\n').map((x) => x.trim()).filter(Boolean)
  } catch (e) {
    // 🛑 ОПЛАЧЕНО ЗДЕСЬ ЖЕ, 2026-09-20: сначала стояло `catch { tracked = [] }`,
    // и правило молча проверяло НОЛЬ файлов, оставаясь зелёным при внесённой
    // порче. Отсутствие источника — это отказ, а не пустой список.
    fail('no-remembered-address', 'не удалось перечислить файлы через git: ' + e.message +
      '. Правило не выполнено — зелёный цвет здесь означал бы, что смотреть было нечем.')
    tracked = []
  }

  for (const rel of tracked) {
    if (!CODE.test(rel)) continue
    if (rel.startsWith('.claude/') || rel.startsWith('AGI-ITEMS/')) continue
    if (ALLOWED.test(rel)) continue
    let text
    try { text = readFileSync(join(ROOT, rel), 'utf8') } catch { continue }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const bare = line.trim()
      // Сноски не считаются: они объясняют прошлое, а не задают адрес.
      if (bare.startsWith('//') || bare.startsWith('*') || bare.startsWith('/*')) continue
      // 🔒 ТРЕТИЙ ВЕРДИКТ — ИСКЛЮЧЕНИЕ: строка объявляет себя принадлежащей линии
      // `aifa.dev`, где реестра нет вовсе и порты 3001/3300 законны. Объявление
      // стоит РЯДОМ С КОДОМ и ищется одним grep — в отличие от списка файлов,
      // который слепит сторожа целиком.
      if (/SERVER-LINE-ADDRESS/.test(line) || (i > 0 && /SERVER-LINE-ADDRESS/.test(lines[i - 1]))) continue
      if (ADDRESS.test(line)) {
        fail('no-remembered-address',
          `${rel}:${i + 1}: адрес службы записан в коде. Порт назначает установщик и пишет в ` +
          'agi-items.json; спрашивать его надо у lib/microservices/urls.ts.')
      } else if (ENV_ADDRESS.test(line)) {
        fail('no-remembered-address',
          `${rel}:${i + 1}: адрес службы берётся из окружения напрямую. Единственная дверь — ` +
          'lib/microservices/urls.ts: она спрашивает реестр и лишь потом окружение.')
      }
    }
  }
}

console.log(`  блоков в составе: ${reg.services.length}`)
console.log(`  с назначенным портом: ${ports.size}` + (ports.size < reg.services.length
  ? ` (остальные ещё не установлены — это законное состояние)` : ''))
for (const s of reg.services) {
  console.log(`    ${s.id} — ${s.version} — порт ${s.port ?? 'не назначен'} — даёт: ${(s.provides || []).join(', ')}`)
}

if (debts.length) console.log(debts.join('\n'))
if (errors > 0) {
  console.log(out.join('\n'))
  console.log(`===MICROSERVICES_FAILED=== нарушений: ${errors}`)
  process.exit(1)
}

console.log('===MICROSERVICES_OK===')
