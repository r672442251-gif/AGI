// СЛОВА ТРЕВОЖНОЙ ПОЛОСЫ «ПРОЕКТ НА ВРЕМЕННОМ АДРЕСЕ» (шаг 371-1). `en` основа, `ru` перевод; выбирает сервер и передаёт
// острову пропсом. Русский текст — слова владельца 2026-10-02.
export type TemporaryAddressAlarmWords = { lead: string; warning: string; connect: string; openHere: string; readOnly: string; hide: string; hideTitle: string }

const DICT: Record<"en" | "ru", TemporaryAddressAlarmWords> = {
  en: {
    lead: "Your project is available on the internet at a temporary address:",
    warning: "This address can change at any time. Connect your own domain before you start using sign-in.",
    connect: "Connect your own domain",
    openHere: "Open on this computer",
    hide: "Don't show again",
    hideTitle: "Hide on this computer for one day",
    readOnly: "Here the panel is read-only: settings, keys, the agent terminal and the Claude subscription work on the computer where the node runs.",
  },
  ru: {
    lead: "Ваш проект доступен в интернете по временному адресу:",
    warning: "Однако этот адрес может быть изменён в любое время. Рекомендуется подключить собственный домен прежде чем начинать использовать авторизацию.",
    connect: "Подключить свой домен",
    openHere: "Открыть на этом компьютере",
    hide: "Больше не показывать",
    hideTitle: "Скрыть на этом компьютере на сутки",
    readOnly: "Здесь пульт работает только на чтение: настройки, ключи, терминал агента и подписка Claude — на компьютере, где работает узел.",
  },
}

export function temporaryAddressAlarmWords(lang: string): TemporaryAddressAlarmWords {
  return lang === "ru" ? DICT.ru : DICT.en
}
