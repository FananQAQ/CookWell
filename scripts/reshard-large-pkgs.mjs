/**
 * 将仍超过单分包体积的 meat_dish / staple / vegetable_dish 拆成多包（与 utils/recipe-shard.js 规则一致）。
 * 在 split-recipe-subpackages.mjs 之后执行一次即可：
 *   node scripts/reshard-large-pkgs.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const {
  SHARD_COUNT,
  hashShard,
  packageFolderForRecipe,
  packageFolderForShard
} = require(path.join(ROOT, 'utils', 'recipe-shard.js'))

const NOOP_JS = 'Page({})\n'
const NOOP_JSON = '{"usingComponents":{}}\n'
const NOOP_WXML = '<view></view>\n'
const NOOP_WXSS = '/* noop */\n'

function writeNoop(pkgRoot) {
  const noopDir = path.join(pkgRoot, 'pages', '_noop')
  fs.mkdirSync(noopDir, { recursive: true })
  const files = [
    ['_noop.js', NOOP_JS],
    ['_noop.json', NOOP_JSON],
    ['_noop.wxml', NOOP_WXML],
    ['_noop.wxss', NOOP_WXSS]
  ]
  for (const [n, c] of files) {
    const p = path.join(noopDir, n)
    if (!fs.existsSync(p)) fs.writeFileSync(p, c, 'utf8')
  }
}

function reshardCategory(categoryKey, oldFolderName) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) {
    console.warn('skip (no shard config):', categoryKey)
    return
  }
  const oldRoot = path.join(ROOT, oldFolderName)
  const jsPath = path.join(oldRoot, 'recipes', `${categoryKey}.js`)
  if (!fs.existsSync(jsPath)) {
    console.warn('skip (missing):', jsPath)
    return
  }

  const obj = require(jsPath)
  const shards = Array.from({ length: n }, () => ({}))
  for (const [k, v] of Object.entries(obj)) {
    shards[hashShard(k, n)][k] = v
  }

  for (let i = 0; i < n; i++) {
    const folder = packageFolderForShard(categoryKey, i)
    const pkgRoot = path.join(ROOT, folder)
    writeNoop(pkgRoot)
    const outJs = path.join(pkgRoot, 'recipes', `${categoryKey}.js`)
    fs.mkdirSync(path.dirname(outJs), { recursive: true })
    fs.writeFileSync(outJs, `module.exports = ${JSON.stringify(shards[i])}\n`, 'utf8')
    console.log('wrote', path.relative(ROOT, outJs), 'keys:', Object.keys(shards[i]).length)
  }

  const imgDir = path.join(oldRoot, 'images', 'dishes', categoryKey)
  if (fs.existsSync(imgDir)) {
    for (const ent of fs.readdirSync(imgDir, { withFileTypes: true })) {
      if (!ent.isFile()) continue
      const m = ent.name.match(/^(.+)\.(jpe?g|webp)$/i)
      if (!m) continue
      const dishName = m[1]
      const destFolder = packageFolderForRecipe(categoryKey, dishName)
      const destDir = path.join(ROOT, destFolder, 'images', 'dishes', categoryKey)
      fs.mkdirSync(destDir, { recursive: true })
      const src = path.join(imgDir, ent.name)
      const dest = path.join(destDir, ent.name)
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      fs.renameSync(src, dest)
    }
    try {
      fs.rmSync(imgDir, { recursive: true, force: true })
    } catch (_) {}
  }

  fs.rmSync(oldRoot, { recursive: true, force: true })
  console.log('removed', oldFolderName)
}

function main() {
  reshardCategory('meat_dish', 'package-recipes/meat_dish')
  reshardCategory('staple', 'package-recipes/staple')
  reshardCategory('vegetable_dish', 'package-recipes/vegetable_dish')
  console.log('完成。请确认 app.json 已注册 package-recipes/meat-* 等分包。')
}

main()
