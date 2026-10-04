import type { SectionRenderer } from '@/sections/contract'
import { ElementPreview, type ElementPreviewWords, type PreviewTaskKit } from '@/components/preview/element-preview.client'
import { blockTaskUi } from '@/_tools/block-task/types/block-task.i18n'
import { appDialogUi } from '@/components/dialog/app-dialog.i18n'
import { agentTerminalWords } from '@/app/[lang]/(architectLayer)/architect/kits/_agent-kit/core/words/agent-terminal.i18n'
import { openAiKeyHref } from '@/app/[lang]/(architectLayer)/architect/kits/_agent-kit/core/widgets'

// ПРОСМОТР ЭЛЕМЕНТА (страницы Preview разделов Root, «Вход», «Данные» — слово владельца 2026-09-24).
const WORDS: Record<string, ElementPreviewWords> = {
  en: {
    loading: 'Asking the node where this element answers…',
    unavailable: 'The node did not answer, so the preview is not shown.',
    blockedHttps: 'Preview works only in the panel opened on this computer: it shows the element as it runs here right now, at this computer’s own address, and a browser does not let a page opened over the internet load such an address. Open the panel on this computer.',
    openNew: 'Open in a new tab',
    openDev: 'Development — this computer',
    openProd: 'Production — on the internet',
    openProdNone: 'Production appears once your own domain is connected',
    openHere: 'Open on this computer',
    reload: 'Reload',
    reloading: 'Asking the element to redraw its pages…',
    reloaded: 'The element redrew its pages — the preview shows the current version.',
    reloadUnconfirmed: 'The element did not confirm the redraw (it may not have this door yet) — the preview was reloaded; a text change still appears within five minutes.',
    highlight: 'Highlight',
    highlightOn: 'Highlight is on: point at a block of the page — a frame shows its address; «Click to update» opens a task window for it.',
    highlightNoAnswer: 'The element did not answer: it cannot highlight blocks yet (elements built from the item template can).',
    picked: 'Selected block',
    copy: 'Copy',
    copied: 'Copied',
    toTerminal: 'To the terminal',
    findPlaceholder: 'Paste a block link, e.g. /en/privacy#block=kns6w',
    find: 'Find',
    findHelp: "Paste the link the element's agent gave you after editing a block (or the «Link» line of a copied address) and press Find: the preview opens that page, scrolls to the block and frames it for 3 seconds.",
    findSearching: 'Opening the page and looking for the block…',
    findNotFound: 'This page has no block with that address — check the link or ask the agent for a new one.',
    findNoAnswer: 'The element did not answer: it cannot find blocks yet (elements built from the item template can).',
    findBadLink: 'This is not a block link: it must end with #block=<address>, e.g. /en/privacy#block=kns6w.',
    findForeign: 'This link points to another element: open that element\'s Preview and paste it there.',
    drawerTitle: 'Terminal of this element',
    drawerHint: 'Start the terminal and press «Paste» — the task is already in the window. It is the same terminal as in the left menu.',
    drawerCollapse: 'Collapse',
  },
  ru: {
    loading: 'Спрашиваю узел, где отвечает этот элемент…',
    unavailable: 'Узел не ответил, поэтому просмотр не показан.',
    blockedHttps: 'Preview работает только в пульте, открытом на этом компьютере: он показывает элемент таким, каким тот работает здесь прямо сейчас, по адресу этого компьютера, а браузер не даёт странице, открытой через интернет, загрузить такой адрес. Откройте пульт на этом компьютере.',
    openNew: 'Открыть в новой вкладке',
    openDev: 'Режим разработки — этот компьютер',
    openProd: 'Продакшн — в интернете',
    openProdNone: 'Продакшн появится после подключения своего домена',
    openHere: 'Открыть на этом компьютере',
    reload: 'Обновить',
    reloading: 'Прошу элемент перерисовать страницы…',
    reloaded: 'Элемент перерисовал страницы — в просмотре текущая версия.',
    reloadUnconfirmed: 'Элемент не подтвердил перерисовку (возможно, у него ещё нет этой двери) — просмотр перезапущен; правка текста всё равно появится не позже чем через пять минут.',
    highlight: 'Подсветка',
    highlightOn: 'Подсветка включена: наведите на блок страницы — рамка покажет его адрес; «Нажми для обновления» откроет окно задачи.',
    highlightNoAnswer: 'Элемент не ответил: он ещё не умеет подсвечивать блоки (умеют элементы, собранные из шаблона элемента).',
    picked: 'Выбранный блок',
    copy: 'Скопировать',
    copied: 'Скопировано',
    toTerminal: 'В терминал',
    findPlaceholder: 'Вставьте ссылку на блок, например /ru/privacy#block=kns6w',
    find: 'Найти',
    findHelp: 'Вставьте ссылку, которую агент элемента дал после правки блока (или строку «Ссылка» из скопированного адреса), и нажмите «Найти»: просмотр откроет эту страницу, прокрутит к блоку и обведёт его на 3 секунды.',
    findSearching: 'Открываю страницу и ищу блок…',
    findNotFound: 'На этой странице нет блока с таким адресом — проверьте ссылку или попросите у агента новую.',
    findNoAnswer: 'Элемент не ответил: он ещё не умеет находить блоки (умеют элементы, собранные из шаблона элемента).',
    findBadLink: 'Это не ссылка на блок: в конце должно стоять #block=<адрес>, например /ru/privacy#block=kns6w.',
    findForeign: 'Ссылка ведёт на другой элемент: откройте Preview того элемента и вставьте её там.',
    drawerTitle: 'Терминал этого элемента',
    drawerHint: 'Запустите терминал и нажмите «Вставить» — задача уже в окне. Это тот же терминал, что в левом меню.',
    drawerCollapse: 'Свернуть',
  },
}

/** Слова просмотра — одни на все места, где он стоит (разделы служб и рождённые элементы, 319-2). */
export const elementPreviewWords = (lang: string): ElementPreviewWords => WORDS[lang] ?? WORDS.en

/** 336: окно задачи блока и ящик терминала — слова и поле ключа OpenAI этой службы. */
export const previewTaskKit = (serviceId: string, lang: string): PreviewTaskKit => ({
  ui: blockTaskUi(lang),
  dialogUi: appDialogUi(lang),
  terminalWords: agentTerminalWords(lang),
  keyHref: openAiKeyHref(serviceId, lang),
})

export const elementPreview: SectionRenderer<'elementPreview'> = (b, { key: k }) => (
  <ElementPreview key={k} serviceId={b.serviceId} lang={b.lang} words={elementPreviewWords(b.lang)} task={previewTaskKit(b.serviceId, b.lang)} />
)
