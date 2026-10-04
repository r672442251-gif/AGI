// СЛОВА СТРАНИЦЫ «РАЗВЁРТЫВАНИЯ» РОЖДЁННОГО ЭЛЕМЕНТА (321). `en` основа, `ru` перевод.

export type ElementDeploymentsUi = {
  notBorn: string
  caption: string
  headers: [string, string, string, string]
  running: string
  exported: string
  rollback: string
  /** 322: откат к выбранной версии новым коммитом. */
  rollbackLead: string
  rollbackPick: string
  rollbackConfirm: string
  rollbackDirty: string
  rollbackYes: string
  rollbackNo: string
  rollbackDone: string
  rollbackSaved: string
  rollbackErrors: Record<string, string>
  /** 344-3: копия публичных страниц в Cloudflare. */
  copyOk: string
  copyFailed: string
  copyNoWorkers: string
}

const DICT: Record<string, ElementDeploymentsUi> = {
  en: {
    notBorn: "The element is not born yet: give birth to it on its home page — then its versions appear here.",
    caption: "Versions of the element — its own commits, newest first",
    headers: ["Date", "Commit", "Description", "State"],
    running: "running",
    exported: "in GitHub",
    rollback: "Roll back to a version",
    rollbackLead: "The files of the chosen version come back as a NEW commit — the history stays, and you can return to any version, including the current one, the same way. The node's own settings (design, project) are not rolled back. The element is rebuilt next to the running one, without downtime.",
    rollbackPick: "Version",
    rollbackConfirm: "Roll the element back to {version}?",
    rollbackDirty: "The agent has {n} unsaved files — they are saved first as a commit «Saved before rollback», nothing is lost.",
    rollbackYes: "Roll back",
    rollbackNo: "Cancel",
    rollbackDone: "Rolled back to {target}: new commit {commit}. The build is running — its progress is in «Deploy» above.",
    rollbackSaved: "Unsaved files were saved first: commit {commit}.",
    rollbackErrors: {
      "not-in-history": "This version is not in the element's history.",
      "same-version": "The element already has exactly these files — nothing to roll back.",
      "deploy-running": "A deployment is running — wait for it to finish and try again.",
      "preview-pending": "A preview waits for «Accept» or «Reject» — decide on it first.",
      "temporary-address": "Rolling back works on this computer (localhost) or on your own domain.",
      "git-failed": "git refused the operation:",
      unknown: "The node did not answer.",
    },
    copyOk: "Copy of the public pages in Cloudflare: {time}, {files} files. {host} stays visible while this computer is off. It is renewed by itself after «Accept» and «Deploy».",
    copyFailed: "The copy of the public pages in Cloudflare was not renewed ({time}): {reason}. Visitors see the previous copy, if there is one.",
    copyNoWorkers: "the node's Cloudflare key has no rights to Workers — renew the key in Domain and hosting → Domain activation",
  },
  ru: {
    notBorn: "Элемент ещё не рождён: родите его на главной — тогда здесь появятся его версии.",
    caption: "Версии элемента — его собственные коммиты, новые сверху",
    headers: ["Дата", "Коммит", "Описание", "Состояние"],
    running: "работает",
    exported: "в GitHub",
    rollback: "Откатить к версии",
    rollbackLead: "Файлы выбранной версии возвращаются НОВЫМ коммитом — история сохраняется, и к любой версии, включая текущую, можно вернуться так же. Настройки самого узла (дизайн, проект) не откатываются. Элемент пересобирается рядом с работающим, без простоя.",
    rollbackPick: "Версия",
    rollbackConfirm: "Откатить элемент к версии {version}?",
    rollbackDirty: "У агента {n} несохранённых файлов — сначала они сохранятся коммитом «Сохранено перед откатом», ничего не потеряется.",
    rollbackYes: "Откатить",
    rollbackNo: "Отмена",
    rollbackDone: "Откат к {target}: новый коммит {commit}. Идёт сборка — её ход в «Развернуть» выше.",
    rollbackSaved: "Несохранённые файлы сохранены коммитом {commit}.",
    rollbackErrors: {
      "not-in-history": "Этой версии нет в истории элемента.",
      "same-version": "У элемента уже ровно эти файлы — откатывать нечего.",
      "deploy-running": "Идёт развёртывание — дождитесь его окончания и повторите.",
      "preview-pending": "Предпросмотр ждёт «Принять» или «Отклонить» — сначала решите его.",
      "temporary-address": "Откат работает на этом компьютере (localhost) или на вашем домене.",
      "git-failed": "git отказал:",
      unknown: "Узел не ответил.",
    },
    copyOk: "Копия публичных страниц в Cloudflare: {time}, файлов — {files}. {host} виден, когда этот компьютер выключен. Копия обновляется сама после «Принять» и «Развернуть».",
    copyFailed: "Копия публичных страниц в Cloudflare не обновилась ({time}): {reason}. Посетители видят прежнюю копию, если она есть.",
    copyNoWorkers: "у ключа Cloudflare узла нет прав на Workers — обновите ключ в «Домен и хостинг → Активация домена»",
  },
}

export function elementDeploymentsUi(lang: string): ElementDeploymentsUi {
  return DICT[lang] ?? DICT.en
}
