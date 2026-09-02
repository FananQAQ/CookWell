/**
 * 补全缺失的本地菜品封面：从 king-jingxiang 图床拉取 JPEG，压成 webp 写入对应分包。
 * 用法: node scripts/fill-missing-covers.mjs
 * 选项: --preset=hard|extreme|default  --width=360 --quality=52
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const catalog = require(path.join(ROOT, 'data/dishes.js'))
const { packageFolderForRecipe } = require(path.join(ROOT, 'utils/recipe-shard.js'))

const IMAGE_BASE = 'https://king-jingxiang.github.io/HowToCook/images/dishes'
const IMG_FETCH_MS = 25000

const PRESETS = {
  default: { width: 480, quality: 65 },
  hard: { width: 360, quality: 52 },
  extreme: { width: 320, quality: 45 }
}

function parseArgs(argv) {
  let preset = 'hard'
  let width
  let quality
  for (const a of argv) {
    if (a.startsWith('--preset=')) preset = a.slice('--preset='.length) || 'hard'
    else if (a.startsWith('--width=')) width = Number(a.slice('--width='.length))
    else if (a.startsWith('--quality=')) quality = Number(a.slice('--quality='.length))
  }
  const p = PRESETS[preset] || PRESETS.hard
  return {
    width: Number.isFinite(width) ? width : p.width,
    quality: Number.isFinite(quality) ? quality : p.quality
  }
}

function safeFileBase(name) {
  return String(name || '').replace(/[/\\?*:|"<>]/g, '_')
}

function imageUrl(categoryKey, name) {
  return `${IMAGE_BASE}/${categoryKey}/${encodeURIComponent(name)}.jpeg`
}

async function fetchImageBuf(url, ms = IMG_FETCH_MS) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'CookWell-fill-covers/1' },
    signal: AbortSignal.timeout(ms)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
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

function listMissing() {
  const dishes = catalog.dishes || []
  const missing = []
  for (const d of dishes) {
    const folder = packageFolderForRecipe(d.categoryKey, d.name)
    const dir = path.join(ROOT, folder, 'images', 'dishes', d.categoryKey)
    const base = safeFileBase(d.name)
    const webp = path.join(dir, `${base}.webp`)
    const jpeg = path.join(dir, `${base}.jpeg`)
    const jpg = path.join(dir, `${base}.jpg`)
    const hasWebp = fs.existsSync(webp) && fs.statSync(webp).size > 200
    const hasJpeg =
      (fs.existsSync(jpeg) && fs.statSync(jpeg).size > 200) ||
      (fs.existsSync(jpg) && fs.statSync(jpg).size > 200)
    if (!hasWebp) {
      missing.push({
        ...d,
        dir,
        webpPath: webp,
        jpegPath: fs.existsSync(jpeg) ? jpeg : fs.existsSync(jpg) ? jpg : null,
        hasJpeg
      })
    }
  }
  return missing
}

async function main() {
  const { width, quality } = parseArgs(process.argv.slice(2))
  let sharp
  try {
    ;({ default: sharp } = await import('sharp'))
  } catch (e) {
    console.error('需要 sharp：在项目根目录执行 npm install')
    throw e
  }

  const missing = listMissing()
  console.log(
    `缺 webp 封面 ${missing.length} 道；压缩参数 width<=${width} quality=${quality}`
  )
  if (!missing.length) return

  let ok = 0
  let fail = 0
  await mapPool(missing, 2, async d => {
    fs.mkdirSync(d.dir, { recursive: true })
    try {
      let buf
      if (d.hasJpeg && d.jpegPath) {
        buf = fs.readFileSync(d.jpegPath)
      } else {
        buf = await fetchImageBuf(imageUrl(d.categoryKey, d.name))
        if (buf.length < 500) throw new Error('too small')
      }
      const tmp = `${d.webpPath}.tmp`
      await sharp(buf)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toFile(tmp)
      fs.renameSync(tmp, d.webpPath)
      if (d.jpegPath && fs.existsSync(d.jpegPath)) {
        try {
          fs.unlinkSync(d.jpegPath)
        } catch {
          /* ignore */
        }
      }
      ok++
      console.log('OK', d.categoryKey, d.name)
    } catch (e) {
      fail++
      console.warn('FAIL', d.categoryKey, d.name, e.message || e)
    }
  })
  console.log(`完成：成功 ${ok}，失败 ${fail}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
