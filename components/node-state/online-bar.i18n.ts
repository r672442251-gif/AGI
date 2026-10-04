// СЛОВА ПОЛОСЫ «ВАШ САЙТ В СЕТИ / НЕ В СЕТИ» (шаг 386-2). `en` основа, `ru` перевод; выбирает сервер и передаёт острову пропсом.
// Русский текст — слова владельца 2026-10-04: «ваш сайт в сети, Cloud Flyer возвращает динамические страницы … ваш сайт не в сети
// Cloud Flyer возвращает только статические страницы», «кнопка спросить у Cloudflayer».
export type OnlineBarWords = {
  online: string
  offline: string
  asking: string
  unknown: string
  noDomain: string
  ask: string
  details: string
  tunnel: string
  tunnelStates: Record<string, string>
  points: string
  noPoints: string
  probe: string
  answeredHome: string
  answeredCopy: string
  checkedAt: string
}

const DICT: Record<"en" | "ru", OnlineBarWords> = {
  en: {
    online: "Your site is online — Cloudflare serves dynamic pages",
    offline: "Your site is offline — Cloudflare serves only static pages",
    asking: "Asking Cloudflare…",
    unknown: "Could not ask Cloudflare",
    noDomain: "No own domain yet — only the temporary address",
    ask: "Ask Cloudflare",
    details: "Details",
    tunnel: "Tunnel of this computer",
    tunnelStates: { healthy: "healthy", degraded: "degraded", down: "down", inactive: "inactive" },
    points: "Cloudflare points it is connected through",
    noPoints: "none — Cloudflare cannot reach this computer",
    probe: "Live request through the internet",
    answeredHome: "answered by this computer",
    answeredCopy: "answered by the copy «the site owner is offline»",
    checkedAt: "checked at",
  },
  ru: {
    online: "Ваш сайт в сети — Cloudflare отдаёт динамические страницы",
    offline: "Ваш сайт не в сети — Cloudflare отдаёт только статические страницы",
    asking: "Спрашиваю у Cloudflare…",
    unknown: "Не удалось спросить у Cloudflare",
    noDomain: "Своего домена пока нет — только временный адрес",
    ask: "Спросить у Cloudflare",
    details: "Подробнее",
    tunnel: "Туннель этого компьютера",
    tunnelStates: { healthy: "здоров", degraded: "ослаблен", down: "лежит", inactive: "не активен" },
    points: "Точки Cloudflare, через которые он подключён",
    noPoints: "нет ни одной — Cloudflare не может достучаться до этого компьютера",
    probe: "Живой запрос через интернет",
    answeredHome: "ответил этот компьютер",
    answeredCopy: "ответила копия «хозяин сайта не в сети»",
    checkedAt: "проверено в",
  },
}

export function onlineBarWords(lang: string): OnlineBarWords {
  return lang === "ru" ? DICT.ru : DICT.en
}
