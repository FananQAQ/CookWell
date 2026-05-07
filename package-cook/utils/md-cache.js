const { MD_CACHE_PREFIX } = require('../../utils/constants.js')
const { getRecipeMarkdownAsync } = require('../../utils/recipe-data.js')

const mem = new Map()
const MEM_MAX = 100

function memKey(categoryKey, name) {
  return `${categoryKey}::${name}`
}

function memSet(categoryKey, name, markdown) {
  const k = memKey(categoryKey, name)
  if (mem.size >= MEM_MAX) {
    const first = mem.keys().next().value
    if (first !== undefined) mem.delete(first)
  }
  mem.set(k, markdown)
}

function memGet(categoryKey, name) {
  return mem.get(memKey(categoryKey, name)) || null
}

function cacheKey(categoryKey, name) {
  return `${MD_CACHE_PREFIX}${categoryKey}_${name}`
}

function getCached(categoryKey, name) {
  try {
    const row = wx.getStorageSync(cacheKey(categoryKey, name))
    if (row && row.markdown && row.ts) {
      const age = Date.now() - row.ts
      if (age < 7 * 24 * 3600 * 1000) {
        return row.markdown
      }
    }
  } catch (e) {}
  return null
}

function setCached(categoryKey, name, markdown) {
  try {
    wx.setStorageSync(cacheKey(categoryKey, name), {
      markdown,
      ts: Date.now()
    })
  } catch (e) {}
}

function loadMarkdown(categoryKey, name) {
  const m = memGet(categoryKey, name)
  if (m) {
    return Promise.resolve(m)
  }

  const fail = () => {
    const hit = getCached(categoryKey, name)
    if (hit) {
      memSet(categoryKey, name, hit)
      return Promise.resolve(hit)
    }
    return Promise.reject(
      new Error(
        `「${name}」在本地分包里没有正文（索引与数据不同步）。请在项目根目录执行：node scripts/bundle-recipes.mjs（或加 --md-only 只更新菜谱文字）`
      )
    )
  }

  return getRecipeMarkdownAsync(categoryKey, name)
    .then(bundled => {
      if (bundled && bundled.length > 30) {
        memSet(categoryKey, name, bundled)
        return bundled
      }
      return fail()
    })
    .catch(err => {
      const hit = getCached(categoryKey, name)
      if (hit) {
        memSet(categoryKey, name, hit)
        return Promise.resolve(hit)
      }
      return Promise.reject(err)
    })
}

module.exports = { loadMarkdown, getCached, setCached, memGet, memSet }
