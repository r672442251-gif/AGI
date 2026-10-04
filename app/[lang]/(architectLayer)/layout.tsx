import { AccessGate } from "@/components/auth/access-gate.client"
import { coreShellWhere } from "@/lib/shell/core-shell-where"
import { ARCHITECT_LAYER_ROLES } from "@/lib/roles"
import { accessGateUi } from "@/components/auth/access-gate.i18n"
import { appDialogUi } from "@/components/dialog/app-dialog.i18n"
import { OriginNotice } from "@/components/node-state/origin-notice.client"
import { originNoticeWords } from "@/components/node-state/origin-notice.i18n"
import { TemporaryAddressAlarm } from "@/components/node-state/temporary-address-alarm.client"
import { temporaryAddressAlarmWords } from "@/components/node-state/temporary-address-alarm.i18n"
import { LocalTabMark } from "@/components/node-state/local-tab-mark.client"
import { OnlineBar } from "@/components/node-state/online-bar.client"
import { onlineBarWords } from "@/components/node-state/online-bar.i18n"
import { GithubTokenAlarm } from "@/components/node-state/github-token-alarm.client"
import { githubTokenAlarmWords } from "@/components/node-state/github-token-alarm.i18n"

// Дверь СЛОЯ АРХИТЕКТОРА (шаг 31-1, 2026-08-28).
//
// 🔒 СЛОЙ ВЕРНУЛСЯ КАРКАСОМ, БЕЗ СТРАНИЦ (230-4, 2026-09-18, слово владельца:
// «мне этот слой очень нужен для нашей будущей работы мне там сейчас страницы
// никакие не нужны но архитектурно он должен быть там как минимум с
// мультиязычной структурой и одним вложенным layer»). Шагом 229-5 слой был
// удалён целиком вместе со страницами — это оказалось шире, чем требовалось.
// Дверь, замок и роль вернулись нетронутыми; страниц нет ни одной, и папка
// architect/ ждёт первую.
//
// 🔒 ЗАЧЕМ ПЯТАЯ ГРУППА, ЕСЛИ ЕСТЬ `(protectedLayer)/(admin)`. Решение владельца
// 2026-08-28: настройки проекта переезжают из административной панели внутрь
// самого проекта, «в подвал сайта по 3000», и живут в собственной группе
// маршрутов. Разница содержательная, а не организационная: подгруппы защищённого
// слоя показывают ДАННЫЕ приложения — свои, чужие, деньги, содержимое. Этот слой
// не показывает данные вовсе, он правит САМ ПРОЕКТ: имя, адреса, мету, вид.
// Втиснуть его в `(admin)` значило бы отдать настройки проекта роли `admin`,
// которая администрирует содержимое, а не развёртывание.
//
// Форма двери намеренно та же, что у четырёх соседей: увидев один такой макет,
// агент понимает устройство любого слоя, даже не открыв README.
//
// 🔒 РОЛИ НЕ ПЕРЕЧИСЛЕНЫ ЗДЕСЬ — они в `lib/roles.ts`, в единственном месте,
// откуда их читают и замок, и диалог отказа. Список ролей, набранный в макете
// руками, разойдётся с законом, и разойдётся молча.
//
// 🔒 МАКЕТ НЕ ЧИТАЕТ СЕССИЮ: `auth()`/`cookies()`/`headers()` здесь сделали бы
// динамическим весь слой одной строкой. Спрашивает островок, после гидратации;
// настоящая проверка — в дверях `/api/*`, которые отдают и принимают данные.
export default async function Layout(
  { children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> },
) {
  const { lang } = await params
  // 294: «На главную» замка — корень ПРОЕКТА (сайт): главная ядра сама под этим замком, и кнопка крутила цикл.
  const site = coreShellWhere().siteUrl
  return (
    <AccessGate
      homeHref={site ? `${site}/${lang}` : undefined}
      roles={ARCHITECT_LAYER_ROLES}
      lang={lang}
      ui={accessGateUi(lang)}
      dialogUi={appDialogUi(lang)}
    >
      {/* 🪦 Полоса терминалов 345 снята 2026-10-01 (владелец, шаг 356-1): терминалы и ждущие развёртывания — в ящике «Мой аккаунт». */}
      {/* 368: форк узла отстал от оригинала — уведомление без запрета. */}
      {/* 371-1: проект на временном адресе Cloudflare — тревога, не сворачивается (слово владельца 2026-10-02). */}
      {/* 372: на этом компьютере вкладка — зелёный значок и «Этот компьютер ·» (373; было «Dev mode ·»). */}
      {/* 374-9: ключа GitHub нет — работа живёт только на этом компьютере; тревога и кнопка к ключу (слово владельца 2026-10-02). */}
      <LocalTabMark />
      {/* 386-2: на этом компьютере — полоса «в сети / не в сети» над шапкой и «Спросить у Cloudflare» (владелец 2026-10-04). */}
      <OnlineBar words={onlineBarWords(lang)} lang={lang} />
      <TemporaryAddressAlarm words={temporaryAddressAlarmWords(lang)} lang={lang} />
      <OriginNotice words={originNoticeWords(lang)} />
      <GithubTokenAlarm words={githubTokenAlarmWords(lang)} lang={lang} />
      {children}
    </AccessGate>
  )
}
