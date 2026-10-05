import type { WorkspacePageWords } from '@/lib/collection/types'

export const en: WorkspacePageWords = {
  "title": "External GitHub",
  "lead": "Put a repository you did not write at the root of your domain, without changing how it looks.",
  "topics": [
    {
      "anchor": "how",
      "tab": "How it works",
      "title": "Claude Code adapts the repository to the node",
      "text": "You give the address of a Next.js repository. The agent of this section makes it part of the node: the site keeps its look, and the node can install it, give it sign-in and data, and reach its settings.",
      "points": [
        "The agent forks the repository to your GitHub account: the original stays untouched, and your changes have a home.",
        "It adds what the node needs: the passport OWN-SERVICE-PROPS.json, the environment contract .env.example, the build root in next.config, the health door, the settings door and the agent instruction.",
        "It checks that the site builds, tags a version and writes your fork into the root line of AGI-ITEMS-REGISTRY/agi-items.json.",
        "The node installs the new site next to the old one and switches only after a successful build: a failed build leaves the old site answering.",
        "To return to the starter, put its line back: one line."
      ]
    }
  ]
}
