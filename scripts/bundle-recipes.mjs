/**
 * 将 Anduin2017/HowToCook 的 .md 与 king-jingxiang 配图拉取到各 package-r-<分类>/（正文与封面同包），供离线使用。
 * 运行: node scripts/bundle-recipes.mjs
 * 仅正文: node scripts/bundle-recipes.mjs --md-only
 * 仅补图: node scripts/bundle-recipes.mjs --images-only
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const catalog = require(path.join(ROOT, 'data/dishes.js'))
const {
  SHARD_COUNT,
  hashShard,
  packageFolderForRecipe
} = require(path.join(ROOT, 'utils', 'recipe-shard.js'))
const { candidateMdUrls } = require(path.join(ROOT, 'utils', 'recipe-md-fetch.js'))

const RAW_BASE =
  'https://raw.githubusercontent.com/Anduin2017/HowToCook/master/dishes'
const IMAGE_BASE =
  'https://king-jingxiang.github.io/HowToCook/images/dishes'

const MD_ONLY = process.argv.includes('--md-only')
const IMAGES_ONLY = process.argv.includes('--images-only')

const MD_FETCH_MS = 35000
const IMG_FETCH_MS = 22000

function enc(seg) {
  return encodeURIComponent(seg)
}

function imageUrl(categoryKey, name) {
  return `${IMAGE_BASE}/${categoryKey}/${enc(name)}.jpeg`
}

function safeFileBase(name) {
  return name.replace(/[/\\?*:|"<>]/g, '_')
}

/** 去掉多余空行与行尾空白，减小 recipes/*.js 体积，一般不影响 Markdown 渲染 */
function compactMarkdown(md) {
  if (typeof md !== 'string') return md
  return md
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+$/gm, '')
}

async function fetchText(url, ms = MD_FETCH_MS) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'CookWell-bundle/1' },
    signal: AbortSignal.timeout(ms)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

async function fetchMarkdown(categoryKey, name) {
  const urls = candidateMdUrls(categoryKey, name)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800))
    for (const url of urls) {
      try {
        const text = await fetchText(url)
        if (typeof text === 'string' && text.length > 30) return text
      } catch {
        /* try next */
      }
    }
  }
  return null
}

async function fetchImageBuf(url, ms = IMG_FETCH_MS) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'CookWell-bundle/1' },
    signal: AbortSignal.timeout(ms)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: limit }, async () => {
    for (;;) {
      const j = i++
      if (j >= items.length) break
      ret[j] = await fn(items[j], j)
    }
  })
  await Promise.all(workers)
  return ret
}

async function main() {
  const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
  if (!dishes.length) {
    console.error('No dishes in data/dishes.js')
    process.exit(1)
  }

  function recipeWriteParts(cat, obj) {
    const n = SHARD_COUNT[cat]
    if (!n) {
      return [{ folder: `package-r-${cat}`, part: obj }]
    }
    const shards = Array.from({ length: n }, () => ({}))
    for (const [k, v] of Object.entries(obj)) {
      shards[hashShard(k, n)][k] = v
    }
    return shards.map((part, i) => {
      let folder
      if (cat === 'meat_dish') folder = `package-r-meat-${i}`
      else if (cat === 'staple') folder = `package-r-staple-${i}`
      else if (cat === 'vegetable_dish') folder = `package-r-veg-${i}`
      else folder = `package-r-${cat}`
      return { folder, part }
    })
  }

  function safeRequireRecipeFile(absPath) {
    if (!fs.existsSync(absPath)) return {}
    try {
      const resolved = require.resolve(absPath)
      if (require.cache[resolved]) delete require.cache[resolved]
    } catch (_) {}
    try {
      const m = require(absPath)
      return m && typeof m === 'object' ? m : {}
    } catch (_) {
      return {}
    }
  }

  /** 读取磁盘上已有正文，避免本次拉取失败时把整类覆盖成「缺菜」 */
  function loadExistingRecipesForCategory(catKey) {
    const merged = {}
    if (catKey === 'meat_dish') {
      for (let i = 0; i < 4; i++) {
        const p = path.join(
          ROOT,
          `package-r-meat-${i}`,
          'recipes',
          'meat_dish.js'
        )
        Object.assign(merged, safeRequireRecipeFile(p))
      }
    } else if (catKey === 'staple') {
      for (let i = 0; i < 2; i++) {
        const p = path.join(
          ROOT,
          `package-r-staple-${i}`,
          'recipes',
          'staple.js'
        )
        Object.assign(merged, safeRequireRecipeFile(p))
      }
    } else if (catKey === 'vegetable_dish') {
      for (let i = 0; i < 2; i++) {
        const p = path.join(
          ROOT,
          `package-r-veg-${i}`,
          'recipes',
          'vegetable_dish.js'
        )
        Object.assign(merged, safeRequireRecipeFile(p))
      }
    } else {
      const p = path.join(
        ROOT,
        `package-r-${catKey}`,
        'recipes',
        `${catKey}.js`
      )
      Object.assign(merged, safeRequireRecipeFile(p))
    }
    return merged
  }

  function ensureNoop(pkgRoot) {
    const noopDir = path.join(pkgRoot, 'pages', '_noop')
    fs.mkdirSync(noopDir, { recursive: true })
    const files = [
      ['_noop.js', 'Page({})\n'],
      ['_noop.json', '{"usingComponents":{}}\n'],
      ['_noop.wxml', '<view></view>\n'],
      ['_noop.wxss', '/* noop */\n']
    ]
    for (const [name, content] of files) {
      const fp = path.join(noopDir, name)
      if (!fs.existsSync(fp)) fs.writeFileSync(fp, content, 'utf8')
    }
  }

  let byCat = null
  if (!IMAGES_ONLY) {
    byCat = {}
    for (const d of dishes) {
      if (!byCat[d.categoryKey]) byCat[d.categoryKey] = {}
    }

    const existingByCat = {}
    for (const k of Object.keys(byCat)) {
      existingByCat[k] = loadExistingRecipesForCategory(k)
    }

    console.log('Fetching markdown for', dishes.length, 'dishes …')
    let missMd = 0
    await mapPool(dishes, 6, async d => {
      const md = await fetchMarkdown(d.categoryKey, d.name)
      if (md) {
        byCat[d.categoryKey][d.name] = compactMarkdown(md)
      } else {
        const prev = existingByCat[d.categoryKey] && existingByCat[d.categoryKey][d.name]
        if (typeof prev === 'string' && prev.length > 30) {
          byCat[d.categoryKey][d.name] = prev
        } else {
          missMd++
          console.warn('MD miss:', d.categoryKey, d.name)
        }
      }
    })

    for (const [cat, obj] of Object.entries(byCat)) {
      for (const { folder, part } of recipeWriteParts(cat, obj)) {
        const p = path.join(ROOT, folder, 'recipes', `${cat}.js`)
        fs.mkdirSync(path.dirname(p), { recursive: true })
        fs.writeFileSync(p, `module.exports = ${JSON.stringify(part)}\n`, 'utf8')
        console.log('Wrote', p, 'keys:', Object.keys(part).length)
      }
    }

    if (missMd) console.warn('Total MD misses:', missMd)
  }

  const ensureRoots = new Set()
  for (const d of dishes) {
    ensureRoots.add(packageFolderForRecipe(d.categoryKey, d.name))
  }
  if (byCat) {
    for (const [cat, obj] of Object.entries(byCat)) {
      for (const { folder } of recipeWriteParts(cat, obj)) {
        ensureRoots.add(folder)
      }
    }
  }
  for (const rel of ensureRoots) ensureNoop(path.join(ROOT, rel))

  if (!IMAGES_ONLY && MD_ONLY) {
    console.log('Done (--md-only, skipped images).')
    return
  }

  const total = dishes.length
  console.log('Fetching cover images', total, '… (timeout', IMG_FETCH_MS, 'ms each, 2 concurrent)')
  let missImg = 0
  let imgTried = 0
  await mapPool(dishes, 2, async d => {
    const folder = packageFolderForRecipe(d.categoryKey, d.name)
    const dir = path.join(ROOT, folder, 'images', 'dishes', d.categoryKey)
    fs.mkdirSync(dir, { recursive: true })
    const base = safeFileBase(d.name)
    const dest = path.join(dir, `${base}.jpeg`)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      imgTried++
      if (imgTried % 40 === 0 || imgTried === total) {
        console.log(`  progress ${imgTried}/${total} (skipped existing)`)
      }
      return
    }
    try {
      const buf = await fetchImageBuf(imageUrl(d.categoryKey, d.name))
      if (buf.length < 500) throw new Error('too small')
      fs.writeFileSync(dest, buf)
    } catch {
      missImg++
    }
    imgTried++
    if (imgTried % 25 === 0 || imgTried === total) {
      console.log(`  progress ${imgTried}/${total}, missing so far: ${missImg}`)
    }
  })
  if (missImg) console.warn('Cover images missing (404 / timeout / error):', missImg)
  console.log('Done.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
