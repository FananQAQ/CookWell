/**
 * 从 king-jingxiang/HowToCook 的 menus/*.md 拉取菜名，生成 data/dishes.json + data/dishes.js
 * 运行: node scripts/build-dish-index.mjs
 * 小程序内请 require dishes.js（module.exports）；部分基础库不支持 require .json
 */
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const MENU_FILES = [
  { key: 'aquatic', label: '水产', file: 'aquatic.md' },
  { key: 'breakfast', label: '早餐', file: 'breakfast.md' },
  { key: 'condiment', label: '酱料与其它', file: 'condiment.md' },
  { key: 'dessert', label: '甜品', file: 'dessert.md' },
  { key: 'drink', label: '饮料', file: 'drink.md' },
  { key: 'meat_dish', label: '荤菜', file: 'meat_dish.md' },
  { key: 'semi-finished', label: '半成品', file: 'semi-finished.md' },
  { key: 'soup', label: '汤与粥', file: 'soup.md' },
  { key: 'staple', label: '主食', file: 'staple.md' },
  { key: 'vegetable_dish', label: '素菜', file: 'vegetable_dish.md' }
]

const BASE =
  'https://raw.githubusercontent.com/king-jingxiang/HowToCook/main/menus/'

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ${url}`))
          return
        }
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
  })
}

function parseDishNames(md) {
  const names = []
  const re = /^##\s+(.+)$/gm
  let m
  while ((m = re.exec(md)) !== null) {
    const title = m[1].trim()
    if (!title || /^素菜类|荤菜|水产|早餐|甜品|饮料|汤与粥|主食|酱料|半成品|基础操作/.test(title))
      continue
    if (title.length > 40) continue
    names.push(title)
  }
  return names
}

async function main() {
  const categories = MENU_FILES.map(({ key, label }) => ({ key, label }))
  const dishes = []
  const seen = new Set()

  for (const { key, label, file } of MENU_FILES) {
    const md = await fetchText(BASE + file)
    for (const name of parseDishNames(md)) {
      const id = `${key}::${name}`
      if (seen.has(id)) continue
      seen.add(id)
      dishes.push({ name, categoryKey: key, categoryLabel: label })
    }
    console.log(label, dishes.filter(d => d.categoryKey === key).length)
  }

  dishes.sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-Hans-CN')
  )

  const out = {
    version: 1,
    source: 'king-jingxiang/HowToCook menus + Anduin2017/HowToCook markdown',
    categories,
    dishes
  }

  const dataDir = path.join(ROOT, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const compact = JSON.stringify(out)
  fs.writeFileSync(path.join(dataDir, 'dishes.json'), compact, 'utf8')
  fs.writeFileSync(
    path.join(dataDir, 'dishes.js'),
    'module.exports = ' + compact + '\n',
    'utf8'
  )
  console.log('Wrote data/dishes.json + data/dishes.js, total dishes:', dishes.length)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
