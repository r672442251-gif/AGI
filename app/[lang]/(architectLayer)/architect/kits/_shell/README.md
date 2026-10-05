# Project shell — the site's header and footer in every service

Read this whole file before installing, wiring, changing or removing the shell. It is written for an agent.
The card on the «Ready-made kits» tab (`kit.json`) is for a person; this file is for the one who builds.

## What it gives a service

The **same** header and footer as the site — not a look-alike. The owner's word (2026-09-24): «if we say we reuse
one and the same component everywhere, why do the root and the core have the right header and footer … the header
has the sign-in button and the footer has the series of buttons: languages, screen width, theme and socials».

- header: project name (links to the project root from any surface), the project menu with two levels and the
  reserved inert buttons, sign-in / account drawer, mobile menu;
- footer: footer pages when the architect switched them on (public pages — the law applies as to any site), the
  name linking to the project root, address, socials, width, theme, language;
- theme, width and language are the visitor's choice for the **whole project**: a cookie on the project domain
  (`.<zone>`; without a domain a host-only cookie, which every port of the machine shares). Switched on any page —
  switched on all. A choice made before 285 in one address is lifted into that cookie on first read.

## Where it lives

```
<site>/components/shell/              THE SOURCE — the site element (fractera-root-starter), never a copy
  project-header.tsx project-footer.tsx     the view; reads NO config, draws a ShellData object
  shell-menu / shell-account / shell-toggles / language-switcher (.client)   the islands
  theme-provider.client.tsx shared-prefs.ts safe-storage.ts               theme and the shared choice
  shell-types.ts shell-href.ts shell-me.client.ts socials.tsx temporary-host.ts
  remote-shell.ts                     services: load ShellData from the site's door at build
<site>/lib/shell/site-shell-data.ts   the site builds ShellData from its own settings
<site>/app/api/shell/[lang]/route.ts  static door: the same ShellData for every service
architect/kits/_shell/                this card, install.mjs, this README
scripts/check-shell-kits.mjs          guard (in the core's prebuild)
lib/shell/core-shell-where.ts         the core knows the site's addresses itself (registry + domain)
```

## Install

```
npm run shell-kit:add -- <service source folder>
npm run shell-kit:add -- <service source folder> --from <site folder>
```

It replaces `components/shell/` of the service with the site's, copies the shadcn primitives it needs
(`button`, `sheet`, `separator`, `badge`, `dropdown-menu`, `lib/utils`) **only when the service has none**, and adds
missing dependencies (`radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`) to its
`package.json` — then run `npm install` in the service. 🔒 Into the service's **source** (repository or fork), never
into `AGI-ITEMS/<kind>/<id>/`; then commit, tag, bump the version in `AGI-ITEMS-REGISTRY/agi-items.json`, deploy.

**Environment** — declare in the service's `.env.example` with `# kind: derived`; the node installer answers:

| Variable | Value |
|---|---|
| `PROJECT_SHELL_URL` | the site's loopback + `/api/shell` (the shell adds `/<lang>`) |
| `PROJECT_SITE_URL` | the site's public address on the own domain, otherwise its loopback |

## Wire it (Next, root layout with the language in the address)

```tsx
import { ThemeProvider } from "@/components/shell/theme-provider.client"
import { ProjectHeader } from "@/components/shell/project-header"
import { ProjectFooter } from "@/components/shell/project-footer"
import { loadProjectShell } from "@/components/shell/remote-shell"

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const shell = await loadProjectShell(lang)
  // The sign-in service passes its own doors; the site and the core use the defaults (/api/me, /login, /logout).
  const surface = { meUrl: "/api/session", loginHref: () => "/login", logoutHref: () => "/logout", languages: ["en", "ru"] }
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {shell && <ProjectHeader data={shell} surface={surface} />}
        <main className="flex-1">{children}</main>
        {shell && <ProjectFooter data={shell} surface={surface} />}
      </div>
    </ThemeProvider>
  )
}
```

Put the theme and width scripts before paint in `<head>` (the site's `components/theme-init.tsx` and
`app-width-init.tsx` read the shared cookie through `READ_PREF_JS` from `shared-prefs.ts`), otherwise the page
flashes the default theme before the island applies the choice.

## When it changes

| Change | Reaches the site | Reaches the core and services |
|---|---|---|
| menu, footer pages, socials, switches in the site's settings | site deployment | site deployment, then the service's (read at its build) |
| the view (`components/shell/` of the site) | site release | `shell-kit:add`, commit, tag, deploy — the guard shows the debt until then |
| a visitor switches theme / width / language | at once, on every open page after reload | the same cookie |

## Extend it

- **Another button or group** — not here: the site's settings (`APP-CONFIG nav`, the constructor of step 282).
- **Another field** (a badge, a banner) — one change in three places: `ShellData` in `shell-types.ts` →
  `siteShellData` fills it → the view draws it. Release the site, then `shell-kit:add` into the core and services.
- **A surface-only door** (a service with its own sign-in pages) — `ShellSurface`, never `ShellData`.
- **Look** — edit `components/shell/` IN THE SITE, never a copy; keep it on the design tokens.
- **A non-Next service (Express)** — cannot run the islands; open question of step 285-4.

## What it does not do

No drawers left/right (site-only, passed as `leftSlot` / `rightSlot`); no cookie banner (the site's own); the
default theme of a first visit still comes from each surface's `NEXT_PUBLIC_DEFAULT_THEME`.

## Remove it

Delete `components/shell/`, its imports in the layout and the two env lines. The guard stops checking a service
that has no `components/shell/`.

## Replaced

🪦 `_header` and `_footer` (283-2, 283-3) — a hand-written simplified look-alike without sign-in and switchers; the
owner found it on `auth.` (2026-09-24). Removed by 285-3; their masters `kits/header`, `kits/footer` too.
