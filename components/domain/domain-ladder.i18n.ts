// СЛОВА ЛЕСТНИЦЫ ПОДКЛЮЧЕНИЯ ДОМЕНА — рядом с самой лестницей (259-1).
//
// 🔒 ПОЧЕМУ СЛОВА ЗДЕСЬ, А НЕ В `_data` СТРАНИЦЫ. `_data` несёт слова СТРАНИЦЫ —
// заголовок, вступление и темы; её тип этого и не позволяет расширить без правки
// общего договора коллекции. Лестница — переиспользуемая часть: тот же экран
// понадобится там, где домен подключают повторно. Приём тот же, что у слов
// cookie-баннера: они лежат рядом с баннером, а не в общем словаре.
//
// 🔒 МОДУЛЬ СЕРВЕРНЫЙ. Островок получает уже выбранный язык пропсами — сторож
// `check-lang-delivery` следит, чтобы словарь не уехал в браузер целиком.

export type StaticCopyWords = {
  title: string
  lead: string
  refresh: string
  running: string
  started: string
  check: string
  empty: string
  updated: string
  files: string
  failed: string
  noDomain: string
  temporary: string
  error: string
  noWorkers: string
}

export type DomainLadderWords = {
  lead: string
  step1Title: string
  step1Text: string
  step2Title: string
  step2Text: string
  step2Steps: string[]
  step2Take: string
  step3Title: string
  step3Text: string
  step3Steps: string[]
  step3Wait: string
  step4Title: string
  step4Text: string
  step5Title: string
  step5Text: string
  done: string
  next: string
  locked4: string
  locked5: string
  keyConfigured: string
  keyReplace: string
  keyReplaceCancel: string
  nodeAddress: string
  quickAddress: string
  liveAddress: string
  /** 385-3: копия публичных страниц в Cloudflare по каждому адресу узла. */
  copy: StaticCopyWords
  quickRetired: string
  loading: string
  soon: string
  keyPlaceholder: string
  keyHelp: string
  keySave: string
  keySaving: string
  keyAccepted: string
  keyRejected: string
  keyNextStep: string
  zonesFound: string
  reasonEmpty: string
  reasonNoZones: string
  reasonNotOwner: string
  reasonNoTunnel: string
  keyCheckedTail: string
  reasonTemporary: string
  openLocally: string
  activateFor: string
  noNameYet: string
  reasonNetwork: string
  reasonToken: string
  hostPlaceholder: string
  hostHelp: string
  activate: string
  activating: string
  activated: string
  activatedNext: string
  reasonZoneNotFound: string
  reasonZoneInactive: string
  reasonBadHostname: string
  reasonNoKey: string
  registrarsTitle: string
  registrarCloudflare: string
  registrarShortcut: string
  registrarOthers: string
  registrarPriceNote: string
  cfLimitsToggle: string
  cfLimitsLead: string
  cfLimit1: string
  cfLimit2: string
  cfLimit3: string
  cfLimit4: string
  cfLimit5: string
  cfLimitsSource: string
  dashOpen: string
  domainLabel: string
  domainSave: string
  domainSaved: string
  checkNs: string
  checking: string
  saving: string
  nsOk: string
  nsForeign: string
  nsUnknown: string
  nsCurrent: string
  fastPath: string
  fastPathSaving: string
  tokenHowToggle: string
  tokenHowSteps: string[]
  tokenPermsTitle: string
  tokenPermsHead: string[]
  tokenPermsRows: string[][]
  tokenPermsWhy: string[]
  tokenTail: string[]
  tokenTemplateButton: string
  tokenTemplateSteps: string[]
  tokenManualToggle: string
}

const W: Record<string, DomainLadderWords> = {
  en: {
    lead: "Five steps. The first three happen outside this computer — only you can do them. The rest the node does itself.",
    step1Title: "A domain of your own",
    step1Text: "Register a domain at any registrar, or take one you already own. This is the only part that costs money.",
    step2Title: "Add the domain to Cloudflare and copy two names",
    step2Text: "Cloudflare does not take the domain away from your registrar — it takes over its DNS. At the end of this step you will have two names to carry over to step 3.",
    step2Steps: [
      "Open the dashboard and choose Add a domain.",
      "Type the domain without www and without https — example.com.",
      "Pick the Free plan if you are not sure: it is enough for everything on this page.",
      "Cloudflare will scan the existing records and show them. Nothing to change here — Continue.",
      "The last screen shows TWO names like kate.ns.cloudflare.com. COPY BOTH — step 3 needs them.",
    ],
    step2Take: "Copied both names? Then go to step 3 — they go into your registrar.",
    step3Title: "Put those two names into your registrar",
    step3Text: "This is the only step that happens at the place where you bought the domain — Porkbun, GoDaddy, wherever it is. You are replacing its nameservers with the two you copied in step 2.",
    step3Steps: [
      "Sign in to your registrar and open the domain.",
      "Find the nameservers section — it is usually called Nameservers, NS or DNS.",
      "Switch it from the default ones to custom.",
      "DELETE what is there and paste the TWO names from step 2 — the ones ending in ns.cloudflare.com.",
      "Save. Cloudflare will notice the change by itself.",
    ],
    step3Wait: "It takes from a few minutes to a day — not because of us: this is how the change spreads across the internet. Cloudflare will email you when the domain goes active. Until then step 5 will honestly say the domain is not active yet.",
    step4Title: "Give the node a Cloudflare key",
    step4Text: "Create one API token in Cloudflare for the whole account — Zone Edit, DNS Write, Cloudflare Tunnel Edit, Workers Scripts Edit, Workers Routes Edit — and paste it here. With it the node connects every next domain of yours by itself. The node keeps it to itself and never shows it again.",
    step5Title: "The node does the rest",
    step5Text: "One press. The node creates the tunnel, writes the DNS record and points the domain you named in step 1 at this computer. Nothing to fill in and nothing to install by hand.",
    done: "done",
    next: "I have done this",
    locked4: "The key field appears here once you have changed the nameservers.",
    locked5: "This opens once the node has a working key.",
    keyConfigured: "Key is configured",
    keyReplace: "Update key",
    keyReplaceCancel: "Cancel",
    nodeAddress: "Node address",
    quickAddress: "Temporary address in use",
    liveAddress: "Your address in the internet",
    copy: {
      title: "Copy in Cloudflare",
      lead: "Cloudflare keeps a copy of the public pages of every address, so the site stays visible while this computer is off. Sign-in and everything private answer only while the computer is on. The copy refreshes by itself after Accept, Deploy and connecting a domain.",
      refresh: "Refresh copies",
      running: "Copies are being refreshed — this takes a few minutes. Check again later.",
      started: "Started. Every address is copied one after another.",
      check: "Check",
      empty: "No copies yet. Press Refresh copies.",
      updated: "updated",
      files: "files",
      failed: "not copied",
      noDomain: "Copies appear after your own domain is connected.",
      temporary: "Copies can be refreshed only from this computer, not over the temporary address.",
      error: "The node did not answer.",
      noWorkers: "the node's Cloudflare key has no Workers rights — add them on the «Node key» card",
    },
    quickRetired: "The temporary address is still running and is no longer needed — stop it with npm run serve:unpublish",
    loading: "Reading the node state…",
    soon: "Built in the next sub-step.",
    keyPlaceholder: "Paste the Cloudflare API token",
    keyHelp: "In Cloudflare: My Profile → API Tokens → Create Token. It needs, for the whole account (names as in the Cloudflare docs «API token permissions»): Zone Edit, DNS Write, Cloudflare Tunnel Edit, Workers Scripts Edit, Workers Routes Edit — not a single zone, so that the node can add more domains itself.",
    keySave: "Give the node the key",
    keySaving: "Checking with Cloudflare…",
    keyAccepted: "The key works.",
    keyRejected: "Cloudflare did not accept this key.",
    keyNextStep: "Next: step 5 — the node creates the tunnel and the DNS record.",
    zonesFound: "Domains this key can see",
    reasonEmpty: "The field is empty.",
    reasonNoZones: "The key is alive but sees no domain. Most often your Cloudflare account has no domain yet: add your domain in Cloudflare (Add a domain, free plan), switch its nameservers at your registrar, wait until it is Active and paste the same key again. If the domain is already Active there, the key was created for another zone — create it again with the button above (All zones).",
    reasonNotOwner: "Only the node's architect can do this — sign in as the architect and try again.",
    keyCheckedTail: "Checked key …{tail}; Cloudflare answered: {detail}.",
    reasonNoTunnel: "The key has no right to Cloudflare tunnels. Add the line Account · Cloudflare Tunnel · Edit to the token and paste it again — the node's current key stays in place.",
    reasonTemporary: "You are looking at the site through its temporary public address. A key must never travel over a public link, so this field is switched off here. Open the same page on this computer — the address is below — and it will work.",
    openLocally: "Open this page locally",
    activateFor: "Point this address at the node",
    noNameYet: "Go back to step 1 and name the domain — this step works with that name.",
    reasonNetwork: "Could not reach Cloudflare — check the connection. The key was not saved.",
    reasonToken: "Cloudflare says this token is not active.",
    hostPlaceholder: "example.com or www.example.com",
    hostHelp: "The address people will type. Enter the domain itself, or a subdomain of it.",
    activate: "Point this address at the node",
    activating: "Creating the tunnel and the DNS record…",
    activated: "Done — the address now points at this computer.",
    activatedNext: "It may take a few minutes to answer while the record spreads.",
    reasonZoneNotFound: "This domain is not among the ones the key can see. Check the spelling, or add the domain to Cloudflare first.",
    reasonZoneInactive: "Cloudflare has the domain but it is not active yet — the nameservers at the registrar have not taken effect. This is step 3.",
    reasonBadHostname: "That does not look like a domain name.",
    reasonNoKey: "The node has no Cloudflare key — go back to step 4.",
    registrarsTitle: "Where to register one",
    registrarCloudflare: "Cloudflare itself sells domains — at cost, without a markup: you pay what the registry and ICANN charge.",
    registrarShortcut: "Buy it there and steps 2 and 3 disappear: a domain registered with Cloudflare uses their nameservers from the start, so there is nothing to switch.",
    registrarOthers: "Any other registrar works too — these are among the well known ones:",
    registrarPriceNote: "We do not compare their prices: they change, and each zone (.com, .dev, .io) costs differently. Check at the registrar itself.",
    cfLimitsToggle: "Buying at Cloudflare has limits — read them first",
    cfLimitsLead: "Cheap and short is not the same as right for you. Five constraints, taken from Cloudflare’s own documentation:",
    cfLimit1: "You cannot use another DNS provider. A domain registered there is locked to Cloudflare nameservers; to move DNS elsewhere you have to move the domain itself to another registrar.",
    cfLimit2: "Not every zone is on sale. The list of supported TLDs is limited, and some require extra proof from the registrant.",
    cfLimit3: "Domains with non-Latin letters are not supported at all — neither á, ü and the like, nor their xn-- form.",
    cfLimit4: "Registration fees are not refundable: the money goes to the registry the moment the purchase completes.",
    cfLimit5: "Moving away has waiting periods set by ICANN — 60 days after a change of registrar or of WHOIS data.",
    cfLimitsSource: "Source: Cloudflare Registrar documentation, read 2026-09-21. Check the current terms before you pay — they are theirs to change, not ours.",
    dashOpen: "Open the Cloudflare dashboard",
    domainLabel: "Which domain will this be? Type it and the node will check the rest by itself.",
    domainSave: "This is my domain",
    domainSaved: "Remembered — the node will check this name from now on.",
    checkNs: "Check whether it worked",
    checking: "Asking the internet…",
    saving: "Saving…",
    nsOk: "The domain already points at Cloudflare. This step is done.",
    nsForeign: "The domain still points at its old nameservers — the change has not taken effect yet.",
    nsUnknown: "The internet does not know this name yet. Either it was just registered, or there is a typo.",
    nsCurrent: "Right now it answers with",
    fastPath: "Buying at Cloudflare skips steps 2 and 3 entirely.",
    tokenTemplateButton: "Create the key in Cloudflare",
    tokenTemplateSteps: [
      "The button opens the Cloudflare token form already filled in: Zone · Edit, DNS · Edit, Cloudflare Tunnel · Edit, Workers Scripts · Edit and Workers Routes · Edit for your whole account.",
      "Check that there are five rows, including Account · Cloudflare Tunnel · Edit.",
      "Continue to summary → Create Token. The key is shown ONCE — copy it and paste it below.",
    ],
    tokenManualToggle: "The form did not fill in — do it by hand",
    tokenHowToggle: "How to create this token — step by step",
    tokenHowSteps: [
      "In Cloudflare: My Profile → API Tokens → Create Token → Create Custom Token.",
      "Token name: anything you recognise, for example Fractera node.",
      "Permissions: five rows. Add each next one with Add more.",
    ],
    tokenPermsTitle: "The five rows",
    tokenPermsHead: ["Scope", "What", "Level"],
    tokenPermsRows: [
      ["Account", "Cloudflare Tunnel", "Edit"],
      ["Account", "Workers Scripts", "Edit"],
      ["Zone", "Workers Routes", "Edit"],
      ["Zone", "DNS", "Edit"],
      ["Zone", "Zone", "Edit"],
    ],
    tokenPermsWhy: [
      "Cloudflare Tunnel · Edit — the node creates the tunnel, takes its run token and sets the routing.",
      "Workers Scripts · Edit and Workers Routes · Edit — the node publishes a copy of your public pages to your Cloudflare account, so the site stays visible while the computer is off. Everything else works without them.",
      "DNS · Edit — it writes the record that points your name at that tunnel.",
      "Zone · Edit — it finds your zone by the domain name, learns which account owns it, and adds the zone of every next domain of yours by itself.",
    ],
    tokenTail: [
      "Account Resources: leave Include / All accounts.",
      "Zone Resources: appears once you add the Zone rows — choose Include → All zones (not one zone: then every next domain is connected by the node itself).",
      "Client IP Address Filtering: leave empty.",
      "TTL: leave it. A token with an end date dies one day, and the site stops updating its record without explaining why.",
      "Continue to summary → Create Token. The token is shown ONCE — copy it straight away.",
    ],
    fastPathSaving: "Those two steps are where the waiting lives: a nameserver change spreads across the internet for anything from a few minutes to 24 hours, and nobody can speed it up. A domain registered at Cloudflare is already on their nameservers — there is nothing to change and nothing to wait for.",
  },
  ru: {
    lead: "Пять шагов. Первые три происходят вне этого компьютера — их можете сделать только вы. Остальное узел делает сам.",
    step1Title: "Собственный домен",
    step1Text: "Зарегистрируйте домен у любого регистратора или возьмите тот, что уже есть. Это единственная часть, которая стоит денег.",
    step2Title: "Заведите домен в Cloudflare и скопируйте два имени",
    step2Text: "Cloudflare не забирает домен у регистратора — он берёт на себя его DNS. В конце этого шага у вас будут два имени, которые понадобятся на шаге 3.",
    step2Steps: [
      "Откройте панель и выберите «Add a domain».",
      "Введите домен без www и без https — example.com.",
      "Выберите план Free, если не уверены: для всего, что на этой странице, его хватает.",
      "Cloudflare прочитает существующие записи и покажет их. Менять здесь нечего — Continue.",
      "На последнем экране будут ДВА имени вида kate.ns.cloudflare.com. СКОПИРУЙТЕ ОБА — они нужны на шаге 3.",
    ],
    step2Take: "Скопировали оба имени? Тогда переходите к шагу 3 — они пойдут к вашему регистратору.",
    step3Title: "Впишите эти два имени у своего регистратора",
    step3Text: "Единственный шаг, который проходит там, где вы купили домен, — Porkbun, GoDaddy, где угодно. Вы заменяете его серверы имён на те два, что скопировали на шаге 2.",
    step3Steps: [
      "Войдите к регистратору и откройте свой домен.",
      "Найдите раздел серверов имён — он обычно называется Nameservers, NS или DNS.",
      "Переключите его с серверов по умолчанию на собственные (custom).",
      "УДАЛИТЕ то, что там стоит, и вставьте ДВА имени с шага 2 — те, что оканчиваются на ns.cloudflare.com.",
      "Сохраните. Cloudflare заметит смену сам.",
    ],
    step3Wait: "Занимает от нескольких минут до суток — и не по нашей вине: так смена расходится по интернету. Cloudflare пришлёт письмо, когда домен станет активен. До этого шаг 5 честно скажет, что домен ещё не активен.",
    step4Title: "Выдайте узлу ключ Cloudflare",
    step4Text: "Создайте в Cloudflare один токен API на весь аккаунт — Zone Edit, DNS Write, Cloudflare Tunnel Edit, Workers Scripts Edit, Workers Routes Edit — и вставьте его здесь. С ним узел сам подключает каждый следующий ваш домен. Узел оставит его себе и больше никогда не покажет.",
    step5Title: "Остальное узел делает сам",
    step5Text: "Одно нажатие. Узел создаст туннель, заведёт запись DNS и направит на этот компьютер тот домен, который вы назвали на шаге 1. Заполнять ничего не нужно и ставить руками нечего.",
    done: "сделано",
    next: "Я это сделал",
    locked4: "Поле для ключа появится здесь, когда вы смените серверы имён.",
    locked5: "Откроется, когда у узла будет рабочий ключ.",
    keyConfigured: "Ключ настроен",
    keyReplace: "Обновить ключ",
    keyReplaceCancel: "Отмена",
    nodeAddress: "Адрес узла",
    quickAddress: "Сейчас работает временный адрес",
    liveAddress: "Ваш адрес в интернете",
    copy: {
      title: "Копия в Cloudflare",
      lead: "Cloudflare хранит копию публичных страниц каждого адреса, поэтому сайт виден, даже когда этот компьютер выключен. Вход и всё закрытое отвечают, только пока компьютер включён. Копия обновляется сама после «Принять», «Развернуть» и подключения домена.",
      refresh: "Обновить копии",
      running: "Копии обновляются — это займёт несколько минут. Проверьте позже.",
      started: "Запущено. Адреса копируются по очереди.",
      check: "Проверить",
      empty: "Копий пока нет. Нажмите «Обновить копии».",
      updated: "обновлена",
      files: "файлов",
      failed: "не скопировано",
      noDomain: "Копии появятся после подключения своего домена.",
      temporary: "Обновить копии можно только с этого компьютера, не через временный адрес.",
      error: "Узел не ответил.",
      noWorkers: "у ключа Cloudflare узла нет прав Workers — добавьте их на карточке «Ключ узла»",
    },
    quickRetired: "Временный адрес ещё работает и больше не нужен — остановить его: npm run serve:unpublish",
    loading: "Читаю состояние узла…",
    soon: "Строится в следующем подшаге.",
    keyPlaceholder: "Вставьте токен API Cloudflare",
    keyHelp: "В Cloudflare: My Profile → API Tokens → Create Token. Токену нужны, на весь аккаунт (названия — как в документации Cloudflare «API token permissions»): Zone Edit, DNS Write, Cloudflare Tunnel Edit, Workers Scripts Edit, Workers Routes Edit — не на одну зону, чтобы узел мог добавлять домены сам.",
    keySave: "Выдать узлу ключ",
    keySaving: "Проверяю у Cloudflare…",
    keyAccepted: "Ключ работает.",
    keyRejected: "Cloudflare не принял этот ключ.",
    keyNextStep: "Дальше: шаг 5 — узел создаёт туннель и запись DNS.",
    zonesFound: "Домены, которые видит этот ключ",
    reasonEmpty: "Поле пустое.",
    reasonNoZones: "Ключ жив, но не видит ни одного домена. Чаще всего в вашем аккаунте Cloudflare ещё нет домена: добавьте его в Cloudflare (Add a domain, бесплатный план), смените серверы имён у регистратора, дождитесь статуса Active и вставьте этот же ключ снова. Если домен там уже Active, ключ создан для другой зоны — создайте его заново кнопкой выше (All zones).",
    reasonNotOwner: "Это может сделать только архитектор узла — войдите как архитектор и попробуйте снова.",
    keyCheckedTail: "Проверен ключ …{tail}; ответ Cloudflare: {detail}.",
    reasonNoTunnel: "У ключа нет права на туннели Cloudflare. Добавьте токену строку Account · Cloudflare Tunnel · Edit и вставьте его снова — прежний ключ узла остаётся на месте.",
    reasonTemporary: "Вы смотрите сайт через его временный публичный адрес. Ключ не должен идти по публичной ссылке, поэтому здесь поле выключено. Откройте ту же страницу на этом компьютере — адрес ниже — и всё заработает.",
    openLocally: "Открыть эту страницу локально",
    activateFor: "Направить этот адрес на узел",
    noNameYet: "Вернитесь к шагу 1 и назовите домен — этот шаг работает с ним.",
    reasonNetwork: "Не достучался до Cloudflare — проверьте связь. Ключ не сохранён.",
    reasonToken: "Cloudflare говорит, что этот токен не активен.",
    hostPlaceholder: "example.com или www.example.com",
    hostHelp: "Адрес, который будут набирать люди. Введите сам домен или его поддомен.",
    activate: "Направить этот адрес на узел",
    activating: "Создаю туннель и запись DNS…",
    activated: "Готово — адрес направлен на этот компьютер.",
    activatedNext: "Ответить он может через несколько минут, пока запись расходится.",
    reasonZoneNotFound: "Этого домена нет среди тех, что видит ключ. Проверьте написание или сначала добавьте домен в Cloudflare.",
    reasonZoneInactive: "Домен у Cloudflare есть, но ещё не активен — серверы имён у регистратора не вступили в силу. Это шаг 3.",
    reasonBadHostname: "Это не похоже на доменное имя.",
    reasonNoKey: "У узла нет ключа Cloudflare — вернитесь к шагу 4.",
    registrarsTitle: "Где его зарегистрировать",
    registrarCloudflare: "Cloudflare продаёт домены сам — по себестоимости, без наценки: вы платите то, что берут реестр и ICANN.",
    registrarShortcut: "Купите там — и шаги 2 и 3 отпадут: домен, зарегистрированный в Cloudflare, сразу на их серверах имён, переключать нечего.",
    registrarOthers: "Любой другой регистратор тоже подойдёт — вот несколько известных:",
    registrarPriceNote: "Их цены мы не сравниваем: они меняются, и каждая зона (.com, .dev, .io) стоит по-своему. Смотрите у самого регистратора.",
    cfLimitsToggle: "У покупки в Cloudflare есть ограничения — прочтите сначала их",
    cfLimitsLead: "Дёшево и коротко не значит «подходит вам». Пять ограничений, взятых из документации самого Cloudflare:",
    cfLimit1: "Другого поставщика DNS использовать нельзя. Домен, зарегистрированный там, привязан к серверам имён Cloudflare; чтобы увести DNS, придётся уводить сам домен к другому регистратору.",
    cfLimit2: "Продаются не все зоны. Список поддерживаемых доменов верхнего уровня ограничен, а часть из них требует дополнительных подтверждений от владельца.",
    cfLimit3: "Домены с нелатинскими буквами не поддерживаются вовсе — ни á, ü и подобные, ни их запись через xn--.",
    cfLimit4: "Плата за регистрацию не возвращается: деньги уходят реестру в момент покупки.",
    cfLimit5: "У переезда есть сроки ожидания, заданные ICANN, — 60 дней после смены регистратора или данных WHOIS.",
    cfLimitsSource: "Источник: документация Cloudflare Registrar, прочитана 2026-09-21. Проверьте действующие условия перед оплатой — менять их вправе они, а не мы.",
    dashOpen: "Открыть панель Cloudflare",
    domainLabel: "Какой это будет домен? Введите его — остальное узел проверит сам.",
    domainSave: "Это мой домен",
    domainSaved: "Запомнил — дальше узел проверяет именно это имя.",
    checkNs: "Проверить, получилось ли",
    checking: "Спрашиваю интернет…",
    saving: "Сохраняю…",
    nsOk: "Домен уже указывает на Cloudflare. Этот шаг сделан.",
    nsForeign: "Домен пока указывает на прежние серверы имён — смена ещё не вступила в силу.",
    nsUnknown: "Интернет ещё не знает этого имени. Либо оно только что зарегистрировано, либо в нём опечатка.",
    nsCurrent: "Сейчас он отвечает",
    fastPath: "Покупка в Cloudflare пропускает шаги 2 и 3 целиком.",
    tokenTemplateButton: "Создать ключ в Cloudflare",
    tokenTemplateSteps: [
      "Кнопка откроет форму токена Cloudflare уже заполненной: Zone · Edit, DNS · Edit, Cloudflare Tunnel · Edit, Workers Scripts · Edit и Workers Routes · Edit на весь ваш аккаунт.",
      "Проверьте, что строк пять, среди них Account · Cloudflare Tunnel · Edit.",
      "Continue to summary → Create Token. Ключ покажут ОДИН раз — скопируйте и вставьте ниже.",
    ],
    tokenManualToggle: "Форма не заполнилась — вручную",
    tokenHowToggle: "Как создать этот токен — по шагам",
    tokenHowSteps: [
      "В Cloudflare: My Profile → API Tokens → Create Token → Create Custom Token.",
      "Token name: любое понятное, например Fractera node.",
      "Permissions: пять строк. Каждую следующую добавьте кнопкой Add more.",
    ],
    tokenPermsTitle: "Пять строк прав",
    tokenPermsHead: ["Область", "Что", "Уровень"],
    tokenPermsRows: [
      ["Account", "Cloudflare Tunnel", "Edit"],
      ["Account", "Workers Scripts", "Edit"],
      ["Zone", "Workers Routes", "Edit"],
      ["Zone", "DNS", "Edit"],
      ["Zone", "Zone", "Edit"],
    ],
    tokenPermsWhy: [
      "Cloudflare Tunnel · Edit — узел создаёт туннель, забирает его токен запуска и задаёт правила входа.",
      "Workers Scripts · Edit и Workers Routes · Edit — узел выкладывает копию публичных страниц в ваш аккаунт Cloudflare, и сайт остаётся виден, когда компьютер выключен. Без них всё остальное работает.",
      "DNS · Edit — заводит запись, которая ведёт ваше имя на этот туннель.",
      "Zone · Edit — находит вашу зону по имени домена, узнаёт её учётную запись и сам заводит зону каждого следующего вашего домена.",
    ],
    tokenTail: [
      "Account Resources: оставьте Include / All accounts.",
      "Zone Resources: появится, как только добавите строки со Zone — выберите Include → All zones (не одну зону: тогда каждый следующий домен узел подключает сам).",
      "Client IP Address Filtering: оставьте пустым.",
      "TTL: не трогайте. Токен с датой окончания однажды умрёт, и сайт перестанет обновлять запись без объяснения.",
      "Continue to summary → Create Token. Токен покажут ОДИН раз — скопируйте сразу.",
    ],
    fastPathSaving: "Именно в этих двух шагах живёт ожидание: смена серверов имён расходится по интернету от нескольких минут до 24 часов, и ускорить это не может никто. Домен, зарегистрированный в Cloudflare, уже на их серверах имён — менять нечего и ждать нечего.",
  },
}

export function domainLadderWords(lang: string): DomainLadderWords {
  return W[lang] ?? W[lang.slice(0, 2)] ?? W.en
}
