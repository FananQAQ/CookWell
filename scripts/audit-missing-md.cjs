/**
 * 对比 data/dishes.js 与各 package-r-* 正文，列出缺失或过短的菜。
 *   node scripts/audit-missing-md.cjs
 */
const fs = require('fs')
const path = require('path')
const catalog = require('../data/dishes.js')
const {
  SHARD_COUNT,
  hashShard
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
  if (catKey === 'meat_dish') {
    for (let i = 0; i < 4; i++) {
      Object.assign(
        merged,
        safeRequire(path.join(ROOT, `package-r-meat-${i}`, 'recipes', 'meat_dish.js'))
      )
    }
  } else if (catKey === 'staple') {
    for (let i = 0; i < 2; i++) {
      Object.assign(
        merged,
        safeRequire(path.join(ROOT, `package-r-staple-${i}`, 'recipes', 'staple.js'))
      )
    }
  } else if (catKey === 'vegetable_dish') {
    for (let i = 0; i < 2; i++) {
      Object.assign(
        merged,
        safeRequire(path.join(ROOT, `package-r-veg-${i}`, 'recipes', 'vegetable_dish.js'))
      )
    }
  } else {
    Object.assign(
      merged,
      safeRequire(
        path.join(ROOT, `package-r-${catKey}`, 'recipes', `${catKey}.js`)
      )
    )
  }
  return merged
}

function shardPath(catKey, name) {
  const n = SHARD_COUNT[catKey]
  if (!n) {
    return path.join(ROOT, `package-r-${catKey}`, 'recipes', `${catKey}.js`)
  }
  const s = hashShard(name, n)
  if (catKey === 'meat_dish') {
    return path.join(ROOT, `package-r-meat-${s}`, 'recipes', 'meat_dish.js')
  }
  if (catKey === 'staple') {
    return path.join(ROOT, `package-r-staple-${s}`, 'recipes', 'staple.js')
  }
  if (catKey === 'vegetable_dish') {
    return path.join(ROOT, `package-r-veg-${s}`, 'recipes', 'vegetable_dish.js')
  }
  return path.join(ROOT, `package-r-${catKey}`, 'recipes', `${catKey}.js`)
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
