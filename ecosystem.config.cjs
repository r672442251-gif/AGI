// ЖИВУЧЕСТЬ СЕРВЕРА AGI — описание для pm2.
//
// Зачем он есть. `node server.js` умирает вместе с окном терминала и не
// возвращается после падения: человек, закрывший окно или перезагрузивший
// компьютер, остаётся без сайта и не понимает почему. pm2 — сменный блок над
// нашим server.js: он не знает о Next ничего и запускает ровно тот же файл,
// каким его запускает человек.
//
// 🔒 ОДИНАКОВО НА WINDOWS, macOS И LINUX. Решение владельца 2026-09-18: «i need
// macos . linlx - all». Поэтому здесь нет ни одной команды оболочки, ни одного
// пути через слэш и ни одного предположения о том, где живёт node: только node,
// который уже читает этот файл.
//
// 🛑 ЧЕГО ЭТОТ ФАЙЛ НЕ УМЕЕТ, И ЭТО НАЗВАНО ВСЛУХ. pm2 следит за ПРОЦЕССОМ.
// Отказ, ради которого затеян шаг 232, — процесс жив, а страницы отдают 500, —
// pm2 не видит и видеть не может: для него это `online`. Ловит такое только
// проверка по HTTP, и она живёт отдельно (232-3, `scripts/health-watch.mjs`).

const path = require('node:path')
const paths = require('./lib/agi-items/paths.cjs')
const fs = require('node:fs')

const root = __dirname

// ── ЖИТЕЛИ СМЕННЫХ БЛОКОВ ПОРОЖДАЮТСЯ ИЗ РЕЕСТРА, А НЕ ПЕРЕЧИСЛЯЮТСЯ (257-5).
//
// 🔒 ПОЧЕМУ НЕ СПИСКОМ. Состав узла меняется: блок покупают, заменяют, удаляют
// строкой в AGI-ITEMS-REGISTRY/agi-items.json. Рукописный список здесь разошёлся бы с реестром
// молча — и в худшую сторону: pm2 поднимал бы удалённую службу или не поднимал
// купленную, а ни сборка, ни типы этого не видят.
//
// 🔒 ПО ДВА ЖИТЕЛЯ НА БЛОК — ЗАКОН ПРОЕКТА, А НЕ ОСТОРОЖНОСТЬ. Диспетчер
// процессов не видит состояния «жив, но не отвечает»: для pm2 служба, отдающая
// 500 на каждый запрос, — `online`. Ловит это только опрос по HTTP, и он живёт
// отдельным процессом рядом со службой.
//
// Чем именно запускать блок, знает не этот файл, а отметка установки
// `.install-stamp.json`: путь к собранному серверу — машинный факт, он выясняется
// установщиком на той машине, где собирали.
function serviceApps() {
  let registry
  try {
    registry = JSON.parse(fs.readFileSync(paths.REGISTRY_FILE, 'utf8'))
  } catch {
    return [] // реестра нет — узел без блоков, это законное состояние
  }

  const apps = []
  for (const s of registry.services || []) {
    const dir = paths.entryDir(s)
    const stampFile = path.join(dir, '.install-stamp.json')
    // Блок объявлен, но не установлен — его нечем запускать, и придумывать
    // команду нельзя: pm2 ушёл бы в вечный рестарт по несуществующему файлу.
    if (!fs.existsSync(stampFile)) continue
    let stamp
    try { stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8')) } catch { continue }
    if (!stamp.start || !Number.isInteger(stamp.port)) continue

    apps.push({
      name: `fractera-svc-${s.id}`,
      script: stamp.start.args[0],
      // 367-4: запускатель элемента из репозитория получает режим вторым аргументом (`fractera-start.mjs next`); у прежних служб — пусто.
      args: stamp.start.args.slice(1),
      cwd: stamp.start.cwd || dir,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: 20000,
      max_restarts: 10,
      exp_backoff_restart_delay: 1000,
      kill_timeout: 10000,
      out_file: path.join(root, 'logs', `svc-${s.id}-out.log`),
      error_file: path.join(root, 'logs', `svc-${s.id}-err.log`),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        // Порт и адрес — приказ узла. Всё остальное служба читает из своего
        // файла окружения, имя которого она же и назвала в паспорте.
        PORT: String(stamp.port),
        HOSTNAME: '127.0.0.1',
      },
    })

    apps.push({
      name: `fractera-svc-${s.id}-watch`,
      script: path.join(root, 'scripts', 'health-watch.mjs'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: 20000,
      max_restarts: 10,
      out_file: path.join(root, 'logs', `svc-${s.id}-watch.log`),
      error_file: path.join(root, 'logs', `svc-${s.id}-watch.log`),
      merge_logs: true,
      time: true,
      env: {
        // Сторож в режиме службы: спрашивает НЕ сайт узла, а дверь этого блока,
        // и перезапускает именно его.
        FRACTERA_WATCH_SERVICE: s.id,
        FRACTERA_APP_NAME: `fractera-svc-${s.id}`,
        FRACTERA_HEALTH_INTERVAL_MS: '30000',
        FRACTERA_HEALTH_FAILURES: '3',
        // Службе не нужно компилировать страницы: она собрана. Пауза короче, чем
        // у узла, но не нулевая — после перезапуска ей нужны секунды, чтобы
        // открыть базу и встать на порт.
        FRACTERA_HEALTH_COOLDOWN_MS: '30000',
      },
    })
  }
  return apps
}

module.exports = {
  apps: [
    {
      name: 'fractera-agi',
      script: path.join(root, 'server.js'),
      cwd: root,

      // Один процесс, не кластер. Next в режиме разработки держит собственные
      // рабочие процессы и компилятор; второй экземпляр поверх них дал бы двух
      // претендентов на один порт — тот самый класс отказа, которым оплачен
      // закон «после reload сверить, кто держит порт».
      instances: 1,
      exec_mode: 'fork',

      // 🛑 ОТКЛЮЧЕНО НАМЕРЕННО. С `watch: true` pm2 перезапускал бы сервер на
      // каждое сохранение файла — поверх горячей перезагрузки самого Next.
      // Две системы слежения за одними файлами дерутся, и правка теряется.
      watch: false,

      autorestart: true,

      // Защита от вечного рестарта. Оплачено на боевом сервере: 43 268
      // рестартов при uptime≈0, и `pm2 list` всё это время писал `online`.
      // Процесс, не проживший 20 секунд, считается не запустившимся; после
      // десяти таких попыток pm2 останавливается и оставляет след в логе —
      // честная остановка лучше бесконечной имитации работы.
      min_uptime: 20000,
      max_restarts: 10,
      exp_backoff_restart_delay: 1000,

      // Next не мгновенно отпускает порт: ему нужно закрыть соединения и
      // остановить компилятор. Убитый раньше времени, он оставляет сироту,
      // которая держит порт и отвечает старой сборкой.
      kill_timeout: 10000,

      out_file: path.join(root, 'logs', 'agi-out.log'),
      error_file: path.join(root, 'logs', 'agi-err.log'),
      merge_logs: true,

      // Без отметки времени лог отвечает на вопрос «что случилось» и молчит о
      // том, «когда» — а при разборе падения второе и есть главное.
      time: true,

      // 🔒 PORT ЗДЕСЬ НЕ ЗАДАЁТСЯ НАМЕРЕННО. Порт выбирает `lib/server-port.cjs`
      // — один источник на весь проект: блок 24680–25679 и уступка следующему
      // свободному, если наш занят. Назначь мы порт и здесь, источников стало бы
      // два, и однажды они разошлись бы молча. Переменная PORT остаётся приказом
      // человека: задал — сервер встанет ровно там или честно не встанет.
      env: {
        // 🔒 ПРОДАКШН, А НЕ РАЗРАБОТКА — решение владельца 2026-09-18, дословно:
        // «мне режим разработки не нужен вообще». Это не вкусовая настройка: в dev
        // каждая страница компилируется при первом заходе, а компиляция порождает
        // дочерние процессы (postcss, воркеры), и Windows открывает каждому чёрное
        // окно консоли поверх всего экрана. Собранный сайт не компилирует ничего.
        //
        // 🛑 ОТСЮДА ОБЯЗАННОСТЬ: после правки кода нужна ПЕРЕСБОРКА (npm run
        // serve:rebuild). Иначе сайт продолжает отдавать прежнюю сборку, и это
        // выглядит как «правка не применилась».
        NODE_ENV: 'production',
      },
    },

    // ── ВТОРОЙ ЖИТЕЛЬ: СТОРОЖ ЗДОРОВЬЯ. Он не служба и порта не слушает — он
    // спрашивает сайт по HTTP и ловит то единственное состояние, ради которого
    // затеян шаг 232: процесс жив, а страницы не отдаются. pm2 для этого
    // непригоден по устройству, и в этом нет его вины: он следит за процессом.
    {
      name: 'fractera-agi-watch',
      script: path.join(root, 'scripts', 'health-watch.mjs'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: 20000,
      max_restarts: 10,

      out_file: path.join(root, 'logs', 'watch-out.log'),
      error_file: path.join(root, 'logs', 'watch-err.log'),
      merge_logs: true,
      time: true,

      env: {
        // Сроки вынесены сюда, а не зашиты в скрипт: их придётся подбирать под
        // машину человека, и подбор не должен быть правкой кода.
        FRACTERA_HEALTH_INTERVAL_MS: '30000',
        FRACTERA_HEALTH_FAILURES: '3',
        FRACTERA_HEALTH_COOLDOWN_MS: '120000',
      },
    },

    // ── ТРЕТИЙ ЖИТЕЛЬ: ТУННЕЛЬ В ИНТЕРНЕТ.
    //
    // 🪦 «Он не запускается вместе с сайтом» — отменено владельцем 2026-10-02 (371-1) и к тому же было неправдой:
    // serve:start звал `pm2 start ecosystem` целиком и перезапускал туннель каждый раз (новый адрес). Теперь serve:start
    // поднимает всех жителей, КРОМЕ этого (`--only`), а туннель открывает `publish()` — сам на первом запуске и с
    // сохранением живого адреса потом.
    //
    // Включённый однажды, он попадает в снимок pm2 save и дальше поднимается
    // сам при входе в систему — вместе с остальными.
    {
      name: 'fractera-agi-tunnel',
      script: path.join(root, 'scripts', 'tunnel.mjs'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: 20000,
      max_restarts: 10,
      exp_backoff_restart_delay: 2000,

      out_file: path.join(root, 'logs', 'tunnel-out.log'),
      error_file: path.join(root, 'logs', 'tunnel-err.log'),
      merge_logs: true,
      time: true,

      env: {
        // 🔒 СРОКИ ДОЗОРНОГО ТУННЕЛЯ (237-1). Он опрашивает публичный адрес и
        // ловит то, чего не видит ни pm2, ни сам cloudflared: туннель удалён со
        // стороны Cloudflare, а процесс жив и бодро перерегистрируется. Сроки
        // здесь, а не в коде: подбирать их придётся под сеть человека.
        //
        // 🛑 pm2 ХРАНИТ ОКРУЖЕНИЕ ПРОЦЕССА: изменив эти значения, нужен
        // `pm2 delete fractera-agi-tunnel` и `pm2 start` заново — ни reload, ни
        // `--update-env` старого окружения не вычищают. Встречено дважды за один
        // вечер 2026-09-18 и оба раза выглядело как «правка не применилась».
        FRACTERA_TUNNEL_INTERVAL_MS: '60000',
        FRACTERA_TUNNEL_FAILURES: '3',
        FRACTERA_TUNNEL_TIMEOUT_MS: '15000',
      },
    },
    // ИМЕНОВАННЫЙ ТУННЕЛЬ — ПОСТОЯННЫЙ АДРЕС ЧЕЛОВЕКА (259-4).
    //
    // 🔒 ОН ЖИВЁТ РЯДОМ С БЫСТРЫМ, А НЕ ВМЕСТО НЕГО. Пока домен не подключён,
    // житель спокойно спит — это законное состояние, а не отказ. Снимать быстрый
    // туннель, не убедившись, что домен отвечает, значит оставить человека без
    // сайта в интернете на время, которое мы не контролируем: запись DNS
    // расходится минутами.
    //
    // 🛑 ЗДЕСЬ САМОЛЕЧЕНИЕ РАЗРЕШЕНО, И ЭТО НЕ ПРОТИВОРЕЧИТ ЗАПРЕТУ ВЛАДЕЛЬЦА.
    // Запрет 2026-09-19 защищал РОЗДАННУЮ ССЫЛКУ быстрого туннеля: его
    // перезапуск давал новый адрес, и чужая ссылка умирала молча. У именованного
    // туннеля имя принадлежит человеку и не меняется никогда — защищать нечего,
    // а молчащий сайт надо поднимать.
    {
      name: 'fractera-agi-domain',
      script: path.join(root, 'scripts', 'domain-tunnel.mjs'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: 20000,
      max_restarts: 10,
      exp_backoff_restart_delay: 2000,

      out_file: path.join(root, 'logs', 'domain-out.log'),
      error_file: path.join(root, 'logs', 'domain-err.log'),
      merge_logs: true,
      time: true,

      env: {
        // 🛑 pm2 ХРАНИТ ОКРУЖЕНИЕ: изменив эти значения, нужен `pm2 delete` и
        // `pm2 start` заново — ни reload, ни `--update-env` их не вычищают.
        FRACTERA_DOMAIN_INTERVAL_MS: '60000',
        FRACTERA_DOMAIN_FAILURES: '3',
        FRACTERA_DOMAIN_TIMEOUT_MS: '15000',
      },
    },
    // Сюда дописываются жители сменных блоков — по два на каждый установленный.
    ...serviceApps(),
  ],
}
