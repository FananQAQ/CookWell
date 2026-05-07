/**
 * 将 package-cook/data/recipes/*.js 与 images/dishes/<cat> 迁到各 package-r-<categoryKey>/，
 * 便于单包体积低于微信限制。仅需执行一次（或拉取新数据后若仍打在旧路径可再跑）。
 *
 *   node scripts/split-recipe-subpackages.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)
const catalog = require(path.join(ROOT, 'data', 'dishes.js'))

const NOOP_JS = 'Page({})\n'
const NOOP_JSON = '{"usingComponents":{}}\n'
const NOOP_WXML = '<view></view>\n'
const NOOP_WXSS = '/* noop */\n'

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function rmDirIfEmpty(dir) {
  try {
    if (!fs.existsSync(dir)) return
    const n = fs.readdirSync(dir)
    if (n.length === 0) fs.rmdirSync(dir)
  } catch (_) {}
}

function main() {
  const keys = [...new Set((catalog.dishes || []).map(d => d.categoryKey).filter(Boolean))]
  keys.sort()

  for (const key of keys) {
    const pkg = `package-r-${key}`
    const pkgRoot = path.join(ROOT, pkg)
    const noopDir = path.join(pkgRoot, 'pages', '_noop')
    mkdir(noopDir)
    fs.writeFileSync(path.join(noopDir, '_noop.js'), NOOP_JS)
    fs.writeFileSync(path.join(noopDir, '_noop.json'), NOOP_JSON)
    fs.writeFileSync(path.join(noopDir, '_noop.wxml'), NOOP_WXML)
    fs.writeFileSync(path.join(noopDir, '_noop.wxss'), NOOP_WXSS)

    const srcJs = path.join(ROOT, 'package-cook', 'data', 'recipes', `${key}.js`)
    const dstJs = path.join(pkgRoot, 'recipes', `${key}.js`)
    if (fs.existsSync(srcJs)) {
      mkdir(path.dirname(dstJs))
      fs.renameSync(srcJs, dstJs)
      console.log('moved', path.relative(ROOT, srcJs), '->', path.relative(ROOT, dstJs))
    } else if (!fs.existsSync(dstJs)) {
      console.warn('missing recipe (跳过):', path.relative(ROOT, srcJs))
    }

    const srcImg = path.join(ROOT, 'package-cook', 'images', 'dishes', key)
    const dstImg = path.join(pkgRoot, 'images', 'dishes', key)
    if (fs.existsSync(srcImg)) {
      mkdir(path.dirname(dstImg))
      fs.renameSync(srcImg, dstImg)
      console.log('moved images', key)
    }
  }

  const oldRecipes = path.join(ROOT, 'package-cook', 'data', 'recipes')
  const oldDishes = path.join(ROOT, 'package-cook', 'images', 'dishes')
  rmDirIfEmpty(oldRecipes)
  rmDirIfEmpty(path.join(ROOT, 'package-cook', 'data'))
  rmDirIfEmpty(oldDishes)
  rmDirIfEmpty(path.join(ROOT, 'package-cook', 'images'))

  console.log('完成。请确认 app.json 已包含各 package-r-* 分包。')
  console.log('荤菜/主食/素菜单包可能仍 >2MB，请执行：node scripts/reshard-large-pkgs.mjs')
}

main()
