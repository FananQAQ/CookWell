const { readCart, readMenuHistory } = require('./utils/cart-store.js')
const { preloadAllRecipePackages } = require('./utils/recipe-package.js')

App({
  onLaunch() {
    this.globalData.cart = readCart()
    this.globalData.menuHistory = readMenuHistory()
    // 首屏稍后再预下载菜谱分包；本地 webp 约 25KB，缓存后详情几乎秒开
    setTimeout(() => {
      preloadAllRecipePackages({ concurrency: 2 }).catch(() => {})
    }, 600)
  },
  syncCartFromStorage() {
    this.globalData.cart = readCart()
  },
  syncMenuHistoryFromStorage() {
    this.globalData.menuHistory = readMenuHistory()
  },
  globalData: {
    cart: [],
    menuHistory: []
  }
})
