# Agent kit — Claude Code, terminal and Telegram bot for one microservice

Read this whole file before installing, updating or removing the kit. It is written for an agent.
This folder is the **master**: the only source of the kit. Services get full copies of it.

## What the kit gives a service

| Page | Address | What it does |
|---|---|---|
| Claude Code subscription | `/{lang}/architect/<service>/claude-code` | sign-in state of `claude` on this machine and sign-in in place. **One per computer**: every service shows the same state |
| Terminal | `/{lang}/architect/<service>/terminal` | a live Claude Code in `AGI-ITEMS/<kind>/<service>/`. **Started and stopped by this island only** — the page, or the same island in the Preview drawer (336: `initialPaste` puts a task into the paste window, `keyHref` points voice to the OpenAI key field; the paste window is the tool `_tools/terminal-paste`) |
| Telegram bot | `/{lang}/architect/<service>/telegram` | BotFather → token → admission by link → a state card. No start or stop buttons here |

**One service = one Claude Code session = one Telegram bot.** When the service bot is connected, the
terminal starts `claude --channels plugin:telegram@claude-plugins-official`, so everything written in
Telegram shows in the terminal, and the person can continue in the terminal without Telegram.
While the terminal is off, the node itself reads the bot and answers with a status message and links
(no subscription → sign in first; terminal inactive → open the terminal).

## Where it lives

```
architect/kits/_agent-kit/           MASTER — never edit a service copy by hand; edit here, then update
  core/                              everything that is copied into a service as _agent-kit/
    server/  bridge.cjs session.cjs ticket.cjs workspace.cjs claude-cli.cjs telegram.cjs entry.cjs
    client/  the three islands + xterm, mouse filter, auth-link extraction
    words/   words of the three screens (en, ru) — not `i18n/`: the lang-delivery guard reads that folder name as a dictionary shipped to the browser
    widgets.tsx   agentKitWidget(page, service, lang) — the one entry for pages
  pages/     claude-code/ terminal/ telegram/   templates (*.tpl, __SERVICE__)
  api/       session/ ticket/ claude-auth/ channel/   door templates (route.ts.tpl)
  kit.json   the card: the «Ready-made kits» tab is built from these cards
  install.mjs · README.md

architect/<group>/                   A COPY, owned by the group
  agent-kit.json                     install parameters: service id, workspace (agi-item | node),
                                     master fingerprint, page names and order. Written by the installer,
                                     read by workspace.cjs and by check.mjs — there is no second list
  _agent-kit/                        copy of core/
  claude-code/ terminal/ telegram/   the three pages; each passes its island as `widget`
                                     (named otherwise when installed with --page)
  agent-api/{session,ticket,claude-auth,channel}/route.ts   doors: /{lang}/architect/<service>/agent-api/*

lib/agent-kit/mount.cjs              node level: finds architect/*/_agent-kit/server/entry.cjs by walking
                                     the folders AT START; serves the socket /pty/<service>, starts the pollers
lib/agent-kit/check.mjs              guard `npm run check:agent-kits` (in prebuild)
server.js                            one line: mountAgentKits(server, app)
data/services/<service>/channel/telegram/   runtime data: token (.env), access.json, bot.json — outside git
```

**Delete test — the reason for this layout:** delete `architect/<service>/`, rebuild and restart — the
build is green and nothing about that service remains in the code; the mount does not find it any more.
Delete the master — installed services keep working; only the showcase and the installer are gone.
The data folder stays on purpose (it holds a secret); remove it by hand if the service is gone for good.

Why two files live outside the routes: the HTTP `upgrade` event and the poll timers exist once per Node
process, while there are as many kit copies as services. The mount knows no service by name.

## Before installing — check all of these

1. The service is in `AGI-ITEMS-REGISTRY/agi-items.json` (`"id": "<service>"`, `"kind": "core"|"user"`) and
   the folder `AGI-ITEMS/<kind>/<service>/` exists. The agent is born in that folder — **the folder is the agent's identity** (`CLAUDE.md`,
   settings and tools are read from there).
   **The node's own agent skips this check entirely:** install it with `--node`, and the agent is born in
   the node root, because its subject is the node's own code. What such an agent may see inside that root
   is the node's business, not the kit's: `.claude/settings.json` of the node denies `AGI-ITEMS/**` so the
   node agent does not reach into the services. That is a rule of Claude Code, not an OS sandbox.
2. The service has its own page group `architect/<service>/` (`_data/index.ts`). The installer puts the
   kit INTO it and refuses to invent a group.
3. On the machine: Claude Code (`claude` in PATH or `~/.local/bin`), Bun (`~/.bun/bin`), and the plugin
   `telegram@claude-plugins-official` (`claude plugin install telegram@claude-plugins-official`). The
   plugin's own dependencies are installed by the kit before the first start — do not rely on the
   plugin doing it: its first `bun install` does not fit into Claude Code's 30-second MCP timeout.
4. `node-pty` and `ws` are dependencies of the node (`package.json`); `node-pty` loads
   (`npm rebuild node-pty` if not). On Linux it needs python3, make and g++.
5. Shared node pieces the copy imports and does not own: `@/components/ui/*`, `AppDialog`,
   `@/components/auth/setup-ladder.client`, `@/lib/auth/*` (roles, temporary-address lock).

## Install, reinstall, update

```
npm run agent-kit:add -- <group>                          install into a service
npm run agent-kit:add -- <group> --node                   install for the node itself (agent in the node root)
npm run agent-kit:add -- [item] --born                    ONE shared copy for every born AGI element (see below)
npm run agent-kit:add -- <group> --page <tpl>=<name>[:<order>]   name a page your own way (repeatable)
npm run agent-kit:add -- <group> --force                  reinstall over an existing copy
npm run agent-kit:update -- <group>                       copy the current master into an installed group
npm run serve:rebuild                                     after any of them
```

`--page` takes a template name (`claude-code`, `terminal`, `telegram`) and gives it the slug and the menu
order it will have in this group — this is how the node's Build tab carries `subscription`, `terminal`,
`telegram`. The template name never changes: it also selects the island in `core/widgets.tsx`.

`agent-kit:update` repeats the **previous** install, reading `agent-kit.json`; it does not fall back to
the defaults. Otherwise an update of the master would silently rename the node's pages back and break
addresses that were already handed out.

The installer removes the previous copy whole first — a file deleted from the master, and a page renamed
by this install, must not survive an update. It refuses a service that is not registered, has no folder
or no page group; with `--node` the registry is not consulted at all.

`npm run check:agent-kits` has three verdicts: **ok** · **debt** (the copy lags behind the master —
printed every run, does not fail the build) · **error** (a torn copy: pages or doors missing, doors
without `_agent-kit/`, no `agent-kit.json`, or the copy edited by hand so it no longer matches the
fingerprint in its own manifest). The page names it checks come from the manifest, never from a list
of its own.

## Verify — two planes, one negative control

1. `/{lang}/architect/<service>/terminal` answers 200; `GET /{lang}/architect/<service>/agent-api/session`
   answers `{ running: false }` for an architect.
2. Press «Start the agent»: the door answers `running: true`; if the bot is connected, `channel: true`,
   and a `bun` process exists (the plugin server). The terminal screen says
   «messages from plugin:telegram… inject directly in this session». Stop → `running: false`, `bun` gone.
3. Negative control: a second service started at the same time has its own `pid` and folder, and
   stopping one does not touch the other.

## Born AGI elements — one shared copy (node step 326)

A born element (registry `kind: user` + `born`, step 319) has no page group of its own: all its pages are ONE dynamic page
`architect/[item]/[[...page]]`. A usual install would create `architect/<id>/`, and a folder with an exact name beats the
dynamic page — the element's other pages would stop opening, and every birth would need a core rebuild. So born elements share
one copy:

- `npm run agent-kit:add -- [item] --born` → `architect/[item]/_agent-kit/` + `architect/[item]/agent-api/*`, manifest
  `workspace: born-items`, no pages (the element tree draws `build/subscription|terminal|telegram` with `agentKitWidget`).
- The doors carry the mark `__BORN__` instead of a service name and take the element from the ADDRESS (`params.item`);
  `isBornItem(id)` (`core/server/workspace.cjs`) lets only born elements through — built-in services get 404 here.
- `lib/agent-kit/mount.cjs` serves `/pty/<id>` with this copy for any id that is born AT CONNECTION TIME — an element born
  after the node started gets its terminal without a restart. Bots of born elements are polled from start, or from the moment
  a person saves the bot token (channel door).
- Update after a master change: `npm run agent-kit:update -- [item]` (the group name alone selects born mode).

Proven (326): `/ru/as8kp/agent-api/session` → `running:false`, `agentDir` = `AGI-ITEMS/user/as8kp`; start → `running:true`,
`cwd` = that folder; `as8kp` and `dso94` at once — different pids, stopping one leaves the other; `/pty/nope` and a draft — refused.

## First run in a new service

Claude Code asks «Is this a project you trust?» and «No, exit» is the default. Answer **«Yes, I trust this
folder»** in that service's terminal (↓ then Enter). Nobody can answer it from Telegram.

## Laws — each one was paid for

- **Start and stop only on the Terminal page.** The Telegram page shows state only.
- **`--permission-mode auto` is required** with the channel: a permission prompt would go to the very
  channel that is waiting for an answer, and the session would hang.
- **`--add-dir <state folder>` is required**: without it Claude Code asks a path-policy question that the
  channel plugin does not forward — a silent hang while everything says `online`.
- **One poller per bot.** Telegram gives each update to one reader; each copy polls only its own bot, and
  only while its terminal is off.
- **Strip inherited Claude Code session markers** (`CLAUDECODE`, `CLAUDE_CODE_*`) from the child
  environment: with them `claude` believes it is nested and does not start plugin servers.
- **The service comes from the ADDRESS** (`/pty/<service>`, the door's own folder), never from a message
  the browser sends.
- **The token never leaves the machine**: doors return its last four characters only.
- **Every child process from a background service gets `windowsHide: true`.**
- **A node restart or rebuild ends the sessions** — the agent is started again by a person.
- Telegram channels are an Anthropic research preview: flags may change.

## When the bot is silent

| Check | Meaning |
|---|---|
| `getWebhookInfo` → `pending_update_count` grows | nobody reads the bot: the node did not find the copy (restart it), or the plugin server did not start |
| no `bun` process while the terminal says channel on | plugin dependencies missing or MCP timeout — see «Before installing» №3 |
| the terminal screen shows a question | a modal prompt — answer it in the terminal |
| the status message says «not signed in» | sign in on the Claude Code subscription page |
| the node log says `копия службы «…» не загрузилась` | a broken copy — `npm run check:agent-kits`, then `agent-kit:update` |

## Remove from a service

Delete `architect/<service>/_agent-kit/`, `architect/<service>/agent-api/` and the three pages, then
`npm run serve:rebuild`. The mount forgets the service by itself. Delete
`data/services/<service>/channel/telegram/` by hand only if the bot must be forgotten too.
