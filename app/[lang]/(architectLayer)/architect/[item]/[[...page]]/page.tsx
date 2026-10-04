import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArchitectPage } from '../../../_lib/architect-page'
import { ARCHITECT_HOME } from '../../../_lib/architect-menu'
import { agiDraftsUi } from '../../../_i18n/agi-drafts.i18n'
import { DraftCards } from '../../../_components/draft-cards'
import { DeleteDraftButton } from '../../../_components/delete-draft-button.client'
import { appDialogUi } from '@/components/dialog/app-dialog.i18n'
import { draftAddress, getDraft } from '@/lib/agi-items/drafts'
import { findTreePage, treeLang } from '@/lib/agi-items/item-tree'
import { getService, serviceUrl } from '@/lib/microservices/registry'
import { BirthButton } from '../../../_components/birth-button.client'
import { birthState } from '@/lib/agi-items/birth'
import { ServicePort } from '@/components/services/service-port.client'
import { servicePortWords } from '@/components/services/service-port.i18n'
import { ElementGithub } from '../../../_components/element-github.client'
import { elementGithubUi } from '../../../_i18n/element-github.i18n'
import { elementDeploymentsUi } from '../../../_i18n/element-deployments.i18n'
import { elementDeployUi, rejectTaskUi } from '../../../_i18n/element-deploy.i18n'
import { ElementDeploy } from '../../../_components/element-deploy.client'
import { ElementRollback } from '../../../_components/element-rollback.client'
import { elementCodeState } from '@/lib/agi-items/element-code-state'
import { elementDir } from '@/lib/agi-items/element-github'
import { elementVersions } from '@/lib/agi-items/element-versions'
import type { Block } from '@/lib/content/blocks/types'
import { ElementDangerZone } from '../../../_components/element-danger-zone'
import { DeleteElementButton } from '../../../_components/delete-element-button.client'
import { elementSettingsUi } from '../../../_i18n/element-settings.i18n'
import { ElementDescribe } from '../../../_components/element-describe.client'
import { ElementAddress } from '../../../_components/element-address.client'
import { ElementDomain } from '../../../_components/element-domain.client'
import { domainRecord } from '@/lib/agi-items/element-domain'
import { readStaticCopy } from '@/lib/agi-items/static-copy-state'
import { readLinks } from '@/lib/agi-items/element-links'
import { ElementLink } from '../../../_components/element-link.client'
import { ElementSiteSettings } from '../../../_components/element-site-settings'
import { addressOf, idOfAddress } from '@/lib/agi-items/element-address'
import { registryDescription, TASK as DESCRIBE_TASK } from '@/lib/agi-items/element-describe'
import { terminalLink } from '@/app/[lang]/(architectLayer)/architect/kits/_agent-kit/core/client/terminal-paste.mjs'
import { agentKitWidget, openAiKeyHref, type AgentKitPage } from '../_agent-kit/widgets'
import { ElementPreview } from '@/components/preview/element-preview.client'
import { elementPreviewWords, previewTaskKit } from '@/sections/blocks/element-preview.server'
import { EnvironmentPanel } from '@/components/environment/environment-panel'

// ОДНА СТРАНИЦА НА ВСЕ АДРЕСА ВСЕХ ЧЕРНОВИКОВ (314-1): `/architect/<id>`, `/architect/<id>/<раздел>`,
// `/architect/<id>/<раздел>/<страница>`. Дерево — `lib/agi-items/item-tree.ts`, черновики — `data/agi-drafts.json`.
//
// 🔒 НИ ОДНОГО НОВОГО ФАЙЛА НА НОВЫЙ ЧЕРНОВИК: адреса отдаются по первому запросу и кэшируются как весь слой (ISR); создание и
// удаление перерисовывают слой дверью. Поэтому группа появляется и исчезает без пересборки.
// 🔒 ПАПКА С ТОЧНЫМ ИМЕНЕМ ВАЖНЕЕ ЭТОЙ (правило Next): `architect/root`, `architect/blocks` и остальные разделы сюда не попадают.
// Черновика нет — 404, а не пустая группа с чужим именем.
// 🔒 В ПОИСК НЕ ИДЁТ: черновик — рабочее место, а не страница продукта.

type Params = { lang: string; item: string; page?: string[] }

// 326-3: страница дерева «Строительство» → вид острова комплекта агента (имя шаблона комплекта).
const AGENT_PAGES: Record<string, AgentKitPage | undefined> = { subscription: 'claude-code', terminal: 'terminal', telegram: 'telegram' }

// 325-3: сегмент пути — адрес элемента в ядре или его id (id неизменен; адрес — слой над ним, `lib/agi-items/element-address.ts`).
function resolve(p: Params) {
  const id = idOfAddress(p.item)
  const draft = id ? getDraft(id) : null
  if (!draft) return null
  const path = p.page ?? []
  if (path.length === 0) return { draft, found: null }
  const found = findTreePage(path)
  return found ? { draft, found } : null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params
  const r = resolve(p)
  const l = treeLang(p.lang)
  const words = r?.found ? (r.found.page ?? r.found.section).words[l] : null
  return {
    title: words ? `${words.title} — ${p.item}` : p.item,
    description: words?.lead,
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const p = await params
  const r = resolve(p)
  if (!r) notFound()

  const { lang } = p
  const item = r.draft.id
  // 325-3: у элемента свой адрес — прежний путь по id (и любой, кроме текущего) переадресует на него с той же страницей.
  const slug = addressOf(item)
  if (p.item !== slug) redirect(`/${lang}${ARCHITECT_HOME}/${[slug, ...(p.page ?? [])].join('/')}`)
  const l = treeLang(lang)
  const ui = agiDraftsUi(lang)
  const address = draftAddress(item)
  const dir = `${ARCHITECT_HOME}/${slug}`

  // 319-3: РОДИВШИЙСЯ ЭЛЕМЕНТ — тот, что уже в реестре узла. У него значок «Элемент», настоящий порт в карточке и нет кнопки
  // «Удалить»: она сняла бы только запись черновика, а работающий элемент остался бы без страницы (дверь тоже отвечает 409).
  const entry = getService(item)
  // Рождение дошло до реестра и упало позже (сборка, память): элемент записан, но его процесса нет — карточка порта не
  // утверждает, что он отвечает, а под карточками стоит отказ с подсказкой повторить установку.
  const birth = birthState(item).state
  const brokenBirth = !!entry && (birth === 'failed' || birth === 'running')
  const port = entry && !brokenBirth && typeof entry.port === 'number' ? entry.port : null
  const bar = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="rounded-md border border-border px-2 py-0.5 text-[length:var(--fs-small)] text-muted-foreground" data-item-badge={entry ? 'element' : 'draft'}>
        {entry ? ui.elementBadge : ui.draftBadge}
      </span>
      {!entry && <DeleteDraftButton lang={lang} id={item} address={address} ui={ui} dialogUi={appDialogUi(lang)} />}
    </div>
  )

  // Главная группы — две карточки, как у корня; у черновика под ними — «Родить элемент».
  if (!r.found) {
    return (
      <ArchitectPage
        lang={lang}
        path={dir}
        title={address}
        pageTitle={address}
        widget={<>
          {/* 338: вводный текст под заголовком — только пока черновик не рождается и не родился (слово владельца 2026-09-29). */}
          {!entry && birth !== 'running' && (
            <div className="mb-6 max-w-3xl space-y-3 text-muted-foreground" data-draft-intro>
              {ui.draftIntro.split('\n\n').map((t) => <p key={t}>{t}</p>)}
            </div>
          )}
          {bar}
          {/* 319-4: родившийся и работающий элемент получает ТОТ ЖЕ блок, что root и службы, — порт по факту и «Адрес в
              интернете» с кнопкой подключения поддомена (289). Черновик и упавшее рождение — свои карточки. */}
          {port !== null
            ? <ServicePort serviceId={item} words={servicePortWords(lang, item)} />
            : <DraftCards address={address} ui={ui} port={port} />}
          {(!entry || brokenBirth) && <BirthButton id={item} ui={ui} dialogUi={appDialogUi(lang)} born={!!entry} />}
        </>}
      />
    )
  }

  const { section, page } = r.found
  const words = (page ?? section).words[l]
  const sectionPath = `${dir}/${section.slug}`
  const path = page ? `${sectionPath}/${page.slug}` : sectionPath

  // Страница раздела перечисляет свои страницы и справа — вместе с третьим уровнем левого меню (320).
  const list = !page && section.pages && section.pages.length > 0 ? (
    <nav aria-label={ui.sectionPages} className="flex flex-col gap-2">
      <p className="text-[length:var(--fs-small)] font-medium text-muted-foreground">{ui.sectionPages}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {section.pages.map((sp) => (
          <li key={sp.slug}>
            <Link
              href={`/${lang}${sectionPath}/${sp.slug}`}
              className="flex flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
            >
              <span className="font-medium text-foreground">{sp.words[l].title}</span>
              <span className="text-[length:var(--fs-small)] text-muted-foreground">{sp.words[l].lead}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  ) : null

  // 319-2: РОДИВШИЙСЯ элемент (он уже в реестре узла) показывает в Preview свой сайт — тот же просмотр, что у служб, с
  // подсветкой и «Найти блок». Черновик, ещё не родившийся, — только заголовок раздела: показывать нечего.
  const preview = section.slug === 'preview' && !page && serviceUrl(item)
    // Терминал рождённого элемента — под `build/` (как у «Описания» ниже); путь служб ядра вёл на ошибку (замерено 356-3).
    ? <ElementPreview serviceId={item} terminalService={`${slug}/build`} devHref={`/${lang}/${slug}/build/deployments`} lang={lang} words={elementPreviewWords(lang)} task={previewTaskKit(item, lang)} />
    : null

  // 326-3: «Подписка Claude Code», «Терминал», «Telegram бот» — острова ОБЩЕЙ копии комплекта агента (`../_agent-kit`, 326-1);
  // Claude Code живёт в папке элемента `AGI-ITEMS/user/<id>`. У черновика — объяснение.
  const kitPage = section.slug === 'build' && page ? AGENT_PAGES[page.slug] : undefined
  const agent = kitPage
    ? (entry ? agentKitWidget(kitPage, item, lang) : <p className="my-4 text-sm text-muted-foreground">{elementSettingsUi(lang).agentNotBorn}</p>)
    : null

  // 319-5: страница GitHub — связь элемента с репозиторием владельца и выгрузка кнопкой; у нерождённого — объяснение.
  const github = section.slug === 'build' && page?.slug === 'github'
    ? (entry
      ? <ElementGithub id={item} lang={lang} ui={elementGithubUi(lang)} />
      : <p className="my-4 text-sm text-muted-foreground">{elementGithubUi(lang).notBorn}</p>)
    : null

  // 336-1: «Переменные окружения» элемента — имена и пояснения из его `.env.example`, ключ OpenAI с проверкой; у черновика — объяснение.
  const environment = section.slug === 'build' && page?.slug === 'environment'
    ? (entry ? <EnvironmentPanel target={item} lang={lang} /> : <p className="my-4 text-sm text-muted-foreground">{elementSettingsUi(lang).notBorn}</p>)
    : null

  // 321: «Развёртывания» — версии элемента стандартной таблицей каталога (`table`: поиск сверху, страницы снизу, 262).
  const isDeployments = section.slug === 'build' && page?.slug === 'deployments'
  const versions = isDeployments && entry ? elementVersions(item) : null
  const dui = elementDeploymentsUi(lang)
  const tables: Block[] = versions
    ? [{
        kind: 'table',
        caption: dui.caption,
        headers: [...dui.headers],
        rows: versions.map((v) => [
          new Date(v.at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }),
          v.hash,
          v.subject,
          [v.running ? dui.running : '', v.exported ? dui.exported : ''].filter(Boolean).join(' · '),
        ]),
      }]
    : []
  // 325: «Настройки» — Danger zone рождённого элемента; у черновика — объяснение.
  const sui = elementSettingsUi(lang)
  // 328: «Настройки» раскрывается — «Опасная зона» (прежняя страница) и «Настройки сайта» (конфигуратор элемента).
  const settings = section.slug === 'settings' && page?.slug === 'danger-zone'
    ? (entry
      ? <ElementDangerZone ui={sui} actions={{
          // 325-2: задание агенту — в окно вставки терминала элемента (`<id>/build/terminal`), отправляет человек.
          describe: <ElementDescribe id={item} lang={lang} ui={sui} current={registryDescription(item)} terminalHref={terminalLink({ lang, service: `${slug}/build`, text: DESCRIBE_TASK })} />,
          // 324-10: «адрес в интернете» — главный адрес элемента (свой домен, если он главный), а не всегда поддомен.
          address: <ElementAddress id={item} lang={lang} ui={sui} current={slug} internet={domainRecord(item)?.url.replace("https://", "") ?? address} />,
          // 324: главное зеркало — второй собственный домен в корне элемента.
          mirror: <ElementDomain id={item} lang={lang} ui={sui} current={domainRecord(item)} />,
          // 324-7: связи с узлом — CONFIG, Дизайн, Блоки.
          config: <ElementLink id={item} kind="config" on={readLinks(item).config} ui={sui} />,
          design: <ElementLink id={item} kind="design" on={readLinks(item).design} ui={sui} />,
          blocks: <ElementLink id={item} kind="blocks" on={readLinks(item).blocks} ui={sui} />,
          remove: <DeleteElementButton lang={lang} id={item} address={address} ui={sui} dialogUi={appDialogUi(lang)} />,
        }} />
      : <p className="my-4 text-sm text-muted-foreground">{sui.notBorn}</p>)
    : null
  const siteSettings = section.slug === 'settings' && page?.slug === 'site-settings'
    ? (entry
      ? <ElementSiteSettings lang={lang} ui={sui} siteUrl={domainRecord(item)?.url ?? `https://${address}`} configOn={readLinks(item).config} />
      : <p className="my-4 text-sm text-muted-foreground">{sui.notBorn}</p>)
    : null

  // 337-3/4: «Развернуть» и «Предпросмотр» — на своей странице элемента, а не только в ядре (слово владельца 2026-09-29).
  const deployPanel = isDeployments && entry ? (
    <ElementDeploy
      id={item}
      lang={lang}
      ui={elementDeployUi(lang)}
      // 356-3: «Отклонить» спрашивает причину (текст или голос) — окно задачи 336 в режиме «заметка».
      // Терминал рождённого элемента — `<адрес>/build/terminal`, а не путь служб ядра (`terminalLink`): замерено 356-3, тот вёл на ошибку.
      reject={{ ui: rejectTaskUi(lang), dialogUi: appDialogUi(lang), keyHref: openAiKeyHref(item, lang), terminalPath: `/${lang}/architect/${slug}/build/terminal` }}
    />
  ) : null
  // 344-3: итог последней выкладки копии публичных страниц в Cloudflare (`data/services/<id>/static-copy.json`); нет своего
  // домена или выкладок не было — строки нет.
  const copy = isDeployments && entry ? readStaticCopy(item) : null
  const copyReason = copy && !copy.ok
    ? (/403|10000|Authentication|access/i.test(copy.detail ?? '') ? dui.copyNoWorkers : `${copy.reason ?? ''} ${copy.detail ?? ''}`.trim())
    : ''
  const copyNote = copy && !copy.removed
    ? (
      <p className="my-2 text-sm text-muted-foreground" data-static-copy={copy.ok ? 'ok' : 'failed'}>
        {(copy.ok ? dui.copyOk : dui.copyFailed)
          .replace('{time}', new Date(copy.at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }))
          .replace('{files}', String(copy.files ?? ''))
          .replace('{host}', copy.host ?? '')
          .replace('{reason}', copyReason)}
      </p>
    )
    : null

  // 322 (владелец 2026-10-04: «откат новым коммитом», «Сохранить и откатить»): вместо неактивной кнопки 321 — выбор версии из тех же
  // строк, что таблица, и откат по подтверждению. Число несохранённых файлов называется в подтверждении заранее.
  const rollbackDir = isDeployments && entry ? elementDir(item) : null
  const deploymentsNote = isDeployments
    ? (entry && versions
      ? (
        <ElementRollback
          id={item}
          ui={dui}
          dirty={rollbackDir ? elementCodeState(rollbackDir)?.changed ?? 0 : 0}
          versions={versions.map((v) => ({ hash: v.hash, label: `${v.hash} · ${new Date(v.at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })} · ${v.subject.slice(0, 70)}` }))}
        />
      )
      : <p className="my-4 text-sm text-muted-foreground">{dui.notBorn}</p>)
    : null

  return (
    <ArchitectPage
      lang={lang}
      path={path}
      title={words.title}
      lead={words.lead}
      pageTitle={address}
      widget={<>{bar}{list}{preview}{github}{deployPanel}{copyNote}{deploymentsNote}{environment}{settings}{siteSettings}{agent}</>}
      children={tables}
    />
  )
}
