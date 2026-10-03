// СЛОВА СТРАНИЦЫ GITHUB РОЖДЁННОГО ЭЛЕМЕНТА (319-5). `en` основа, `ru` перевод; строки выбирает сервер и передаёт островку.
// 384-3 (владелец 2026-10-03: «правильно ли писать ключ GitHub или токен?»): GitHub называет это personal access token — здесь
// везде «токен GitHub» (en: «GitHub token»). «Ключ» остаётся за Cloudflare и OpenAI.

export type ElementGithubUi = {
  notBorn: string
  plateOk: string
  plateSourceNode: string
  plateSourceElement: string
  plateNoRepo: string
  createRepo: string
  creatingRepo: string
  plateNoToken: string
  plateNoTokenLink: string
  otherTitle: string
  otherHelp: string
  step1: string
  step1Link: string
  step2: string
  step2Link: string
  step2Sub: string[]
  step3: string
  step4: string
  repoLabel: string
  repoPlaceholder: string
  tokenLabel: string
  tokenPlaceholder: string
  tokenHelp: string
  activeNode: string
  activeElement: string
  activeNone: string
  connectOk: string
  tokenNodeShort: string
  tokenOwnShort: string
  renameTitle: string
  renameHelp: string
  renameCurrent: string
  renameLabel: string
  renameButton: string
  renaming: string
  renamed: string
  renameSame: string
  connect: string
  connecting: string
  connected: string
  account: string
  keyTail: string
  expires: string
  noExpiry: string
  forget: string
  push: string
  pushing: string
  pushHelp: string
  lastPush: string
  neverPushed: string
  dirty: string
  dirtyHelp: string
  commitPush: string
  commitPushHelp: string
  pushed: string
  nextStep: string
  network: string
  importTitle: string
  importIntro: string
  importRepo: string
  importToken: string
  importTokenHelp: string
  importButton: string
  importConfirm: string
  importYes: string
  importCancel: string
  importRefresh: string
  importState: Record<string, string>
  errors: Record<string, string>
}

const DICT: Record<string, ElementGithubUi> = {
  en: {
    notBorn: "The element is not born yet: give birth to it on its home page — then its folder can go to GitHub.",
    plateOk: "Saved to GitHub: {repo} — {source}.",
    plateSourceNode: "with the node's common token …{tail}",
    plateSourceElement: "with this item's own token …{tail}",
    plateNoRepo: "The node has a GitHub token, but this item has no repository yet — its work lives only on this computer.",
    createRepo: "Create and upload",
    creatingRepo: "Creating the repository…",
    plateNoToken: "The node has no GitHub token — nothing of this item is saved to GitHub.",
    plateNoTokenLink: "Add the node's token",
    otherTitle: "Another repository or this item's own token — optional",
    otherHelp: "Not needed while the plate above is green. Here you point this item to another repository (in the same GitHub account the token that works now is used by itself — nothing to type) or give it its own token: it is stronger than the common one, for example to give this item access to one repository only.",
    step1: "Another repository: create an empty one on GitHub — without a README, or GitHub will reject the export.",
    step1Link: "Create a repository",
    step2: "Own token (only if the repository is in another GitHub account or you want to narrow access): sign in as the account that owns the repository and create a classic token:",
    step2Link: "Create a classic token",
    step2Sub: [
      "If a list of tokens opens, press «Generate new token» and choose «Generate new token (classic)» — not the fine-grained one.",
      "Note — any name, e.g. «fractera element»; Expiration — the term you want.",
      "Tick two boxes: «repo» (writing to your repositories) and «workflow» (the element carries GitHub Actions files in .github/workflows — without this box GitHub refuses them). Nothing else is needed.",
      "Press «Generate token» at the bottom and copy the token — it starts with ghp_.",
    ],
    step3: "Paste the repository (and the token, if you made one) below and press «Check and save».",
    step4: "Sending answers 403? The token has no «repo» box or belongs to another GitHub account — create a new one by point 2, paste it and press «Check and save»: it replaces the old one.",
    repoLabel: "Repository",
    repoPlaceholder: "owner/name or https://github.com/owner/name",
    tokenLabel: "Replace with this item's own token (optional)",
    tokenPlaceholder: "ghp_… — only to replace the token above",
    tokenHelp: "The token named above already works — nothing has to be typed. Type a token here only to give this item its OWN token instead of the node's common one: for a repository in another GitHub account or to narrow access to one repository. A classic token with «repo» and «workflow»; the node keeps it in its own data (owner-only), shows only the last 4 characters and never writes it into git settings.",
    activeNode: "Works now: the node's common GitHub token …{tail}",
    activeElement: "Works now: this item's own GitHub token …{tail}",
    activeNone: "Works now: no GitHub token — neither the node nor this item has one",
    connectOk: "The token is confirmed as active: {source} can write to {repo}. From now on this item's work goes to {repo} — by the «Send to GitHub» button, by its agent when you ask it, and tasks from Telegram are sent at once.",
    tokenNodeShort: "the node's common token …{tail}",
    tokenOwnShort: "this item's own token …{tail}",
    renameTitle: "Rename the repository",
    renameHelp: "Renames the repository on GitHub; the node writes the new name everywhere it keeps it. GitHub redirects the old links itself, and pushes and clones to the old address keep working. Do not create a new repository with the old name later — that breaks the redirect.",
    renameCurrent: "Now",
    renameLabel: "New name",
    renameButton: "Rename the repository",
    renaming: "Renaming…",
    renamed: "The repository is renamed: {from} → {to}. GitHub redirects the old links itself.",
    renameSame: "The repository already has this name.",
    connect: "Check and save",
    connecting: "Asking GitHub…",
    connected: "Connected",
    account: "Account",
    keyTail: "Own token ends with",
    expires: "Token expires",
    noExpiry: "no expiry",
    forget: "Forget this item's own token",
    push: "Send to GitHub",
    pushing: "Sending…",
    pushHelp: "Sends the element's committed history to the branch main of the repository. Nothing is sent by itself — only by this button. The repository should be empty or already hold this element's history.",
    lastPush: "Last export",
    neverPushed: "not exported yet",
    dirty: "The element's folder has {n} uncommitted change(s) — nothing was sent.",
    dirtyHelp: "Changes the agent has not committed are not part of the history and would not reach GitHub. Ask the element's agent to commit them, then press «Send to GitHub» again.",
    commitPush: "Commit and send",
    commitPushHelp: "The node commits every uncommitted change itself as «export <date>» and sends. Use it when you do not want to wait for the agent; the commit message says nothing about what changed.",
    pushed: "Sent: commit {commit}.",
    nextStep: "Connected. Next step — press «Send to GitHub».",
    network: "The node did not answer as expected (code {code}). Reload the page and try again; if it repeats, the reason is in the node log.",
    importTitle: "Replace the code from another repository",
    importIntro: "Bought or found a ready project? It takes this item's place: the same address, domain and port, the new code. The current history first goes to this item's repository and stays there as an archive.",
    importRepo: "Repository to take (owner/name)",
    importToken: "GitHub token (optional)",
    importTokenHelp: "The token named above is used by itself — for a repository in the same GitHub account nothing has to be typed. A public repository — no token is needed to take it, but this item cannot save into someone else's repository: after the replacement it is unlinked from it, and «Create and upload» saves it to your own private repository. A private repository of another account — only with a token that sees it. A public repository is not free to use by itself: its license decides.",
    importButton: "Replace the code",
    importConfirm: "The code of this item is replaced with {repo}. Its current history goes to {previous} and stays there. The item stops for the time of the build (a few minutes). Continue?",
    importYes: "Yes, replace",
    importCancel: "Cancel",
    importRefresh: "Refresh the state",
    importState: {
      starting: "Starting…",
      archiving: "Saving the current history to its repository…",
      downloading: "Downloading the new project…",
      swapping: "Putting the new project in place…",
      building: "Building — the item is back in a few minutes.",
      done: "Done: the new project works in this item's place. The previous history is in {previous}.",
      detached: "Done: the project from {target} works in this item's place; the previous history is in {previous}. The token cannot write to {target}, so the item is unlinked from it — press «Create and upload» above to save it to your own repository.",
      failed: "Stopped: {reason}",
    },
    errors: {
      "archive-first": "This item has no repository yet — its current history would be lost. Create its repository first («Create and upload» above).",
      "same-repo": "This is already this item's repository.",
      "bad-repo": "Write the repository as owner/name or as its GitHub address.",
      "bad-token-shape": "This does not look like a GitHub token (github_pat_… or ghp_…).",
      "no-token": "The node has no GitHub token yet — add the node's token (Build → GitHub of the node) or type this item's own token.",
      "token-rejected": "GitHub does not accept this token.",
      "no-write": "GitHub does not let this token write to the repository (a trial push answered 403). Create a classic token with the «repo» box under the account that owns the repository (point 2) and paste it.",
      "repo-not-visible": "The repository is not visible: check the name; a private repository of another account needs a token that sees it.",
      "github-unreachable": "GitHub did not answer — check the internet connection.",
      "github-refused": "GitHub refused the check.",
      "not-connected": "Connect the repository first.",
      "rejected": "GitHub rejected the export: the repository holds a different history. Use an empty repository or this element's own.",
      "auth-failed": "GitHub rejected the token while sending (403): the token has no «repo» box or belongs to another account. Create a new one by point 2 and paste it.",
      "repo-not-found": "GitHub does not find the repository.",
      "needs-workflow": "GitHub refused the files in .github/workflows: the token has no «workflow» box. Create a token with «repo» and «workflow» (point 2), paste it and send again.",
      "commit-failed": "The node could not commit the changes.",
      "push-failed": "The export did not go through.",
      "bad-name": "A repository name may hold letters, digits, «.», «_» and «-», up to 100 characters.",
      "name-taken": "GitHub refused: this account already has a repository with that name.",
      "no-rename-right": "GitHub does not let the token rename this repository: it needs the «repo» box and admin rights on the repository.",
      "rename-failed": "GitHub did not rename the repository.",
      "temporary-address": "Tokens are not handled on a temporary public address — open the node on its own domain or on this computer.",
    },
  },
  ru: {
    notBorn: "Элемент ещё не рождён: родите его на главной — тогда его папку можно отправить в GitHub.",
    plateOk: "Сохраняется в GitHub: {repo} — {source}.",
    plateSourceNode: "общим токеном узла …{tail}",
    plateSourceElement: "собственным токеном элемента …{tail}",
    plateNoRepo: "Токен GitHub у узла есть, а репозитория у этого элемента ещё нет — его работа живёт только на этом компьютере.",
    createRepo: "Создать и выгрузить",
    creatingRepo: "Создаю репозиторий…",
    plateNoToken: "У узла нет токена GitHub — ничего из этого элемента в GitHub не сохраняется.",
    plateNoTokenLink: "Добавить токен узла",
    otherTitle: "Другой репозиторий или свой токен элемента — необязательно",
    otherHelp: "Не нужно, пока плашка выше зелёная. Здесь элементу указывают другой репозиторий (в том же аккаунте GitHub токен, который работает сейчас, подставится сам — вводить ничего не нужно) или дают ему свой токен: он сильнее общего, например чтобы дать этому элементу доступ только к одному репозиторию.",
    step1: "Другой репозиторий: создайте на GitHub пустой — без README, иначе GitHub отклонит выгрузку.",
    step1Link: "Создать репозиторий",
    step2: "Свой токен (только если репозиторий в другом аккаунте GitHub или нужно сузить доступ): войдите под аккаунтом-владельцем репозитория и создайте классический токен:",
    step2Link: "Создать классический токен",
    step2Sub: [
      "Если открылся список токенов, нажмите «Generate new token» и выберите «Generate new token (classic)» — не тонкий токен.",
      "Note — любое имя, например «fractera element»; Expiration — нужный срок.",
      "Отметьте две галочки: «repo» (запись в ваши репозитории) и «workflow» (в элементе есть файлы GitHub Actions в .github/workflows — без этой галочки GitHub их не примет). Больше ничего не нужно.",
      "Внизу нажмите «Generate token» и скопируйте токен — он начинается с ghp_.",
    ],
    step3: "Вставьте репозиторий (и токен, если создавали) ниже и нажмите «Проверить и сохранить».",
    step4: "Отправка отвечает 403? У токена нет галочки «repo» или он создан под другим аккаунтом GitHub — создайте новый по пункту 2, вставьте и нажмите «Проверить и сохранить»: он заменит старый.",
    repoLabel: "Репозиторий",
    repoPlaceholder: "владелец/имя или https://github.com/владелец/имя",
    tokenLabel: "Заменить своим токеном элемента (необязательно)",
    tokenPlaceholder: "ghp_… — только чтобы заменить токен выше",
    tokenHelp: "Токен, названный выше, уже работает — вводить ничего не нужно. Сюда вводят токен, только чтобы дать этому элементу СВОЙ токен вместо общего токена узла: для репозитория в другом аккаунте GitHub или чтобы сузить доступ до одного репозитория. Классический токен с галочками «repo» и «workflow»; узел хранит его в своих данных (доступ только владельцу), показывает лишь 4 последних знака и никогда не пишет в настройки git.",
    activeNode: "Сейчас работает: общий токен GitHub узла …{tail}",
    activeElement: "Сейчас работает: собственный токен GitHub элемента …{tail}",
    activeNone: "Сейчас работает: токена GitHub нет — ни у узла, ни у элемента",
    connectOk: "Токен подтверждён как активный: {source} может писать в {repo}. Теперь работа этого элемента уходит в {repo} — кнопкой «Отправить в GitHub», агентом элемента по вашей просьбе, а задачи из Telegram отправляются сразу.",
    tokenNodeShort: "общий токен узла …{tail}",
    tokenOwnShort: "собственный токен элемента …{tail}",
    renameTitle: "Переименовать репозиторий",
    renameHelp: "Переименовывает репозиторий на GitHub; узел записывает новое имя везде, где его хранит. Старые ссылки GitHub перенаправляет сам, отправка и скачивание по старому адресу продолжают работать. Не создавайте потом новый репозиторий со старым именем — перенаправление сломается.",
    renameCurrent: "Сейчас",
    renameLabel: "Новое имя",
    renameButton: "Переименовать репозиторий",
    renaming: "Переименовываю…",
    renamed: "Репозиторий переименован: {from} → {to}. Старые ссылки GitHub перенаправляет сам.",
    renameSame: "У репозитория уже это имя.",
    connect: "Проверить и сохранить",
    connecting: "Спрашиваю GitHub…",
    connected: "Подключено",
    account: "Аккаунт",
    keyTail: "Свой токен заканчивается на",
    expires: "Токен действует до",
    noExpiry: "бессрочный",
    forget: "Забыть свой токен элемента",
    push: "Отправить в GitHub",
    pushing: "Отправляю…",
    pushHelp: "Отправляет закоммиченную историю элемента в ветку main репозитория. Сам узел ничего не отправляет — только эта кнопка. Репозиторий должен быть пустым или уже хранить историю этого элемента.",
    lastPush: "Последняя выгрузка",
    neverPushed: "ещё не выгружался",
    dirty: "В папке элемента {n} незакоммиченных правок — ничего не отправлено.",
    dirtyHelp: "Правки, которые агент не закоммитил, не входят в историю и в GitHub не попадут. Попросите агента элемента закоммитить их и нажмите «Отправить в GitHub» ещё раз.",
    commitPush: "Закоммитить и отправить",
    commitPushHelp: "Узел сам закоммитит все незакоммиченные правки как «export <дата>» и отправит. Для случая, когда ждать агента не хочется; подпись коммита ничего не говорит о том, что изменилось.",
    pushed: "Отправлено: коммит {commit}.",
    nextStep: "Подключено. Следующий шаг — нажмите «Отправить в GitHub».",
    network: "Узел ответил не так, как ожидалось (код {code}). Обновите страницу и повторите; если повторится — причина в журнале узла.",
    importTitle: "Заменить код из другого репозитория",
    importIntro: "Купили или нашли готовый проект? Он встанет на место этого элемента: тот же адрес, домен и порт, новый код. Нынешняя история сначала уедет в репозиторий элемента и останется там архивом.",
    importRepo: "Какой репозиторий взять (владелец/имя)",
    importToken: "Токен GitHub (необязательно)",
    importTokenHelp: "Токен, названный выше, используется сам — для репозитория в том же аккаунте GitHub вводить ничего не нужно. Публичный репозиторий — чтобы забрать, токен не нужен, но сохранять в чужой репозиторий элемент не сможет: после замены он отвязывается от него, и «Создать и выгрузить» сохранит его в ваш собственный приватный репозиторий. Приватный репозиторий другого аккаунта — только с токеном, который его видит. Публичный — не значит свободный: можно ли им пользоваться, решает его лицензия.",
    importButton: "Заменить код",
    importConfirm: "Код элемента заменится на {repo}. Нынешняя история уедет в {previous} и останется там. На время сборки (несколько минут) элемент остановится. Продолжить?",
    importYes: "Да, заменить",
    importCancel: "Отмена",
    importRefresh: "Обновить состояние",
    importState: {
      starting: "Запускаю…",
      archiving: "Сохраняю нынешнюю историю в репозиторий элемента…",
      downloading: "Скачиваю новый проект…",
      swapping: "Ставлю новый проект на место…",
      building: "Собираю — элемент вернётся через несколько минут.",
      done: "Готово: новый проект работает на месте элемента. Прежняя история — в {previous}.",
      detached: "Готово: проект из {target} работает на месте элемента; прежняя история — в {previous}. Писать в {target} токен не может, поэтому элемент от него отвязан — нажмите «Создать и выгрузить» вверху, чтобы сохранить его в свой репозиторий.",
      failed: "Остановлено: {reason}",
    },
    errors: {
      "archive-first": "У элемента ещё нет репозитория — его нынешняя история пропала бы. Сначала создайте ему репозиторий («Создать и выгрузить» вверху).",
      "same-repo": "Это и есть репозиторий этого элемента.",
      "bad-repo": "Укажите репозиторий как владелец/имя или его адресом на GitHub.",
      "bad-token-shape": "Это не похоже на токен GitHub (github_pat_… или ghp_…).",
      "no-token": "У узла ещё нет токена GitHub — добавьте токен узла («Строительство → GitHub» узла) или введите свой токен элемента.",
      "token-rejected": "GitHub не принимает этот токен.",
      "no-write": "GitHub не даёт этому токену писать в репозиторий (пробная отправка — 403). Создайте классический токен с галочкой «repo» под аккаунтом-владельцем репозитория (пункт 2) и вставьте его.",
      "repo-not-visible": "Репозиторий не виден: проверьте имя; приватному репозиторию другого аккаунта нужен токен, который его видит.",
      "github-unreachable": "GitHub не ответил — проверьте подключение к интернету.",
      "github-refused": "GitHub отказал в проверке.",
      "not-connected": "Сначала подключите репозиторий.",
      "rejected": "GitHub отклонил выгрузку: в репозитории другая история. Возьмите пустой репозиторий или собственный этого элемента.",
      "auth-failed": "GitHub отклонил токен при отправке (403): у токена нет галочки «repo» или он создан под другим аккаунтом. Создайте новый по пункту 2 и вставьте его.",
      "repo-not-found": "GitHub не находит репозиторий.",
      "needs-workflow": "GitHub не принял файлы .github/workflows: у токена нет галочки «workflow». Создайте токен с галочками «repo» и «workflow» (пункт 2), вставьте и отправьте снова.",
      "commit-failed": "Узел не смог закоммитить правки.",
      "push-failed": "Выгрузка не прошла.",
      "bad-name": "В имени репозитория — буквы, цифры, «.», «_» и «-», до 100 знаков.",
      "name-taken": "GitHub отказал: в этом аккаунте уже есть репозиторий с таким именем.",
      "no-rename-right": "GitHub не даёт токену переименовать этот репозиторий: нужны галочка «repo» и права администратора репозитория.",
      "rename-failed": "GitHub не переименовал репозиторий.",
      "temporary-address": "На временном публичном адресе токены не принимаются — откройте узел на его домене или на этом компьютере.",
    },
  },
}

export function elementGithubUi(lang: string): ElementGithubUi {
  return DICT[lang] ?? DICT.en
}
