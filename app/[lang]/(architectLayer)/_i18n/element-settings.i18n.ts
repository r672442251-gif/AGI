// СЛОВА РАЗДЕЛА «НАСТРОЙКИ» (DANGER ZONE) AGI ЭЛЕМЕНТА (325). `en` основа, `ru` перевод; строки выбирает сервер.

type Card = { title: string; text: string; action: string; pending: string }

export type ElementSettingsUi = {
  badge: string
  notBorn: string
  agentNotBorn: string
  describe: Card
  mirrorCard: {
    current: string; label: string; placeholder: string; attach: string; attaching: string; detach: string; detaching: string; primaryTitle: string; primaryNote: string; empty: string; add: string; loadFailed: string; note: string
    kinds: Record<"ready" | "waiting" | "taken" | "current", string>; errors: Record<string, string>
  }
  addressCard: { current: string; label: string; free: string; "bad-shape": string; taken: string; suggest: string; renaming: string; failed: string; note: string; restart: string; repoNote: string; repoRenamed: string; repoFailed: string }
  describeCard: { empty: string; take: string; taking: string; taken: string; takenAt: string; how: string; errors: Record<string, string> }
  address: Card
  mirror: Card
  config: Card
  design: Card
  blocks: Card
  siteSettings: { text: string; configOn: string; configOff: string; open: string }
  linkCard: { on: string; off: string; turnOn: string; turnOff: string; busy: string; failed: string }
  remove: Card
  removeDialog: { title: string; text: string; label: string; confirm: string; deleting: string; cancel: string; mismatch: string; failed: string; riskNever: string; riskAhead: string; riskNone: string }
}

const DICT: Record<string, ElementSettingsUi> = {
  en: {
    badge: "Danger zone",
    notBorn: "The element is not born yet: give birth to it on its home page — its settings appear after that.",
    agentNotBorn: "The element is not born yet: give birth to it on its home page — then its agent, Claude Code, can be started here.",
    describe: {
      title: "Capabilities description",
      text: "The element's agent reads its code and writes what the element can do; the node then keeps it as the element's record in the core.",
      action: "Generate the description",
      pending: "Being built (step 325-2).",
    },
    mirrorCard: {
      current: "Connected:",
      label: "Node domains",
      placeholder: "Choose a domain",
      attach: "Connect",
      attaching: "Connecting…",
      detach: "Disconnect",
      detaching: "Disconnecting…",
      primaryTitle: "Main address",
      primaryNote: "The site is served at {primary} and calls itself so (canonical, sitemap, hreflang); the other address answers 301 to it.",
      empty: "The node has no extra domains yet — add one on «Domain activation».",
      add: "Add a domain",
      loadFailed: "The list of domains did not load.",
      note: "A domain is added and brought to an active zone on «Domain activation»; here you only choose it. www.<domain> will lead to the root; the old subdomain will lead to the domain.",
      kinds: {
        ready: "free · ready",
        waiting: "free · waiting for name servers (finish it on «Domain activation»)",
        taken: "connected to the element {by}",
        current: "connected to this element",
      },
      errors: {
        "not-in-list": "This domain is not among the node's domains — add it on «Domain activation».",
        taken: "This domain is already connected to another element.",
        pending: "The zone is not active yet — finish the name servers on «Domain activation».",
        "not-visible": "The node's Cloudflare key does not see this zone.",
        "no-key": "The node has no Cloudflare key.",
        "cloudflare-error": "Cloudflare did not answer.",
        "write-failed": "The node could not save the choice.",
        "no-tunnel": "The node has no tunnel of its own yet — connect the main domain first (Domain activation).",
        "other-account": "This domain is in another Cloudflare account than the node — the node tunnel cannot serve it.",
        "tunnel-failed": "Cloudflare did not accept the tunnel route.",
        "dns-failed": "Cloudflare did not accept the DNS record.",
        "no-port": "The element has no port on this node.",
        "no-subdomain": "The element has no subdomain yet — connect «Address on the internet» on its home page first.",
        "no-domain": "No domain is connected to the element.",
        failed: "Connecting did not finish.",
      },
    },
    addressCard: {
      current: "Address in the core:",
      label: "New address",
      free: "The name is free.",
      "bad-shape": "4-24 characters: lowercase Latin letters, digits and single hyphens, starting with a letter.",
      taken: "The name is taken — by a section of the core, another element or a service.",
      suggest: "Free:",
      renaming: "Renaming…",
      failed: "The address was not changed:",
      note: "The inner name {id} stays: the process and the data keep it. The element's folder moves under the new address, and a connected internet address moves to the new name.",
      restart: "The element will restart: its address will be unavailable for about a minute.",
      repoNote: "Its GitHub repository, if the node named it, is renamed with it; a repository you connected under your own name keeps its name.",
      repoRenamed: "The GitHub repository is renamed: {from} → {to}. GitHub redirects the old links itself; do not create a new repository with the old name — that breaks the redirect.",
      repoFailed: "The element is renamed, its GitHub repository {from} is not: {reason}. Rename it on GitHub by hand or rename the element again.",
    },
    describeCard: {
      empty: "The core has no description of this element yet.",
      take: "Take into the core",
      taking: "Taking…",
      taken: "The description is now the element's record in the core.",
      takenAt: "Taken into the core:",
      how: "1. Generate — the element's terminal opens with the task; start the agent and send it. The agent writes the description into the element's passport, commits it and hands it to the core itself (npm run describe:publish). 2. If the agent could not hand it over — take it into the core with the button.",
      errors: {
        "passport-unreadable": "The element's passport OWN-SERVICE-PROPS.json cannot be read.",
        "summary-missing": "The passport has no summary — the agent has not written it yet.",
        "summary-not-written": "The summary in the passport is still the template's or the birth's one — the agent has not written its own yet.",
        "provides-missing": "The passport names no capabilities (provides is empty).",
        "provides-bad-shape": "The capability names in provides have the wrong shape: 1-20 unique names, lowercase words joined by hyphens.",
        "registry-failed": "The node's registry could not be written.",
        unknown: "The description was not taken:",
      },
    },
    address: {
      title: "Element address",
      text: "Rename the address of the element's pages in the core, with a check that the new name is free. The inner name (id) stays the same; the old address leads to the new one.",
      action: "Rename the address",
      pending: "Being built (step 325-3).",
    },
    config: {
      title: "Sync with CONFIG",
      text: "Project settings (name, description, SEO, icons, languages) come from the CONFIG element. Turned off, the element keeps the last settings it got as its own and changes them only on its own settings page.",
      action: "", pending: "",
    },
    design: {
      title: "Sync with Design",
      text: "Colours, fonts and shapes come from the Design element when it is saved. Turned off, the element keeps the last design it got.",
      action: "", pending: "",
    },
    blocks: {
      title: "Sync with Blocks",
      text: "The element's agent takes ready blocks from the Blocks registry. Turned off, the registry is removed from components.json; blocks already taken stay in the element's code.",
      action: "", pending: "",
    },
    siteSettings: {
      text: "The site settings of this element — name, description, search settings, images, icons and languages — live on the element's own site and open there, on its main address, where you are signed in through the node.",
      configOn: "Sync with CONFIG is on: these settings come from the CONFIG element, and the element's own settings page shows them without saving. Turn the sync off in «Danger zone» to give the element its own settings.",
      configOff: "Sync with CONFIG is off: the element lives by its own settings, and they are saved on its settings page.",
      open: "Open the site settings",
    },
    linkCard: { on: "Connected", off: "Disconnected — the element lives on its own", turnOn: "Connect", turnOff: "Disconnect", busy: "Saving…", failed: "Not saved:" },
    mirror: {
      title: "Main mirror",
      text: "Connect your own second domain to the root of this element; the current subdomain then redirects to it.",
      action: "Connect the main mirror",
      pending: "Planned (step 324).",
    },
    remove: {
      title: "Delete the element",
      text: "Deletes the element for good: its process, its record in the node, its address on the internet and its folder with the code. Your repository on GitHub is not touched.",
      action: "Delete the element",
      pending: "Being built (step 325-5).",
    },
    removeDialog: {
      title: "Delete this AGI element for good?",
      text: "Its process stops, its address on the internet and its record in the node disappear, and its folder with the code is erased. This cannot be undone. Type its address to confirm:",
      label: "Address",
      confirm: "Delete for good",
      deleting: "Deleting…",
      cancel: "Cancel",
      mismatch: "The address does not match — nothing was deleted.",
      failed: "The deletion did not finish at:",
      riskNever: "The element was never sent to GitHub: all {n} of its commits will be lost.",
      riskAhead: "{n} commit(s) of the element are not in GitHub — they will be lost.",
      riskNone: "Everything the element has is already in GitHub.",
    },
  },
  ru: {
    badge: "Опасная зона",
    notBorn: "Элемент ещё не рождён: родите его на главной — настройки появятся после этого.",
    agentNotBorn: "Элемент ещё не рождён: родите его на главной — тогда здесь можно будет запустить его агента, Claude Code.",
    describe: {
      title: "Описание возможностей",
      text: "Агент элемента читает его код и пишет, что элемент умеет; узел хранит это как запись элемента в ядре.",
      action: "Сгенерировать описание",
      pending: "В работе (подшаг 325-2).",
    },
    mirrorCard: {
      current: "Подключён:",
      label: "Домены узла",
      placeholder: "Выберите домен",
      attach: "Подключить",
      attaching: "Подключаю…",
      detach: "Отключить",
      detaching: "Отключаю…",
      primaryTitle: "Главный адрес",
      primaryNote: "Сайт отдаётся на {primary} и называет себя этим адресом (canonical, sitemap, hreflang); второй адрес отвечает 301 на него.",
      empty: "У узла пока нет дополнительных доменов — добавьте домен на «Активации домена».",
      add: "Добавить домен",
      loadFailed: "Список доменов не загрузился.",
      note: "Домен добавляется и доводится до активной зоны на «Активации домена», здесь — только выбор. www.<домен> будет вести на корень; старый поддомен — на домен.",
      kinds: {
        ready: "свободен · готов",
        waiting: "свободен · ждёт серверов имён (довести на «Активации домена»)",
        taken: "подключён к элементу {by}",
        current: "подключён к этому элементу",
      },
      errors: {
        "not-in-list": "Этого домена нет среди доменов узла — добавьте его на «Активации домена».",
        taken: "Этот домен уже подключён к другому элементу.",
        pending: "Зона ещё не активна — доведите серверы имён на «Активации домена».",
        "not-visible": "Ключ Cloudflare узла не видит эту зону.",
        "no-key": "У узла нет ключа Cloudflare.",
        "cloudflare-error": "Cloudflare не ответил.",
        "write-failed": "Узел не смог сохранить выбор.",
        "no-tunnel": "У узла ещё нет своего туннеля — сначала подключите основной домен (Активация домена).",
        "other-account": "Домен в другом аккаунте Cloudflare, чем узел, — туннель узла не может его обслужить.",
        "tunnel-failed": "Cloudflare не принял маршрут туннеля.",
        "dns-failed": "Cloudflare не принял запись DNS.",
        "no-port": "У элемента нет порта на этом узле.",
        "no-subdomain": "У элемента ещё нет поддомена — сначала подключите «Адрес в интернете» на его главной странице.",
        "no-domain": "К элементу не подключён домен.",
        failed: "Подключение не завершилось.",
      },
    },
    addressCard: {
      current: "Адрес в ядре:",
      label: "Новый адрес",
      free: "Имя свободно.",
      "bad-shape": "4–24 символа: строчные латинские буквы, цифры и одиночные дефисы, первая — буква.",
      taken: "Имя занято — разделом ядра, другим элементом или службой.",
      suggest: "Свободны:",
      renaming: "Переименовываю…",
      failed: "Адрес не изменён:",
      note: "Внутреннее имя {id} остаётся: под ним живут процесс и данные. Папка элемента переезжает под новый адрес, подключённый адрес в интернете — на новое имя.",
      restart: "Элемент перезапустится: адрес будет недоступен около минуты.",
      repoNote: "Его репозиторий GitHub, если имя ему дал узел, переименуется вместе с ним; репозиторий, подключённый вами под своим именем, имя сохранит.",
      repoRenamed: "Репозиторий GitHub переименован: {from} → {to}. Старые ссылки GitHub перенаправляет сам; не создавайте новый репозиторий со старым именем — перенаправление сломается.",
      repoFailed: "Элемент переименован, а его репозиторий GitHub {from} — нет: {reason}. Переименуйте его на GitHub вручную или переименуйте элемент ещё раз.",
    },
    describeCard: {
      empty: "В ядре пока нет описания этого элемента.",
      take: "Забрать в ядро",
      taking: "Забираю…",
      taken: "Описание стало записью элемента в ядре.",
      takenAt: "Забрано в ядро:",
      how: "1. «Сгенерировать» — откроется терминал элемента с заданием; запустите агента и отправьте его. Агент запишет описание в паспорт элемента, закоммитит и сам отдаст его в ядро (npm run describe:publish). 2. Если агент не смог отдать — заберите описание в ядро кнопкой.",
      errors: {
        "passport-unreadable": "Паспорт элемента OWN-SERVICE-PROPS.json не читается.",
        "summary-missing": "В паспорте нет описания (summary) — агент его ещё не написал.",
        "summary-not-written": "Описание в паспорте всё ещё шаблонное или записанное при рождении — агент своё ещё не написал.",
        "provides-missing": "В паспорте не названо ни одной возможности (provides пуст).",
        "provides-bad-shape": "Имена возможностей в provides неверной формы: 1–20 разных имён, строчные слова через дефис.",
        "registry-failed": "Не удалось записать реестр узла.",
        unknown: "Описание не забрано:",
      },
    },
    address: {
      title: "Адрес элемента",
      text: "Переименовать адрес страниц элемента в ядре с проверкой, что новое имя свободно. Внутреннее имя (id) не меняется; прежний адрес ведёт на новый.",
      action: "Переименовать адрес",
      pending: "В работе (подшаг 325-3).",
    },
    config: {
      title: "Синхронизация с CONFIG",
      text: "Настройки проекта (название, описание, SEO, иконки, языки) приходят от элемента CONFIG. Отключите — элемент оставит себе последние полученные настройки и дальше меняет их только на своей странице настроек.",
      action: "", pending: "",
    },
    design: {
      title: "Синхронизация с Дизайном",
      text: "Цвета, шрифты и формы приходят от элемента «Дизайн» после сохранения. Отключите — элемент оставит последнее полученное оформление.",
      action: "", pending: "",
    },
    blocks: {
      title: "Синхронизация с Блоками",
      text: "Агент элемента берёт готовые блоки из реестра «Блоков». Отключите — реестр уберётся из components.json; уже взятые блоки останутся в коде элемента.",
      action: "", pending: "",
    },
    siteSettings: {
      text: "Настройки сайта этого элемента — название, описание, настройки для поиска, картинки, иконки и языки — живут на собственном сайте элемента и открываются там, на его главном адресе, где вы уже вошли через узел.",
      configOn: "Синхронизация с CONFIG включена: эти настройки приходят от элемента CONFIG, и страница настроек элемента показывает их без сохранения. Чтобы у элемента были свои, выключите синхронизацию в «Опасной зоне».",
      configOff: "Синхронизация с CONFIG выключена: элемент живёт своими настройками, и они сохраняются на его странице настроек.",
      open: "Открыть настройки сайта",
    },
    linkCard: { on: "Подключено", off: "Отключено — элемент живёт самостоятельно", turnOn: "Подключить", turnOff: "Отключить", busy: "Сохраняю…", failed: "Не сохранено:" },
    mirror: {
      title: "Главное зеркало",
      text: "Подключить второй собственный домен к корню этого элемента; текущий поддомен будет переадресовывать на него.",
      action: "Подключить главное зеркало",
      pending: "Запланировано (шаг 324).",
    },
    remove: {
      title: "Удалить элемент",
      text: "Удаляет элемент насовсем: его процесс, запись в узле, адрес в интернете и папку с кодом. Ваш репозиторий на GitHub не трогается.",
      action: "Удалить элемент",
      pending: "В работе (подшаг 325-5).",
    },
    removeDialog: {
      title: "Удалить этот AGI элемент насовсем?",
      text: "Его процесс остановится, адрес в интернете и запись в узле исчезнут, папка с кодом будет стёрта. Отменить это нельзя. Для подтверждения введите его адрес:",
      label: "Адрес",
      confirm: "Удалить навсегда",
      deleting: "Удаляю…",
      cancel: "Отмена",
      mismatch: "Адрес не совпал — ничего не удалено.",
      failed: "Удаление не закончилось на этапах:",
      riskNever: "Элемент ни разу не выгружался в GitHub: все его коммиты ({n}) будут потеряны.",
      riskAhead: "Коммитов, которых нет в GitHub: {n} — они будут потеряны.",
      riskNone: "Всё, что есть у элемента, уже лежит в GitHub.",
    },
  },
}

export function elementSettingsUi(lang: string): ElementSettingsUi {
  return DICT[lang] ?? DICT.en
}
