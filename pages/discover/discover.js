const catalog = require('../../data/dishes.js')
const {
  readCart,
  addOrIncCart,
  writeCart,
  saveMenuRecord,
  setServings
} = require('../../utils/cart-store.js')

const ALL_KEY = '__all__'
const INITIAL_CATEGORIES = [{ key: ALL_KEY, label: '全部' }].concat(
  Array.isArray(catalog.categories) ? catalog.categories : []
)
const DISH_LIST = Array.isArray(catalog.dishes) ? catalog.dishes : []

function scheduleAfterPaint(cb) {
  if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') {
    wx.nextTick(cb)
  } else {
    setTimeout(cb, 0)
  }
}

function safeBottomPx(wi) {
  return (
    (wi.safeAreaInsets && Number(wi.safeAreaInsets.bottom)) ||
    (wi.safeArea &&
      Number(wi.screenHeight) - Number(wi.safeArea.bottom)) ||
    0
  )
}

/** 估算兜底：TabBar 页 windowHeight 一般已不含底部 Tab，勿再减一大截 tabReserve，否则下方会露出整页米色底 */
function computeListHeightPx(wi, statusBarHeight, navContentHeight) {
  const ww = Math.max(280, Number(wi.windowWidth) || 375)
  const wh = Math.max(400, Number(wi.windowHeight) || 667)
  const rpx = n => (n * ww) / 750
  const navTop =
    Math.max(0, Number(statusBarHeight) || 20) +
    Math.max(32, Number(navContentHeight) || 44)
  const sb = safeBottomPx(wi)
  const aboveList = rpx(400)
  const pagePad = rpx(8) + Math.max(0, sb)
  const h = Math.floor(wh - navTop - aboveList - pagePad - 8)
  return Math.max(200, Math.min(h, wh - navTop - 64))
}

Page({
  data: {
    categories: INITIAL_CATEGORIES,
    activeCategory: ALL_KEY,
    keyword: '',
    filtered: [],
    cart: [],
    cartCount: 0,
    showCart: false,
    listHeightPx: 400,
    indexHint: '本地索引 · ' + DISH_LIST.length + ' 道菜',
    statusBarHeight: 20,
    navContentHeight: 44
  },

  onLoad() {
    this.updateLayout()
    this.applyFilter()
  },

  onReady() {
    this.updateLayout()
    scheduleAfterPaint(() => this.measureListHeight())
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      const bar = this.getTabBar()
      if (bar && typeof bar.setData === 'function') {
        bar.setData({ selected: 0 })
      }
    }
    try {
      const app = getApp()
      if (app && app.syncCartFromStorage) {
        app.syncCartFromStorage()
      }
    } catch (e) {}
    this.updateLayout()
    this.applyFilter()
    this.refreshCart()
  },

  updateLayout() {
    try {
      const wi =
        typeof wx.getWindowInfo === 'function'
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync()
      const statusBarHeight = Math.min(
        54,
        Math.max(20, Number(wi.statusBarHeight) || 20)
      )
      let navContentHeight = 44
      try {
        const menu = wx.getMenuButtonBoundingClientRect()
        const top = Number(menu.top)
        const mh = Number(menu.height)
        const menuSane =
          Number.isFinite(top) &&
          Number.isFinite(mh) &&
          mh > 0 &&
          mh <= 80 &&
          top >= 0 &&
          top < 200
        if (menuSane) {
          const raw = (top - statusBarHeight) * 2 + mh
          navContentHeight = Math.max(32, Math.min(56, raw))
        }
      } catch (e2) {}
      if (!Number.isFinite(navContentHeight) || navContentHeight < 32) {
        navContentHeight = 44
      }
      if (navContentHeight > 64) {
        navContentHeight = 44
      }
      const listHeightPx = computeListHeightPx(
        wi,
        statusBarHeight,
        navContentHeight
      )
      this.setData(
        {
          statusBarHeight,
          navContentHeight,
          listHeightPx
        },
        () => {
          scheduleAfterPaint(() => this.measureListHeight())
        }
      )
    } catch (e) {
      this.setData({ listHeightPx: 420 })
    }
  },

  /** 按分类条底边到窗口底边精确铺满，消除 Tab 上方大块空米色区 */
  measureListHeight() {
    wx.createSelectorQuery()
      .in(this)
      .select('.chips')
      .boundingClientRect()
      .exec(res => {
        const rect = res && res[0]
        let wi
        try {
          wi =
            typeof wx.getWindowInfo === 'function'
              ? wx.getWindowInfo()
              : wx.getSystemInfoSync()
        } catch (e) {
          wi = { windowHeight: 667 }
        }
        const winH = Math.max(400, Number(wi.windowHeight) || 667)
        const bottom = rect && Number(rect.bottom)
        let listH
        // Tab 页 windowHeight 已是「导航栏下、Tab 上」的视口高度，勿再减 safeBottom，否则会多出一条米色缝
        if (Number.isFinite(bottom) && bottom > 0 && bottom < winH + 2) {
          listH = Math.floor(winH - bottom - 2)
        } else {
          listH = computeListHeightPx(
            wi,
            this.data.statusBarHeight,
            this.data.navContentHeight
          )
        }
        this.setData({
          listHeightPx: Math.max(200, Math.min(listH, winH))
        })
      })
  },

  applyFilter() {
    const { activeCategory, keyword } = this.data
    const kw = (keyword || '').trim()
    let list = DISH_LIST
    if (activeCategory !== ALL_KEY) {
      list = list.filter(d => d.categoryKey === activeCategory)
    }
    if (kw) {
      list = list.filter(d => d.name.includes(kw))
    }
    const filtered = list.map(d => ({
      name: d.name,
      categoryKey: d.categoryKey,
      categoryLabel: d.categoryLabel,
      _k: `${d.categoryKey}::${d.name}`
    }))
    this.setData({ filtered })
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  onPickCategory(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeCategory: key })
    this.applyFilter()
  },

  openDetail(e) {
    const { name, cat } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/package-cook/pages/detail/detail?name=${encodeURIComponent(name)}&categoryKey=${encodeURIComponent(cat)}`
    })
  },

  openDetailFromCart(e) {
    const { name, cat } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/package-cook/pages/detail/detail?name=${encodeURIComponent(name)}&categoryKey=${encodeURIComponent(cat)}`
    })
  },

  openCart() {
    this.setData({ showCart: true })
  },

  closeCart() {
    this.setData({ showCart: false })
  },

  noop() {},

  refreshCart() {
    const cart = readCart()
    // 角标按菜品种数：3 道菜各 2 份 → 显示 3，不是 6
    this.setData({ cart, cartCount: cart.length })
  },

  changeQty(e) {
    const { name, cat, d } = e.currentTarget.dataset
    const delta = Number(d) || 0
    addOrIncCart(getApp(), { name, categoryKey: cat }, delta)
    this.refreshCart()
  },

  removeCartItem(e) {
    const { name, cat } = e.currentTarget.dataset
    setServings(getApp(), { name, categoryKey: cat }, 0)
    this.refreshCart()
  },

  clearCart() {
    writeCart([])
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.cart = []
    }
    this.refreshCart()
  },

  goSummary() {
    this.closeCart()
    wx.navigateTo({ url: '/package-cook/pages/summary/summary?source=cart' })
  },

  submitMenu() {
    const cart = readCart()
    if (!cart.length) return
    saveMenuRecord(getApp(), { items: cart })
    writeCart([])
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.cart = []
    }
    this.refreshCart()
    this.closeCart()
    wx.showToast({ title: '已保存到「我的菜单」', icon: 'success' })
  }
})
