const { DISH_COVER_EXT } = require('./constants.js')
const { packageFolderForRecipe } = require('./recipe-shard.js')

/** 与 scripts/bundle-recipes.mjs 同源；本地缺图时可作封面回退（需在小程序后台配置 downloadFile 合法域名） */
const REMOTE_COVER_BASE =
  'https://king-jingxiang.github.io/HowToCook/images/dishes'

function safeImageFileName(name) {
  return String(name).replace(/[/\\?*:|"<>]/g, '_')
}

/** 封面路径与 recipe 分片一致；体积见 scripts/compress-dish-images.mjs */
function dishCoverUrl(categoryKey, name) {
  const seg = safeImageFileName(name)
  const ext = DISH_COVER_EXT === 'webp' ? 'webp' : 'jpeg'
  const folder = packageFolderForRecipe(categoryKey, name)
  return `/${folder}/images/dishes/${categoryKey}/${seg}.${ext}`
}

/** 官方图床 JPEG；路径规则与 bundle 脚本一致 */
function dishCoverRemoteUrl(categoryKey, name) {
  const seg = safeImageFileName(name)
  return `${REMOTE_COVER_BASE}/${categoryKey}/${encodeURIComponent(seg)}.jpeg`
}

module.exports = { dishCoverUrl, dishCoverRemoteUrl, safeImageFileName }
