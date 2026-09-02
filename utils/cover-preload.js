/**
 * 进详情前预热：下分包 + getImageInfo，让封面进入微信图片缓存后再跳转。
 */
const { resolveCoverUrls } = require('./dish-image.js')
const { ensureRecipePackage } = require('./recipe-package.js')

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('empty src'))
      return
    }
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * @returns {Promise<{ url: string, local: boolean }>}
 */
function preloadDishCover(categoryKey, name) {
  const cover = resolveCoverUrls(categoryKey, name)
  return ensureRecipePackage(categoryKey, name)
    .catch(() => null)
    .then(() =>
      getImageInfo(cover.primary)
        .then(() => ({ url: cover.primary, local: true }))
        .catch(() => {
          if (!cover.fallback) {
            return Promise.reject(new Error('cover unavailable'))
          }
          return getImageInfo(cover.fallback).then(() => ({
            url: cover.fallback,
            local: false
          }))
        })
    )
}

/**
 * 预热多道菜封面（汇总页），失败的跳过。
 */
function preloadDishCovers(items, concurrency) {
  const list = Array.isArray(items) ? items : []
  const limit = Math.max(1, concurrency || 3)
  let i = 0
  const workers = Array.from({ length: limit }, async () => {
    while (i < list.length) {
      const it = list[i++]
      try {
        await preloadDishCover(it.categoryKey, it.name)
      } catch (e) {
        /* ignore single miss */
      }
    }
  })
  return Promise.all(workers)
}

module.exports = {
  getImageInfo,
  preloadDishCover,
  preloadDishCovers
}
