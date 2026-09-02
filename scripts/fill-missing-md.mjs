/**
 * 仅拉取「目录里有、分包里没有或正文过短」的菜，写入对应 recipes/*.js（不整包重拉）。
 *   node scripts/fill-missing-md.mjs
 * 依赖：先 node scripts/audit-missing-md.cjs 生成 scripts/_audit-out.json，或本脚本内置重算。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const catalog = require(path.join(ROOT, 'data/dishes.js'))
const { SHARD_COUNT, packageFolderForRecipe, packageFolderForShard } = require(path.join(ROOT, 'utils/recipe-shard.js'))
const { candidateMdUrls } = require(path.join(ROOT, 'utils/recipe-md-fetch.js'))

const FETCH_MS = 45000
const MIN_LEN = 30

function compactMarkdown(md) {
  return String(md)
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+$/gm, '')
}

async function fetchMarkdown(categoryKey, name) {
  const urls = candidateMdUrls(categoryKey, name)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800))
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          headers: { 'User-Agent': 'CookWell-fill-missing/1' },
          signal: AbortSignal.timeout(FETCH_MS)
        })
        if (!res.ok) continue
        const text = await res.text()
        if (text && text.length > MIN_LEN) return compactMarkdown(text)
      } catch {
        /* next url / retry */
      }
    }
  }
  return null
}

function safeRequire(absPath) {
  if (!fs.existsSync(absPath)) return {}
  try {
    const r = require.resolve(absPath)
    if (require.cache[r]) delete require.cache[r]
  } catch (_) {}
  try {
    const m = require(absPath)
    return m && typeof m === 'object' ? { ...m } : {}
  } catch (_) {
    return {}
  }
}

function recipeFileForDish(categoryKey, name) {
  const folder = packageFolderForRecipe(categoryKey, name)
  return path.join(ROOT, folder, 'recipes', `${categoryKey}.js`)
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

function listMissing() {
  const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
  const tables = {}
  const missing = []
  for (const d of dishes) {
    if (!tables[d.categoryKey]) tables[d.categoryKey] = loadMerged(d.categoryKey)
    const md = tables[d.categoryKey][d.name]
    const s = typeof md === 'string' ? md : ''
    if (!s || s.length <= MIN_LEN) {
      missing.push({ categoryKey: d.categoryKey, name: d.name })
    }
  }
  return missing
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (;;) {
        const j = i++
        if (j >= items.length) break
        ret[j] = await fn(items[j], j)
      }
    })
  )
  return ret
}

async function main() {
  const missing = listMissing()
  console.log('Missing or short markdown:', missing.length)
  if (!missing.length) {
    console.log('Nothing to do.')
    return
  }

  const updatesByFile = new Map()
  await mapPool(missing, 5, async ({ categoryKey, name }) => {
    const md = await fetchMarkdown(categoryKey, name)
    const fp = recipeFileForDish(categoryKey, name)
    if (!updatesByFile.has(fp)) updatesByFile.set(fp, [])
    updatesByFile.get(fp).push({ categoryKey, name, md })
    if (md) {
      console.log('OK', categoryKey, name)
    } else {
      console.warn('FAIL', categoryKey, name)
    }
  })

  for (const [fp, rows] of updatesByFile) {
    const mod = safeRequire(fp)
    let changed = false
    for (const { name, md } of rows) {
      if (md && md.length > MIN_LEN) {
        mod[name] = md
        changed = true
      }
    }
    if (changed) {
      fs.mkdirSync(path.dirname(fp), { recursive: true })
      fs.writeFileSync(fp, `module.exports = ${JSON.stringify(mod)}\n`, 'utf8')
      console.log('Wrote', path.relative(ROOT, fp), 'keys', Object.keys(mod).length)
    }
  }

  const still = listMissing()
  console.log('Still missing:', still.length)
  if (still.length) {
    still.forEach(x => console.warn(' ', x.categoryKey, x.name))
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
