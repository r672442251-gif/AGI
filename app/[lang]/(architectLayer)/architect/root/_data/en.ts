import type { WorkspacePageWords } from '@/lib/collection/types'

// Words of the page «Root». This file is the BASE language.
//
// «Root», not «Site»: the owner's word of 2026-09-23 — some builders make sites here,
// others make plain automations. The element's id is `root` as well.

export const en: WorkspacePageWords = {
  title: 'Root',
  lead: 'What a visitor sees at the root of your domain: its own element, its own port, its own agent.',
  topics: [
    {
      anchor: 'what',
      tab: 'What it is',
      title: 'The root of the domain is a replaceable element',
      text:
        'The site lives next to sign-in and data, not inside the core. It keeps its own settings and keeps working if the core stops; the core reaches in to adjust them.',
      points: [
        'Its own repository and a pinned version in AGI-ITEMS-REGISTRY/agi-items.json.',
        'Its own port, assigned by the node, and its own agent in the terminal of this section.',
        'Replace it with another repository by changing one line — see «External GitHub».',
      ],
    },
  ],
}
