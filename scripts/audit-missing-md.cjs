/**
 * 对比 data/dishes.js 与 package-recipes/* 正文，列出缺失或过短的菜。
 *   node scripts/audit-missing-md.cjs
 */
const fs = require('fs')
const path = require('path')
const catalog = require('../data/dishes.js')
const {
  SHARD_COUNT,
  packageFolderForRecipe,
  packageFolderForShard
} = require('../utils/recipe-shard.js')

const ROOT = path.join(__dirname, '..')
const MIN_LEN = 30

function safeRequire(absPath) {
  if (!fs.existsSync(absPath)) return {}
  try {
    const r = require.resolve(absPath)
    if (require.cache[r]) delete require.cache[r]
  } catch (_) {}
  try {
    const m = require(absPath)
    return m && typeof m === 'object' ? m : {}
  } catch (_) {
    return {}
  }
}

function loadMerged(catKey) {
  const merged = {}
  const n = SHARD_COUNT[catKey] || 1
  for (let i = 0; i < n; i++) {
    const folder = packageFolderForShard(catKey, i)
    Object.assign(
      merged,
      safeRequire(path.join(ROOT, folder, 'recipes', `${catKey}.js`))
    )
  }
  return merged
}

function shardPath(catKey, name) {
  const folder = packageFolderForRecipe(catKey, name)
  return path.join(ROOT, folder, 'recipes', `${catKey}.js`)
}

const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
const byCat = {}
for (const d of dishes) {
  if (!byCat[d.categoryKey]) byCat[d.categoryKey] = loadMerged(d.categoryKey)
}

const missing = []
for (const d of dishes) {
  const t = byCat[d.categoryKey]
  const md = t && typeof t[d.name] === 'string' ? t[d.name] : ''
  if (!md || md.length <= MIN_LEN) {
    missing.push({
      categoryKey: d.categoryKey,
      name: d.name,
      len: md ? md.length : 0,
      file: path.relative(ROOT, shardPath(d.categoryKey, d.name))
    })
  }
}

const report = { totalDishes: dishes.length, missingCount: missing.length, missing }
const out = path.join(__dirname, '_audit-out.json')
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')
console.log(JSON.stringify(report, null, 2))
