/**
 * 临时：把单个菜的 Markdown 从 GitHub 拉进对应分包（用于补洞）。
 *   node scripts/inject-one-md.mjs aquatic 白灼虾
 */
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const { candidateMdUrls } = require('../utils/recipe-md-fetch.js')

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'CookWell-inject/1' } },
      res => {
        let d = ''
        res.on('data', c => (d += c))
        res.on('end', () => {
          if (res.statusCode === 200) resolve(d)
          else reject(new Error(`HTTP ${res.statusCode}`))
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(25000, () => {
      req.destroy()
      reject(new Error('request timeout (25s)'))
    })
  })
}

async function fetchMd(cat, name) {
  for (const u of candidateMdUrls(cat, name)) {
    try {
      const t = await fetchText(u)
      if (t && t.length > 30) return t
    } catch (_) {}
  }
  throw new Error('fetch failed for all URLs')
}

const cat = process.argv[2]
const name = process.argv[3]
if (!cat || !name) {
  console.error('Usage: node scripts/inject-one-md.mjs <categoryKey> <dishName>')
  process.exit(1)
}

const jsPath = path.join(ROOT, `package-r-${cat}`, 'recipes', `${cat}.js`)
if (!fs.existsSync(jsPath)) {
  console.error('Missing file:', jsPath)
  process.exit(1)
}

try {
  const resolved = require.resolve(jsPath)
  if (require.cache[resolved]) delete require.cache[resolved]
} catch (_) {}

const mod = require(jsPath)
const md = await fetchMd(cat, name)
mod[name] = md.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n')
fs.writeFileSync(jsPath, `module.exports = ${JSON.stringify(mod)}\n`, 'utf8')
console.log('OK', name, 'keys:', Object.keys(mod).length)
