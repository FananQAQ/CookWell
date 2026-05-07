/**
 * 将各 package-r-*/images/dishes（及旧路径 package-cook/images/dishes）下配图压到适合上传的体积。
 * 默认：宽≤480、jpeg q≈65。
 *
 * 常用：
 *   node scripts/compress-dish-images.mjs --preset=hard
 *   node scripts/compress-dish-images.mjs --preset=extreme
 *   node scripts/compress-dish-images.mjs --preset=hard --webp
 * 自定义：--width=400 --quality=55
 *
 * 使用 --webp 会把 .jpeg/.jpg 转为 .webp 并删除原图；请把 utils/constants.js 里 DISH_COVER_EXT 改为 'webp'。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PRESETS = {
  default: { width: 480, quality: 65 },
  hard: { width: 360, quality: 52 },
  extreme: { width: 320, quality: 45 }
}

function parseArgs(argv) {
  let preset = 'default'
  let width
  let quality
  let useWebp = false
  for (const a of argv) {
    if (a === '--hard') preset = 'hard'
    else if (a === '--extreme') preset = 'extreme'
    else if (a === '--webp') useWebp = true
    else if (a.startsWith('--preset=')) preset = a.slice('--preset='.length) || 'default'
    else if (a.startsWith('--width=')) width = Number(a.slice('--width='.length))
    else if (a.startsWith('--quality=')) quality = Number(a.slice('--quality='.length))
  }
  const p = PRESETS[preset] || PRESETS.default
  return {
    width: Number.isFinite(width) ? width : p.width,
    quality: Number.isFinite(quality) ? quality : p.quality,
    useWebp
  }
}

async function main() {
  const { width, quality, useWebp } = parseArgs(process.argv.slice(2))

  let sharp
  try {
    ;({ default: sharp } = await import('sharp'))
  } catch (e) {
    console.error('请先安装 sharp：在项目根目录执行 npm install')
    process.exit(1)
  }

  function walk(dir) {
    const out = []
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) out.push(...walk(p))
      else if (/\.(jpe?g|webp)$/i.test(ent.name)) out.push(p)
    }
    return out
  }

  function dishImageRoots() {
    const roots = []
    const legacy = path.join(ROOT, 'package-cook', 'images', 'dishes')
    if (fs.existsSync(legacy)) roots.push(legacy)
    try {
      for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory() || !ent.name.startsWith('package-r-')) continue
        const p = path.join(ROOT, ent.name, 'images', 'dishes')
        if (fs.existsSync(p)) roots.push(p)
      }
    } catch (_) {}
    return roots
  }

  const roots = dishImageRoots()
  if (roots.length === 0) {
    console.error(
      '未找到配图目录：请先有 package-r-*/images/dishes 或 package-cook/images/dishes'
    )
    process.exit(1)
  }
  const files = roots.flatMap(r => walk(r))
  console.log(
    '共',
    files.length,
    '张，开始压缩 …',
    `width=${width} quality=${quality}`,
    useWebp ? 'format=webp' : 'format=jpeg'
  )
  let saved = 0
  let done = 0
  for (const f of files) {
    const tmp = f + '.__cw'
    try {
      const before = fs.statSync(f).size
      const pipeline = sharp(f)
        .rotate()
        .resize({ width, withoutEnlargement: true })

      const outPath = useWebp
        ? f.replace(/\.(jpe?g|webp)$/i, '.webp')
        : f.replace(/\.(jpe?g|webp)$/i, '.jpeg')

      if (useWebp) {
        await pipeline.webp({ quality, effort: 5 }).toFile(tmp)
      } else {
        await pipeline.jpeg({ quality, mozjpeg: true }).toFile(tmp)
      }

      const after = fs.statSync(tmp).size
      if (outPath !== f && fs.existsSync(f)) {
        fs.unlinkSync(f)
      }
      fs.renameSync(tmp, outPath)
      saved += Math.max(0, before - after)
    } catch (e) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
      } catch (_) {}
      console.warn('跳过（无法写入可能路径/占用）:', f, e.message || e)
    }
    done++
    if (done % 50 === 0) console.log('  ', done, '/', files.length)
  }
  console.log('完成。累计约减小', Math.round(saved / 1024 / 1024), 'MB（相对压缩前）')
  if (useWebp) {
    console.log('已将图片转为 webp，请把 utils/constants.js 中 DISH_COVER_EXT 设为 \'webp\'。')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
