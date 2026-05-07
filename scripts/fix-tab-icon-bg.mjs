/**
 * Tab 图标若带白底或透明在真机显白，统一铺成与 custom-tab-bar 一致的米色。
 *   node scripts/fix-tab-icon-bg.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// 与 custom-tab-bar .tab-bar 渐变上端、app.json tabBar.backgroundColor 一致
const BG = { r: 243, g: 240, b: 234 }

function isNearWhite(r, g, b, a) {
  if (a < 20) return true
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < 218) return false
  if (r > 236 && g > 236 && b > 236) return true
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return lum > 238 && spread < 14
}

async function fixOne(file) {
  const buf = await sharp(file).ensureAlpha().raw().toBuffer()
  const meta = await sharp(file).metadata()
  const w = meta.width
  const h = meta.height
  const out = Buffer.from(buf)
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const a = out[i + 3]
    if (isNearWhite(r, g, b, a)) {
      out[i] = BG.r
      out[i + 1] = BG.g
      out[i + 2] = BG.b
      out[i + 3] = 255
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file)
  console.log('fixed', path.relative(ROOT, file))
}

const files = [
  path.join(ROOT, 'images/tab-discover.png'),
  path.join(ROOT, 'images/tab-mine.png')
]
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error('missing', f)
    process.exit(1)
  }
  await fixOne(f)
}
