const { readCart, readMenuHistory } = require('./utils/cart-store.js')

App({
  onLaunch() {
    this.globalData.cart = readCart()
    this.globalData.menuHistory = readMenuHistory()
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
