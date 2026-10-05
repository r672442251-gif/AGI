# `AGI-ITEMS-REGISTRY/` — the registry of this node's items

`agi-items.json` says **which AGI items this node is made of and at which exact version**. It is the
entity «knows everything about everyone» of the node laws; an item's own passport
(`OWN-SERVICE-PROPS.json` in its repository) is the entity «knows only itself». The registry only reads
the passport, it never writes it.

🛑 **THIS FOLDER IS NOT ONE OF THE FOUR CONFIGS** — it was named `AGI-ITEMS-CONFIG` until node step 398 (owner 2026-10-05: «вместо CONFIG написать реестр»), and the name misled. `APP-CONFIG`,
`PLATFORM-CONFIG`, `DESIGN-CONFIG` and `PRODUCTS-CONFIG` are values a person edits, they carry a generated
`schema.json` and `defaults.json`, and `check:config-schemas` guards them. Here there is neither schema nor
defaults: this is the **state of one machine** — what is installed and from where. Its guard is
`npm run check:microservices`, and the writer is `npm run services:install`.

## The shape of an entry

| Field | What it is |
|---|---|
| `id` | the item's eternal name (`auth`, `data`, …): the folder, the pm2 process and the doors are named by it |
| `kind` | `core` — installed by the node itself · `user` — connected by the person. **It decides the path**: `AGI-ITEMS/<kind>/<id>` |
| `repo` | the git address the item is cloned from |
| `version` | the pinned **tag**, never a branch |
| `port` | the actual port from the block `24680–25679`, assigned by the node |
| `provides`, `required`, `note` | what the item gives, whether the node needs it, a human sentence |

🔒 **The version is pinned by a tag, never by a branch.** Following `main`, two people who run the same
command on different days get different nodes, and the difference is written down nowhere.
🛑 **The price is named:** a fix inside an item does not arrive until the version here is raised. So raising
it is part of closing a step that touched the item, not tidying up afterwards.

🔒 **The path comes from `kind`, and is never guessed from the name.** Two lists that mean the same thing
diverge silently — that is why the folder is not searched for and the kind is not inferred.

🛑 **No secrets here, ever.** The file is in git and travels to every guest. Keys live in the item's `.env`,
written by the installer and never committed.

The code of the items themselves is **not** in this repository: `AGI-ITEMS/` is in `.gitignore`, and each
item is its own repository — see its `repo` above.
