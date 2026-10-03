// СЛОВА ВКЛАДКИ «GITHUB» (273).
//
// 🔒 У КАЖДОГО СОСТОЯНИЯ ПРИВЯЗКИ СВОИ СЛОВА, И НИ ОДНО НЕ НАЗЫВАЕТСЯ ПОЛОМКОЙ ЗРЯ: узел на выделенном
// сервере живёт без репозитория законно, а узел, запущенный из репозитория Fractera, работает — просто
// писать в него нельзя. Общее «что-то не так» здесь было бы ложью в обе стороны.
// 🔒 Зарегистрирован в `scripts/check-i18n.mjs` тем же коммитом, что и создан (закон 236-1).

export type GithubWords = {
  loading: string
  forbidden: string
  intro: string

  /**
   * Подпись кнопки, открывающей мастер подключения репозитория (274-4).
   *
   * 🔒 КНОПКА ГОРИТ ВСЕГДА, А НЕ ТОЛЬКО КОГДА РЕПОЗИТОРИЯ НЕТ — решение владельца 2026-09-22: «будет
   * гореть кнопка, если пользователь вновь захочет подключить другой репозиторий».
   */
  connectCta: string
  /** Одна строка под кнопкой: зачем её нажимают. */
  connectHint: string

  bindingTitle: string
  /** Заголовок второй записи: репозиторий, подключённый мастером (274-5). */
  connectedTitle: string
  /** Что означает эта запись и чем она отличается от первой. */
  connectedLead: string
  /** Мастер не проходили — записи нет. Законное состояние, а не отказ. */
  connectedEmpty: string
  /** Связь с GitHub проверена. */
  connectedVerified: string
  /** Связь ещё не проверена. */
  connectedUnverified: string
  /** Проект отправлен в этот репозиторий. */
  connectedPushed: string
  /** Отправки ещё не было. */
  connectedNotPushed: string
  /** Эта запись и запись выше называют РАЗНЫЕ адреса — сказать это прямо. */
  connectedDiffers: string
  repoLabel: string
  branchLabel: string
  commitLabel: string
  stateOwn: string
  stateUpstream: string
  stateNoGit: string
  stateNoRemote: string
  stateForeignHost: string

  keyTitle: string
  keyLead: string
  keySteps: string[]
  keyLabel: string
  keyHint: string
  save: string
  saving: string
  saved: string
  forget: string
  check: string
  checking: string
  openTokens: string

  accessTitle: string
  accountLabel: string
  visibleLabel: string
  writeLabel: string
  expiresLabel: string
  yes: string
  no: string
  never: string
  unknown: string
  writeOk: string
  writeDenied: string
  expiresSoon: string
  notChecked: string

  errors: Record<string, string>
}

const DICT: Record<string, GithubWords> = {
  en: {
    loading: "Asking the node…",
    forbidden: "Only the architect can see this, and only from this computer or your own domain.",
    intro:
      "This page answers one question: which repository this node works with right now. It asks git itself, so a renamed or replaced repository shows up here instead of surprising you on the day you publish.",

    connectCta: "Add a new repository",
    connectHint: "Four steps: the repository, the token, the check, the first push.",

    bindingTitle: "The repository of this node",
    connectedTitle: "The repository you connected",
    connectedLead:
      "This one you entered yourself, in the four steps above. The card above measures git; this card remembers what you asked for. They may name different addresses, and that is worth knowing before you publish.",
    connectedEmpty: "You have not connected a repository yet. The button above starts the four steps.",
    connectedVerified: "GitHub answered: the repository and the token work.",
    connectedUnverified: "Not checked yet.",
    connectedPushed: "The project has been pushed here.",
    connectedNotPushed: "Nothing has been pushed here yet.",
    connectedDiffers: "This is not the address the node works with right now — the card above names another one.",
    repoLabel: "Repository",
    branchLabel: "Branch",
    commitLabel: "Last commit",
    stateOwn: "This is your repository. Changes go here.",
    stateUpstream:
      "This node was started from the Fractera repository, not from your own. It works, but you cannot write here: make your own copy on GitHub, point origin at it, and this card will change by itself.",
    stateNoGit:
      "There is no repository at all — that is how an installation on a dedicated server looks. The node works; changes simply have nowhere to go yet. Create a repository on GitHub and connect it when you are ready.",
    stateNoRemote: "There is a repository, but no address to push to: the code was copied without its origin.",
    stateForeignHost: "The repository lives outside GitHub. The node works with it; the checks below are about GitHub only.",

    keyTitle: "The token",
    keyLead: "A token is what lets the node read and write this repository. It is kept on this computer only, and it is never shown again — only its last four characters.",
    keySteps: [
      "Sign in to GitHub and open the link below — it creates a classic token. If a list of tokens opens, press «Generate new token» and choose «Generate new token (classic)» — not the fine-grained one.",
      "Note — any name, e.g. «fractera node»; Expiration — the term you want.",
      "Tick two boxes: «repo» (the node creates a private repository for every AGI ITEM and writes to it) and «workflow» (elements carry GitHub Actions files in .github/workflows — without this box GitHub refuses them). Nothing else is needed.",
      "Press «Generate token» at the bottom, copy the token — it starts with ghp_ — and paste it here.",
    ],
    keyLabel: "GitHub token",
    keyHint: "starts with github_pat_ or ghp_",
    save: "Save and check",
    saving: "Asking GitHub…",
    saved: "Token saved · …{tail}",
    forget: "Forget the token",
    check: "Check access",
    checking: "Checking…",
    openTokens: "Open the token page",

    accessTitle: "What this token can do",
    accountLabel: "Account",
    visibleLabel: "Repository visible",
    writeLabel: "Write access",
    expiresLabel: "Token expires",
    yes: "yes",
    no: "no",
    never: "no expiry",
    unknown: "not known",
    writeOk: "The token can write: publishing will work.",
    writeDenied:
      "The token can read but not write. It looks healthy right now and will fail on the day you publish — create a classic token with the «repo» and «workflow» boxes and paste it.",
    expiresSoon: "The token expires soon — renew it before it stops working.",
    notChecked: "Not checked yet.",

    errors: {
      "empty-token": "Paste the token first.",
      "bad-format": "That does not look like a GitHub token: it starts with github_pat_ or ghp_.",
      "token-rejected": "GitHub does not recognise this token. It may be revoked or expired.",
      "github-unreachable": "GitHub did not answer. Check the internet on this computer.",
      "github-refused": "GitHub refused the request.",
      "repo-invisible": "GitHub answers «not found»: either the repository does not exist, or this token is not allowed to see it.",
      "no-token": "Save a token first.",
      network: "The node did not answer.",
    },
  },
  ru: {
    loading: "Спрашиваю узел…",
    forbidden: "Эту страницу видит только архитектор и только с этого компьютера или со своего домена.",
    intro:
      "Страница отвечает на один вопрос: с каким репозиторием работает этот узел прямо сейчас. Она спрашивает сам git, поэтому подменённый или переименованный репозиторий виден здесь, а не в день публикации.",

    connectCta: "Добавить новый репозиторий",
    connectHint: "Четыре шага: репозиторий, токен, проверка, первая отправка.",

    bindingTitle: "Репозиторий этого узла",
    connectedTitle: "Репозиторий, который подключили вы",
    connectedLead:
      "Этот адрес вы ввели сами, в четырёх шагах выше. Карточка сверху измеряет git, эта — помнит, о чём вы попросили. Адреса могут не совпадать, и знать об этом стоит до публикации.",
    connectedEmpty: "Репозиторий пока не подключён. Кнопка выше открывает четыре шага.",
    connectedVerified: "GitHub ответил: репозиторий и токен работают.",
    connectedUnverified: "Связь ещё не проверяли.",
    connectedPushed: "Проект сюда отправлен.",
    connectedNotPushed: "Отправки сюда ещё не было.",
    connectedDiffers: "Это не тот адрес, с которым узел работает сейчас, — сверху назван другой.",
    repoLabel: "Репозиторий",
    branchLabel: "Ветка",
    commitLabel: "Последний коммит",
    stateOwn: "Это ваш репозиторий. Изменения уезжают сюда.",
    stateUpstream:
      "Узел запущен из репозитория Fractera, а не из вашего. Он работает, но писать сюда вы не можете: сделайте свою копию на GitHub, переключите на неё origin — и эта карточка сменится сама.",
    stateNoGit:
      "Репозитория нет вовсе — так выглядит установка на выделенный сервер. Узел работает, изменениям просто некуда уезжать. Заведите репозиторий на GitHub и подключите его, когда будете готовы.",
    stateNoRemote: "Репозиторий есть, но адреса для отправки нет: код скопировали без origin.",
    stateForeignHost: "Репозиторий живёт не на GitHub. Узел с ним работает; проверки ниже — только про GitHub.",

    keyTitle: "Токен",
    keyLead: "Токен — это то, чем узел читает и пишет этот репозиторий. Он хранится только на этом компьютере и больше не показывается — видны лишь четыре последних знака.",
    keySteps: [
      "Войдите в GitHub и откройте ссылку ниже — она создаёт классический токен. Если открылся список токенов, нажмите «Generate new token» и выберите «Generate new token (classic)» — не тонкий токен.",
      "Note — любое имя, например «fractera node»; Expiration — нужный срок.",
      "Отметьте две галочки: «repo» (узел создаёт приватный репозиторий каждому AGI ITEM и пишет в него) и «workflow» (в элементах есть файлы GitHub Actions в .github/workflows — без этой галочки GitHub их не примет). Больше ничего не нужно.",
      "Внизу нажмите «Generate token», скопируйте токен — он начинается с ghp_ — и вставьте сюда.",
      "Выберите срок, который готовы продлевать, создайте токен и вставьте его сюда.",
    ],
    keyLabel: "Токен GitHub",
    keyHint: "начинается с github_pat_ или ghp_",
    save: "Сохранить и проверить",
    saving: "Спрашиваю GitHub…",
    saved: "Токен сохранён · …{tail}",
    forget: "Забыть токен",
    check: "Проверить доступ",
    checking: "Проверяю…",
    openTokens: "Открыть страницу токенов",

    accessTitle: "Что умеет этот токен",
    accountLabel: "Аккаунт",
    visibleLabel: "Репозиторий виден",
    writeLabel: "Право записи",
    expiresLabel: "Срок токена",
    yes: "да",
    no: "нет",
    never: "без срока",
    unknown: "неизвестно",
    writeOk: "Токен умеет писать: публикация пройдёт.",
    writeDenied:
      "Токен умеет читать, но не писать. Сейчас он выглядит исправным и откажет в день публикации — создайте классический токен с галочками «repo» и «workflow» и вставьте его.",
    expiresSoon: "Срок токена подходит к концу — продлите его до того, как он перестанет работать.",
    notChecked: "Ещё не проверяли.",

    errors: {
      "empty-token": "Сначала вставьте токен.",
      "bad-format": "Это не похоже на токен GitHub: он начинается с github_pat_ или ghp_.",
      "token-rejected": "GitHub не узнаёт этот токен. Возможно, он отозван или истёк.",
      "github-unreachable": "GitHub не ответил. Проверьте интернет на этом компьютере.",
      "github-refused": "GitHub отклонил запрос.",
      "repo-invisible": "GitHub отвечает «не найдено»: либо репозитория нет, либо этому токену его не видно.",
      "no-token": "Сначала сохраните токен.",
      network: "Узел не ответил.",
    },
  },
}

export function githubWords(lang: string): GithubWords {
  return DICT[lang] ?? DICT.en
}
