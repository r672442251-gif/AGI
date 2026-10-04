import {
  AppWindow, Blocks, Bot, Box, Clock, Database, LayoutDashboard, FlaskConical, Hammer, House, IdCard, KeyRound, LayoutTemplate, Package, Palette,
  Plus, Server, Settings, SlidersHorizontal, Store, ToggleRight, Wrench,
} from 'lucide-react'

// ЗНАЧКИ ЛЕВОГО МЕНЮ (шаг 288-2). Слово владельца 2026-09-24: «Слева от кнопок нужно нарисовать иконке … для корня
// авторизации и данных будет иконка глобус символизирующая интернет все остальные иконки расставь на своё усмотрение».
// Значок раздела — поле `icon` в его `_data/meta.ts` (одно место); здесь только словарь «имя → значок». Глобус — у
// служб, живущих в интернете (сайт, вход, данные); новая служба узла получает его же.
// 🪦 Глобус отменён владельцем 2026-09-26 (шаг 311): «Убери глобус вообще и перерисуй чтобы каждой вкладке соответствовала
// своя иконка». Значка `globe` в словаре нет намеренно: имя, которого здесь нет, не рисует ничего.
const ICONS = {
  home: House,
  key: KeyRound,
  database: Database,
  sliders: SlidersHorizontal,
  settings: Settings,
  toggle: ToggleRight,
  blocks: Blocks,
  hammer: Hammer,
  clock: Clock,
  palette: Palette,
  server: Server,
  package: Package,
  layout: LayoutTemplate,
  store: Store,
  passport: IdCard,
  flask: FlaskConical,
  wrench: Wrench,
  window: AppWindow,
  // 314-1: черновик элемента узла и кнопка «Создать микросервис».
  box: Box,
  plus: Plus,
  // 339-1: группа «Dashboard» после «Паспорта».
  dashboard: LayoutDashboard,
  // 388 (владелец 2026-10-04: «кнопку ядро заменим на главный агент и поставим аватарку робота»).
  bot: Bot,
} as const

export type MenuIconName = keyof typeof ICONS
export const MENU_ICON_NAMES = Object.keys(ICONS) as MenuIconName[]

export function MenuIcon({ name }: { name?: string }) {
  const Icon = name ? ICONS[name as MenuIconName] : undefined
  return Icon ? <Icon size={16} aria-hidden className="shrink-0" /> : null
}
