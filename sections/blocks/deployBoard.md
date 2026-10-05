# deployBoard — the deployment board of the node

**Type:** Page material. The working part of «Core → Deployments».

**Decision of the owner, 2026-09-24:** saving design or settings does not rebuild anything; «кнопку
повторить развёртывание … выборочно сделать развёртывание либо одного из сервисов либо сразу всех одной
кнопкой». The board lists every element of the node (`AGI-ITEMS-REGISTRY/agi-items.json`) with its version,
the time of its last build and a **measured** sign «changes waiting»: a settings file the element owns
(`settings.owns` in its passport) is newer than its last build. A button per element and «Deploy
everything»; elements are deployed one after another by `scripts/deploy-elements.mjs`, each through the
installer — without downtime for elements that build into a neighbour folder (280-9).

The core is listed without a button: its rebuild restarts the server that serves this page and still has
downtime. Version history is future work.
