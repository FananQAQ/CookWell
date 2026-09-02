/**
 * 确保菜谱分包已下载（封面 webp 在分包内）。
 * 本地 webp ~25KB；远程图床 JPEG 单张可 >600KB，故优先本地，并后台预下载分包。
 */
const { packageLeafForRecipe } = require('./recipe-shard.js')

/** 与 app.json subPackages[].name 一致（不含 package-cook） */
const ALL_RECIPE_PACKAGE_NAMES = [
  'r-aquatic',
  'r-breakfast',
  'r-condiment',
  'r-dessert',
  'r-drink',
  'r-meat-0',
  'r-meat-1',
  'r-meat-2',
  'r-meat-3',
  'r-semi',
  'r-soup',
  'r-staple-0',
  'r-staple-1',
  'r-veg-0',
  'r-veg-1'
]

const loaded = new Set()
const inflight = new Map()

function packageNameForRecipe(categoryKey, name) {
  const leaf = packageLeafForRecipe(categoryKey, name)
  if (leaf === 'semi-finished') return 'r-semi'
  return `r-${leaf}`
}

function isAlreadyLoadedError(err) {
  const msg = String((err && (err.errMsg || err.message)) || err || '')
  return /already|exist|已下载|已经|loaded/i.test(msg)
}

function ensurePackageByName(pkg) {
  if (!pkg) return Promise.reject(new Error('missing package name'))
  if (loaded.has(pkg)) return Promise.resolve(pkg)
  if (inflight.has(pkg)) return inflight.get(pkg)

  const p = new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.loadSubpackage !== 'function') {
      loaded.add(pkg)
      resolve(pkg)
      return
    }
    wx.loadSubpackage({
      name: pkg,
      success() {
        loaded.add(pkg)
        resolve(pkg)
      },
      fail(err) {
        if (isAlreadyLoadedError(err)) {
          loaded.add(pkg)
          resolve(pkg)
          return
        }
        reject(err || new Error('loadSubpackage failed: ' + pkg))
      }
    })
  }).finally(() => {
    inflight.delete(pkg)
  })

  inflight.set(pkg, p)
  return p
}

function ensureRecipePackage(categoryKey, name) {
  return ensurePackageByName(packageNameForRecipe(categoryKey, name))
}

function ensureRecipePackages(pairs) {
  const seen = new Set()
  const tasks = []
  for (const { categoryKey, name } of pairs || []) {
    const pkg = packageNameForRecipe(categoryKey, name)
    if (!pkg || seen.has(pkg)) continue
    seen.add(pkg)
    tasks.push(ensurePackageByName(pkg))
  }
  return Promise.all(tasks)
}

/**
 * 空闲时预下载全部菜谱分包（约数 MB）。首页停留片刻后封面可秒开。
 * concurrency 建议 1～2，避免抢占首屏。
 */
function preloadAllRecipePackages(options) {
  const concurrency = Math.max(1, (options && options.concurrency) || 2)
  const queue = ALL_RECIPE_PACKAGE_NAMES.filter(n => !loaded.has(n))
  let i = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < queue.length) {
      const pkg = queue[i++]
      try {
        await ensurePackageByName(pkg)
      } catch (e) {
        console.warn('preload package fail', pkg, e)
      }
    }
  })
  return Promise.all(workers)
}

function isRecipePackageReady(categoryKey, name) {
  return loaded.has(packageNameForRecipe(categoryKey, name))
}

module.exports = {
  ALL_RECIPE_PACKAGE_NAMES,
  packageNameForRecipe,
  ensurePackageByName,
  ensureRecipePackage,
  ensureRecipePackages,
  preloadAllRecipePackages,
  isRecipePackageReady
}
