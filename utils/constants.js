// 页面在 package-cook；菜谱正文/封面在 package-recipes/*。封面策略见 DISH_COVER_MODE。
module.exports = {
  CART_KEY: 'cookwell_cart',
  MENU_HISTORY_KEY: 'cookwell_menu_history',

  /**
   * 封面策略
   * - local：分包本地图优先（正文与封面同包，分包下载完成后即可显示，不依赖 GitHub）
   * - remote：图床 URL 立刻显示；真机需配置 downloadFile 合法域名
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
