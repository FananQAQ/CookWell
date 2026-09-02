// 页面在 package-cook；菜谱正文/封面在 package-recipes/*。封面策略见 DISH_COVER_MODE。
module.exports = {
  CART_KEY: 'cookwell_cart',
  MENU_HISTORY_KEY: 'cookwell_menu_history',

  /**
   * 封面策略
   * - local：本地分包 webp 优先（约 25KB）；远程图床 JPEG 单张可能 >600KB，仅作回退
   * - remote：图床 URL 立刻请求；真机需配置 downloadFile 合法域名
   */
  DISH_COVER_MODE: 'local',

  /** 本地封面扩展名；与 scripts/compress-dish-images.mjs --webp 一致 */
  DISH_COVER_EXT: 'webp',

  /**
   * 远程封面根地址（作本地失败时的回退）。
   * 真机需配置 downloadFile 合法域名：king-jingxiang.github.io
   */
  REMOTE_COVER_BASE:
    'https://king-jingxiang.github.io/HowToCook/images/dishes'
}
