// 页面在 package-cook；正文与封面按类在 package-r-<categoryKey>。无需 request 域名。
module.exports = {
  CART_KEY: 'cookwell_cart',
  MENU_HISTORY_KEY: 'cookwell_menu_history',
  MD_CACHE_PREFIX: 'cookwell_md_v1_',
  /**
   * 封面文件扩展名。'webp' 比 jpeg 通常再小 25%～40%（需先跑压缩脚本生成 webp）。
   * 推荐：npm run compress:dishes:webp 后改为 'webp'；未转换前保持 'jpeg'。
   */
  DISH_COVER_EXT: 'jpeg',
  /**
   * 详情页封面先试哪一种：'remote' 用图床（未执行 bundle 配图时不请求本地，避免控制台 500）；
   * 已打包本地图且要离线时改为 'local'。
   */
  DISH_COVER_PRIMARY: 'remote'
}
