// Re-embeds components/ui/butter-nav.tsx into r/butter-nav.json.
// The .tsx file is the source of truth; run this after editing it:
//   node scripts/sync-registry.mjs

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const sourcePath = join(root, "components/ui/butter-nav.tsx")
const itemPath = join(root, "r/butter-nav.json")

const source = readFileSync(sourcePath, "utf8")
const item = JSON.parse(readFileSync(itemPath, "utf8"))

item.files[0].content = source
writeFileSync(itemPath, JSON.stringify(item, null, 2) + "\n")

console.log(`r/butter-nav.json updated (${source.length} chars)`)
