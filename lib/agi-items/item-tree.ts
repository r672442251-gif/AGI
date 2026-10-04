// ДЕРЕВО СТРАНИЦ ОДНОГО AGI ITEM (шаг 314-1). Структура — слово владельца 2026-09-26: Preview · строительство · коннекторы ·
// web3 store · проектирование продукта · документы · процесс («Последний раздел подписки исправь на вот этот вот»).
//
// 🔒 ОДИН ФАЙЛ — И МЕНЮ, И МАРШРУТ, И ЗАГЛУШКИ. Список разделов, объявленный второй раз где-то ещё, разойдётся молча:
// добавили страницу — в меню она есть, а маршрут отвечает 404, или наоборот.
// 🔒 ДВА УРОВНЯ ПОД ЭЛЕМЕНТОМ: разделы и их страницы; с шага 320 левое меню раскрывает и страницы раздела (третий уровень),
// а раздел по-прежнему перечисляет их справа.
// Слова — `en` основа, `ru` перевод; пока у страниц только заглушка: заголовок и описание.

export type TreeWords = { title: string; lead: string }
export type TreePage = { slug: string; words: Record<"en" | "ru", TreeWords>; pages?: TreePage[] }

const w = (enTitle: string, enLead: string, ruTitle: string, ruLead: string): Record<"en" | "ru", TreeWords> => ({
  en: { title: enTitle, lead: enLead },
  ru: { title: ruTitle, lead: ruLead },
})

export const ITEM_TREE: TreePage[] = [
  { slug: "preview", words: w("Live site", "The element's own site as it runs now and a visitor sees it.", "Живой сайт", "Сайт элемента таким, каким он работает сейчас и каким его видит посетитель.") }, // 393: «Preview» → «Живой сайт» (владелец 2026-10-04)
  {
    slug: "build",
    words: w("Build", "Everything the element's agent needs to build it.", "Строительство", "Всё, что нужно агенту элемента, чтобы его строить."),
    pages: [
      // 384-1, слово владельца 2026-10-03: «перевести её вверх самый вверх выше чем подписка Claude Code Agent».
      { slug: "github", words: w("GitHub", "The element's own repository.", "GitHub", "Собственный репозиторий элемента.") },
      { slug: "subscription", words: w("Claude Code subscription", "Signing the element's agent in to the Claude Code subscription.", "Подписка Claude Code", "Вход агента элемента в подписку Claude Code.") },
      { slug: "terminal", words: w("Terminal", "A live Claude Code in the element's folder: started and stopped here.", "Терминал", "Живой Claude Code в папке элемента: запускается и останавливается здесь.") },
      // Владелец 2026-10-01: «кнопку развёртывания мы находим внизу а это очень важная кнопка … подними её вверх и установи сразу
      // под кнопкой терминал».
      { slug: "deployments", words: w("Deployments", "Versions of the element and a way back to a working one.", "Развёртывания", "Версии элемента и путь назад к работающей.") },
      { slug: "telegram", words: w("Telegram bot", "A bot that talks to the same agent session.", "Telegram бот", "Бот, который говорит с той же сессией агента.") },
      { slug: "skills", words: w("Skills", "The skills the element's agent carries.", "Навыки", "Навыки, которые несёт агент элемента.") },
      { slug: "hooks", words: w("Hooks", "Commands the agent's tools run on their own events.", "Хуки", "Команды, которые инструменты агента запускают на своих событиях.") },
      // 330-6, слово владельца: «рядом с ними внизу добавляй два раздела: плагины, браузерные расширения … что пользователь
      // должен поставить для максимальной эффективности проекта».
      { slug: "plugins", words: w("Plugins", "Claude Code plugins to install so the element's agent works at its best.", "Плагины", "Плагины Claude Code, которые стоит поставить, чтобы агент элемента работал максимально эффективно.") },
      { slug: "browser-extensions", words: w("Browser extensions", "Browser extensions to install for the most effective work on the project.", "Браузерные расширения", "Расширения браузера, которые стоит поставить для максимально эффективной работы над проектом.") },
      { slug: "environment", words: w("Environment variables", "Keys and settings the element reads at start.", "Переменные окружения", "Ключи и настройки, которые элемент читает при старте.") },
    ],
  },
  {
    slug: "connectors",
    words: w("Connectors", "How other programs and agents reach this element.", "Коннекторы", "Как до этого элемента достают другие программы и агенты."),
    pages: [
      { slug: "api", words: w("API", "The element's HTTP doors.", "API", "HTTP-двери элемента.") },
      { slug: "mcp", words: w("MCP", "The element's tools for agents over MCP.", "MCP", "Инструменты элемента для агентов по MCP.") },
      { slug: "a2a", words: w("A2A", "Agent-to-agent protocol of the element.", "A2A", "Протокол агент-агент у элемента.") },
    ],
  },
  {
    slug: "web3-store",
    words: w("Web3 store", "Finding elements in the web3 store and publishing this one there.", "Web3 store", "Поиск элементов в web3 store и публикация этого элемента там."),
    pages: [
      { slug: "find", words: w("Find in the web3 store", "Look for a ready element before building one.", "Найти в web3 Store", "Найти готовый элемент, прежде чем строить свой.") },
      { slug: "publish", words: w("Send to the web3 store", "Offer this element to others.", "Отправить в web3 store", "Предложить этот элемент другим.") },
    ],
  },
  {
    slug: "product-design",
    words: w("Product design", "What the element should become, before its code.", "Проектирование продукта", "Каким должен стать элемент — до его кода."),
    pages: [
      { slug: "quiz", words: w("Product quiz", "Questions that shape the element.", "Продуктовый квиз", "Вопросы, из которых складывается элемент.") },
      { slug: "from-nextjs", words: w("Move from another Next.js", "Bringing an existing Next.js project into the element.", "Переезд из другого Next.js", "Перенос существующего проекта Next.js в элемент.") },
      { slug: "from-framework", words: w("Move from another framework", "Bringing a project built on another framework.", "Переезд из другого фреймворка", "Перенос проекта на другом фреймворке.") },
    ],
  },
  {
    slug: "documents",
    words: w("Documents", "The element's instruction and the record of its development.", "Документы", "Инструкция элемента и запись о его разработке."),
    pages: [
      { slug: "instruction", words: w("Main instruction", "What the element's agent reads first.", "Главная инструкция", "То, что агент элемента читает первым.") },
      { slug: "task-add", words: w("Add a task", "A task for the element's agent.", "Добавить задание", "Задание агенту элемента.") },
      { slug: "steps-plan", words: w("Development steps: plan", "Steps planned and not started.", "Шаги разработки: план", "Запланированные и не начатые шаги.") },
      { slug: "steps-done", words: w("Development steps: done", "Steps closed, with their proof.", "Шаги разработки: завершённые", "Закрытые шаги с их доказательствами.") },
      { slug: "steps-cancelled", words: w("Development steps: cancelled", "Steps dropped, and why.", "Шаги разработки: отменённые", "Отменённые шаги и причина.") },
      { slug: "step-current", words: w("Current step", "Where the work is right now.", "Текущий шаг", "Где работа прямо сейчас.") },
      { slug: "translation-debt", words: w("Translation debt", "Words still missing in some language.", "Долги по переводам", "Слова, которых ещё нет на каком-то языке.") },
      { slug: "backlog", words: w("Backlog", "Built but not explained, or promised.", "Backlog", "Построенное, но не объяснённое, или обещанное.") },
      { slug: "glossary", words: w("Glossary", "The element's own words.", "Глоссарий", "Собственные слова элемента.") },
      { slug: "anti-patterns", words: w("Anti-patterns", "Dead ends already paid for.", "Антипаттерны", "Тупики, за которые уже заплачено.") },
      { slug: "docs-registry", words: w("Document registry", "Every document of the element in one list.", "Реестр документов", "Все документы элемента одним списком.") },
    ],
  },
  {
    slug: "process",
    words: w("Process", "What the element does while it works.", "Процесс", "Что элемент делает, пока работает."),
    pages: [
      { slug: "subscriptions", words: w("Subscriptions", "Outside services this element may use.", "Подписки", "Внешние сервисы, которыми может пользоваться элемент.") },
      { slug: "cron", words: w("Cron automations", "Work that runs on a schedule.", "Крон автоматизации", "Работа, которая идёт по расписанию.") },
    ],
  },
  // 325 (слово владельца 2026-09-27): обязательная страница внизу — «Настройки», так называемый Danger zone. Всегда последняя.
  {
    slug: "settings",
    words: w("Settings", "The element's danger zone and the settings of its own site.", "Настройки", "Опасная зона элемента и настройки его собственного сайта."),
    // 328 (слово владельца 2026-09-28): «на вкладке настройки увидеть выпадающий список … страница настройки, которые уже
    // существуют, и страница конфигуратора». Конфигуратор живёт в самом элементе (выбор «б» 324-8) — страница ядра открывает
    // его на главном адресе в новой вкладке (выбор «б» 2026-09-28: во встроенном окне свой домен не получил бы билет входа).
    pages: [
      { slug: "danger-zone", words: w("Danger zone", "The element's description in the core, its address, its main mirror, links to the node and deleting it.", "Опасная зона", "Описание элемента в ядре, его адрес, главное зеркало, связи с узлом и удаление.") },
      { slug: "site-settings", words: w("Site settings", "The name, texts, search settings, images and languages of the element's own site.", "Настройки сайта", "Название, тексты, настройки для поиска, картинки и языки собственного сайта элемента.") },
    ],
  },
]

export type TreeLang = "en" | "ru"
export const treeLang = (lang: string): TreeLang => (lang === "ru" ? "ru" : "en")

/** Страница дерева по пути `[раздел, страница?]`; нет такой — `null`. */
export function findTreePage(path: string[]): { section: TreePage; page: TreePage | null } | null {
  if (path.length === 0 || path.length > 2) return null
  const section = ITEM_TREE.find((s) => s.slug === path[0])
  if (!section) return null
  if (path.length === 1) return { section, page: null }
  const page = section.pages?.find((p) => p.slug === path[1]) ?? null
  return page ? { section, page } : null
}
