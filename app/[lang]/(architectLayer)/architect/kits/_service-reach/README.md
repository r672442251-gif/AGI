# Service address — port, mode and internet address with a check

Read this whole file before embedding, changing or removing it. Written for an agent; the card (`kit.json`) is for a
person on the «Ready-made kits» tab.

## What it gives

The main tab of a service in the core says where the service lives — the owner's word (2026-09-24, after
`data.throughsongs.com` gave `NXDOMAIN`): «what would a user do … where would he intuitively look … a check-connection
button is needed here». The section shows:

- the port on this machine (`/api/services`, step 264);
- the mode: the node has its own Cloudflare tunnel (`logs/domain.json`) — «served through Cloudflare»; otherwise
  «this machine only» with `http://localhost:<port>`;
- the address (`<id>.<zone>`, the site — the zone itself) as a link, and its state: answers / name not connected
  (no DNS record, no tunnel route) / connected but not answering (code);
- «Check connection» (measure again) and, when something is missing, «Connect».

## Where it lives

```
components/services/service-port.client.tsx    the block `servicePort` (port) — renders the section below
components/services/service-reach.client.tsx   the section: mode, address, state, buttons
components/services/service-port.i18n.ts       words (en, ru), the service name is put in by id
app/api/node/reach/route.ts                    GET measure · POST connect (architect / admin)
lib/domain/cloudflare.ts                       getIngress, hasDnsRecord, setIngress, upsertTunnelRecord
```

## Embed (one line in the service group's `_components/index.ts`)

```ts
import { servicePortWords } from '@/components/services/service-port.i18n'
export function content(lang: string): Block[] {
  return [{ kind: 'servicePort', serviceId: 'data', words: servicePortWords(lang, 'data') }]
}
```

The service must be in `AGI-ITEMS-REGISTRY/agi-items.json` (the door refuses an unknown id). A new service's name for the
first line («Your data service lives on port …») goes into `NAMES` in the words file; without it — «This service».

## What «Connect» does — and what it must never do

- Reads the tunnel's rules, adds `{ hostname: <id>.<zone>, service: http://127.0.0.1:<port> }` only if the name is
  absent, writes the list back (PUT replaces it as a whole — a write without reading would wipe the site, sign-in and
  core). Then adds the proxied CNAME to the tunnel if the zone has no record with that name.
- 🛑 **Publishing a name publishes EVERYTHING the service answers.** A service decides itself what the internet may
  see: the data service answers only its page to requests that came through Cloudflare (`cf-ray`), its data doors are
  404 even with the key (data v1.3.2). Before connecting a new service, make that decision in the service.
- Never edits or deletes an existing DNS record; a record with that name (any type) is left as is.

## Extend

- Another mode (a node on a rented server with DNS at the registrar) — `measure()` in the door: a new `mode` plus words.
- A service with a different name rule — `hostnameFor()` in the door, one place.

## What it does not do

Does not remove a name (no «disconnect»); does not check the certificate; the owner's domain activation (tunnel, zone)
must exist — otherwise the mode is «this machine only».

## Proven (289)

Live: see `development-docs/development-steps/completed-steps/289-*.md`.
