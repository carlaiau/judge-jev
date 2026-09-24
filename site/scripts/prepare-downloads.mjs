import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const destination = join(root, 'site/public/downloads')
mkdirSync(destination, { recursive: true })

for (const [source, name] of [
  ['results/report.json', 'llmjudge-report.json'],
  ['results/calibration.json', 'llmjudge-calibration.json'],
  ['results/jev-dev-raw.jsonl', 'jev-dev-raw.jsonl'],
  ['results/jev-test-raw.jsonl', 'jev-test-raw.jsonl'],
  ['data/manifest.json', 'source-manifest.json'],
]) {
  copyFileSync(join(root, source), join(destination, name))
}
