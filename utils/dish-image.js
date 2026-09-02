const {
  DISH_COVER_MODE,
  DISH_COVER_EXT,
  REMOTE_COVER_BASE
} = require('./constants.js')
const { packageFolderForRecipe } = require('./recipe-shard.js')

function safeImageFileName(name) {
  return String(name || '').replace(/[/\\?*:|"<>]/g, '_')
}

/** 分包内本地封面路径 */
function dishCoverLocalUrl(categoryKey, name) {
  const seg = safeImageFileName(name)
  const ext = DISH_COVER_EXT === 'webp' ? 'webp' : 'jpeg'
  const folder = packageFolderForRecipe(categoryKey, name)
  return `/${folder}/images/dishes/${categoryKey}/${seg}.${ext}`
}

/** 图床 JPEG */
function dishCoverRemoteUrl(categoryKey, name) {
  const seg = safeImageFileName(name)
  return `${REMOTE_COVER_BASE}/${categoryKey}/${encodeURIComponent(seg)}.jpeg`
}

/**
 * 按 DISH_COVER_MODE 决定主/备封面。
 * remote：立刻可用，不阻塞菜谱分包下载。
 */
function resolveCoverUrls(categoryKey, name) {
  const remote = dishCoverRemoteUrl(categoryKey, name)
  const local = dishCoverLocalUrl(categoryKey, name)
  if (DISH_COVER_MODE === 'local') {
    return { primary: local, fallback: remote }
  }
  return { primary: remote, fallback: local }
}

module.exports = {
  safeImageFileName,
  dishCoverLocalUrl,
  dishCoverRemoteUrl,
  /** @deprecated 使用 dishCoverLocalUrl */
  dishCoverUrl: dishCoverLocalUrl,
  resolveCoverUrls
}
