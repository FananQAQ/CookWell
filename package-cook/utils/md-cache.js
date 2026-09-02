/**
 * 菜谱 Markdown 内存缓存。
 * 正文来自 package-recipes/* 的 require.async；不再写 wx.storage（避免无写入的死路径与占配额）。
 */
const { getRecipeMarkdownAsync } = require('../../utils/recipe-data.js')

const mem = new Map()
const MEM_MAX = 80

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

function loadMarkdown(categoryKey, name) {
  const hit = memGet(categoryKey, name)
  if (hit) return Promise.resolve(hit)

  return getRecipeMarkdownAsync(categoryKey, name).then(bundled => {
    if (bundled && bundled.length > 30) {
      memSet(categoryKey, name, bundled)
      return bundled
    }
    return Promise.reject(
      new Error(
        `「${name}」在本地分包里没有正文（索引与数据不同步）。请执行：node scripts/bundle-recipes.mjs --md-only`
      )
    )
  })
}

module.exports = { loadMarkdown, memGet, memSet }
