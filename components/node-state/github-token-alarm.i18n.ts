// СЛОВА ТРЕВОЖНОЙ ПОЛОСЫ «РАБОТА НЕ СОХРАНЯЕТСЯ В GITHUB» (шаг 374-9). `en` основа, `ru` перевод; выбирает сервер и передаёт
// острову пропсом.
export type GithubTokenAlarmWords = { lead: string; why: string; connect: string; leadSome: string; whySome: string; open: string; hide: string; hideTitle: string }

const DICT: Record<"en" | "ru", GithubTokenAlarmWords> = {
  en: {
    lead: "Your AGI ITEMS are kept only on this computer.",
    why: "Every change is saved in each item's own history here, but nowhere else: if this computer breaks, the work is gone. Add a GitHub token and create a private repository for every AGI ITEM in your account — the whole history goes there; the project can then be restored on any computer, and any item can be handed over on its own.",
    connect: "Add a GitHub token",
    leadSome: "{n} AGI ITEM(S) are not saved to GitHub yet:",
    whySome: "Their work lives only on this computer. Give each a good name first if you want (the repository takes the item's name), then press «Create and upload» in its row.",
    open: "Open GitHub",
    hide: "Don't show again",
    hideTitle: "Hide on this computer for one day",
  },
  ru: {
    lead: "Ваши AGI ITEMS хранятся только на этом компьютере.",
    why: "Каждая правка сохраняется в истории своего элемента здесь, но больше нигде: если компьютер сломается, работа пропадёт. Добавьте токен GitHub и создайте в своём аккаунте приватный репозиторий каждому AGI ITEM — туда уедет вся история; тогда проект можно восстановить на любом компьютере, а любой элемент — передать отдельно.",
    connect: "Добавить токен GitHub",
    leadSome: "Не сохранены в GitHub ({n}):",
    whySome: "Их работа живёт только на этом компьютере. Если хотите, сначала дайте элементу хорошее имя (репозиторий получит имя элемента), затем нажмите «Создать и выгрузить» в его строке.",
    open: "Открыть GitHub",
    hide: "Больше не показывать",
    hideTitle: "Скрыть на этом компьютере на сутки",
  },
}

export function githubTokenAlarmWords(lang: string): GithubTokenAlarmWords {
  return lang === "ru" ? DICT.ru : DICT.en
}
