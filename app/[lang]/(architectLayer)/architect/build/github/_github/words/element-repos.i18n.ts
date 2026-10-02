// СЛОВА «РЕПОЗИТОРИИ ЭЛЕМЕНТОВ» (шаг 374-2, 374-3). `en` основа, `ru` перевод; сервер выбирает язык, островку — пропсом.
export type ElementReposWords = {
  title: string
  intro: string
  noToken: string
  create: string
  creating: string
  refresh: string
  colItem: string
  colRepo: string
  colKey: string
  colState: string
  keyElement: string
  keyNode: string
  keyNone: string
  noRepo: string
  pushed: string
  never: string
  dirty: string
  push: string
  commitPush: string
  pushing: string
  pushedNow: string
  jobRunning: string
  jobDone: string
  jobInterrupted: string
  jobNow: string
  rateWait: string
  rateTitle: string
  rowWait: string
  mapPushed: string
  mapAuthor: string
  mapFailed: string
  updateAvailable: string
  update: string
  updating: string
  updateMerged: string
  updateOnDeploy: string
  updateConflict: string
  updateMerging: string
  errors: Record<string, string>
}

const DICT: Record<"en" | "ru", ElementReposWords> = {
  en: {
    title: "Repositories of the AGI ITEMS",
    intro: "Every AGI ITEM — the required ones and yours — keeps its whole history in a private repository of your account. The node creates them itself when the key is added; a change goes there with the «Send» button (an agent sends on request, and a task from Telegram is committed and sent at once). Its own key on an item's page is stronger than this one.",
    noToken: "There is no GitHub key yet — the items live only on this computer. Add the key above: the repositories are created right away.",
    create: "Create the missing repositories",
    creating: "Creating repositories and uploading the history…",
    refresh: "Refresh",
    colItem: "AGI ITEM",
    colRepo: "Repository",
    colKey: "Key",
    colState: "State",
    keyElement: "its own",
    keyNode: "the node's",
    keyNone: "none",
    noRepo: "not created yet",
    pushed: "sent",
    never: "never sent",
    dirty: "uncommitted changes: {n}",
    push: "Send",
    commitPush: "Commit and send",
    pushing: "Sending…",
    pushedNow: "Sent: {commit}",
    jobRunning: "The node is creating repositories (started {at}). Press Refresh to see the progress.",
    jobDone: "Last run {at}: created or found {ok} of {all}.",
    rateTitle: "GitHub allows creating repositories again in",
    rowWait: "waits for GitHub",
    rateWait: "GitHub temporarily stopped this account from creating repositories (a secondary rate limit). The node stopped at once — GitHub warns that requests during the block can get an integration banned. When the clock reaches zero (at {at}) the button «Create the missing repositories» comes back; what was already created is picked up.",
    jobNow: "Now: {id} (done {done} of {total}). A required item first fetches its whole history from Fractera — a few minutes each.",
    jobInterrupted: "The run started {at} was interrupted — the node restarted while it worked. Press «Create the missing repositories» again: what was already created is picked up.",
    mapPushed: "The project map went to your fork — a clone of the fork restores every item.",
    mapAuthor: "This is the author's node: the map stays here (the original Fractera repository is never written).",
    mapFailed: "The project map was not sent to the fork:",
    updateAvailable: "Fractera released {target} (this item is on {base})",
    update: "Update",
    updating: "Merging…",
    updateMerged: "Merged: {commit}. It goes live with «Deploy» on the item's page.",
    updateOnDeploy: "No own changes here — the item moves to {target} with its next «Deploy».",
    updateConflict: "Conflicts in {n} file(s) — the task is in the item's terminal: start the agent and press «Paste».",
    updateMerging: "a merge is waiting for its agent",
    errors: {
      "merge-in-progress": "a previous merge is still open — let the item's agent finish it",
      "not-updatable": "this item is not updated from Fractera",
      "fetch-failed": "could not fetch the tags from Fractera",
      "merge-failed": "the merge failed",
      "no-token": "no key",
      "token-rejected": "GitHub does not accept the key",
      "no-create-right": "the key cannot create repositories — create a classic key with the «repo» and «workflow» boxes",
      "name-taken": "a repository with this name already exists and is not empty",
      "unshallow-failed": "could not fetch the full history from Fractera",
      "needs-workflow": "the key lacks «workflow» (the item carries .github/workflows)",
      "no-write": "the key cannot write — create a classic key with the «repo» box",
      "push-failed": "sending failed",
      "github-unreachable": "GitHub did not answer",
      "no-folder": "no folder on this computer",
      "rate-limited": "GitHub temporarily stopped creating repositories for this account (secondary rate limit)",
      postponed: "postponed — the run stopped at GitHub's limit",
      "no-commits": "no commits yet",
      "not-connected": "no repository or key",
      dirty: "there are uncommitted changes",
      rejected: "the repository has other history",
      "auth-failed": "GitHub refused the key",
      "repo-not-found": "the repository is not found",
      "commit-failed": "the commit failed",
      "fork-ahead": "the fork has newer commits — update this computer first",
      "no-fork": "this node was not installed from a fork",
      unknown: "it did not work:",
    },
  },
  ru: {
    title: "Репозитории AGI ITEMS",
    intro: "Каждый AGI ITEM — и обязательные, и ваши — хранит всю свою историю в приватном репозитории вашего аккаунта. Узел создаёт их сам, как только добавлен ключ; правка уезжает туда кнопкой «Отправить» (агент отправляет по вашей просьбе, а задача из Telegram коммитится и отправляется сразу). Собственный ключ на странице элемента сильнее этого.",
    noToken: "Ключа GitHub пока нет — элементы живут только на этом компьютере. Добавьте ключ выше: репозитории создадутся сразу.",
    create: "Создать недостающие репозитории",
    creating: "Создаю репозитории и выгружаю историю…",
    refresh: "Обновить",
    colItem: "AGI ITEM",
    colRepo: "Репозиторий",
    colKey: "Ключ",
    colState: "Состояние",
    keyElement: "свой",
    keyNode: "узла",
    keyNone: "нет",
    noRepo: "ещё не создан",
    pushed: "отправлено",
    never: "ещё не отправлялся",
    dirty: "незакоммиченных правок: {n}",
    push: "Отправить",
    commitPush: "Закоммитить и отправить",
    pushing: "Отправляю…",
    pushedNow: "Отправлено: {commit}",
    jobRunning: "Узел создаёт репозитории (начал в {at}). Нажмите «Обновить», чтобы увидеть ход.",
    jobDone: "Последний запуск {at}: создано или найдено {ok} из {all}.",
    rateTitle: "GitHub снова разрешит создавать репозитории через",
    rowWait: "ждёт GitHub",
    rateWait: "GitHub временно запретил этому аккаунту создавать репозитории (вторичный предел). Узел сразу остановился — GitHub предупреждает, что запросы во время запрета могут закончиться блокировкой. Когда отсчёт дойдёт до нуля (в {at}), вернётся кнопка «Создать недостающие репозитории»; уже созданное будет подхвачено.",
    jobNow: "Сейчас: {id} (готово {done} из {total}). Обязательный элемент сначала дотягивает всю свою историю с Fractera — по несколько минут на каждый.",
    jobInterrupted: "Запуск {at} прерван — узел перезапустился во время работы. Нажмите «Создать недостающие репозитории» ещё раз: уже созданное будет подхвачено.",
    mapPushed: "Карта проекта отправлена в ваш форк — клон форка восстановит каждый элемент.",
    mapAuthor: "Это узел автора: карта остаётся здесь (оригинальный репозиторий Fractera не пишется никогда).",
    mapFailed: "Карта проекта не отправлена в форк:",
    updateAvailable: "Fractera выпустила {target} (элемент на {base})",
    update: "Обновить",
    updating: "Сливаю…",
    updateMerged: "Слито: {commit}. В работу уйдёт кнопкой «Развернуть» на странице элемента.",
    updateOnDeploy: "Своих правок здесь нет — элемент перейдёт на {target} при следующем «Развернуть».",
    updateConflict: "Конфликты в {n} файл(ах) — задача уже в терминале элемента: запустите агента и нажмите «Вставить».",
    updateMerging: "слияние ждёт своего агента",
    errors: {
      "merge-in-progress": "прежнее слияние ещё открыто — пусть агент элемента его закончит",
      "not-updatable": "этот элемент не обновляется с Fractera",
      "fetch-failed": "не удалось забрать теги с Fractera",
      "merge-failed": "слияние не удалось",
      "no-token": "нет ключа",
      "token-rejected": "GitHub не принимает ключ",
      "no-create-right": "ключ не может создавать репозитории — создайте классический ключ с галочками «repo» и «workflow»",
      "name-taken": "репозиторий с таким именем уже есть и он не пуст",
      "unshallow-failed": "не удалось дотянуть полную историю с Fractera",
      "needs-workflow": "у ключа нет «workflow» (элемент несёт .github/workflows)",
      "no-write": "ключ не может писать — создайте классический ключ с галочкой «repo»",
      "push-failed": "отправка не удалась",
      "github-unreachable": "GitHub не ответил",
      "no-folder": "на этом компьютере нет папки",
      "rate-limited": "GitHub временно запретил этому аккаунту создавать репозитории (вторичный предел)",
      postponed: "отложено — запуск остановлен на пределе GitHub",
      "no-commits": "ещё нет коммитов",
      "not-connected": "нет репозитория или ключа",
      dirty: "есть незакоммиченные правки",
      rejected: "в репозитории другая история",
      "auth-failed": "GitHub отверг ключ",
      "repo-not-found": "репозиторий не найден",
      "commit-failed": "коммит не удался",
      "fork-ahead": "в форке есть более новые коммиты — сначала обновите этот компьютер",
      "no-fork": "узел поставлен не из форка",
      unknown: "не получилось:",
    },
  },
}

export function elementReposWords(lang: string): ElementReposWords {
  return lang === "ru" ? DICT.ru : DICT.en
}
