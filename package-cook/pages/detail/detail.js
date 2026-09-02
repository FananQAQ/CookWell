const catalog = require('../../../data/dishes.js')
const { resolveCoverUrls } = require('../../../utils/dish-image.js')
const {
  ensureRecipePackage,
  isRecipePackageReady
} = require('../../../utils/recipe-package.js')
const { readCart, setServings } = require('../../../utils/cart-store.js')

Page({
  data: {
    name: '',
    categoryKey: '',
    categoryLabel: '',
    coverUrl: '',
    _coverFallback: '',
    coverReady: false,
    coverFailed: false,
    err: '',
    qty: 1,
    inCart: false,
    showAddBar: true,
    showQtySheet: false,
    draftQty: 1
  },

  onLoad(query) {
    const name = decodeURIComponent(query.name || '')
    const categoryKey = decodeURIComponent(query.categoryKey || '')
    const showAddBar = query.from !== 'menu'
    // 列表页已 preload 时带 warm=1（包与解码更热），仍等 bindload 再显示，避免长图自上而下刷出
    const warm = query.warm === '1'
    const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
    const hit = dishes.find(
      d => d.name === name && d.categoryKey === categoryKey
    )
    const categoryLabel = hit ? hit.categoryLabel : ''
    const { qty, inCart } = this.readCartLine(name, categoryKey)
    const cover = resolveCoverUrls(categoryKey, name)

    this._pendingCover = cover
    this._pkgReady = isRecipePackageReady(categoryKey, name) || warm
    this._retryingPkg = false
    this._gone = false

    this.setData({
      name,
      categoryKey,
      categoryLabel,
      qty,
      inCart,
      showAddBar,
      coverUrl: cover.primary,
      _coverFallback: cover.fallback,
      coverReady: false,
      coverFailed: false,
      err: ''
    })
    wx.setNavigationBarTitle({ title: name || '菜品详情' })

    if (!this._pkgReady) {
      ensureRecipePackage(categoryKey, name)
        .then(() => {
          if (this._gone) return
          this._pkgReady = true
          if (this.data.coverFailed || !this.data.coverUrl) {
            this.reloadLocalCover()
          }
        })
        .catch(e => console.warn('ensureRecipePackage', e))
    }
  },

  onUnload() {
    this._gone = true
  },

  onShow() {
    this.syncCartState()
  },

  readCartLine(name, categoryKey) {
    const line = readCart().find(
      x => x.name === name && x.categoryKey === categoryKey
    )
    if (!line) return { qty: 1, inCart: false }
    return { qty: Math.max(1, line.servings), inCart: true }
  },

  syncCartState() {
    const { name, categoryKey } = this.data
    if (!name) return
    const { qty, inCart } = this.readCartLine(name, categoryKey)
    if (qty !== this.data.qty || inCart !== this.data.inCart) {
      this.setData({ qty, inCart })
    }
  },

  onCoverLoad() {
    if (!this.data.coverReady) {
      this.setData({ coverReady: true })
    }
  },

  reloadLocalCover() {
    const cover = this._pendingCover
    if (!cover || !cover.primary) return
    this.setData({ coverUrl: '', coverReady: false, coverFailed: false })
    setTimeout(() => {
      if (this._gone) return
      this.setData({
        coverUrl: cover.primary,
        _coverFallback: cover.fallback,
        coverFailed: false
      })
    }, 16)
  },

  onImgErr() {
    const cover = this._pendingCover
    const { coverUrl, _coverFallback } = this.data

    if (!this._pkgReady && cover && cover.primary && !this._retryingPkg) {
      this._retryingPkg = true
      ensureRecipePackage(this.data.categoryKey, this.data.name)
        .then(() => {
          this._pkgReady = true
          this._retryingPkg = false
          this.reloadLocalCover()
        })
        .catch(() => {
          this._retryingPkg = false
          if (_coverFallback && coverUrl !== _coverFallback) {
            this.setData({
              coverUrl: _coverFallback,
              _coverFallback: '',
              coverReady: false
            })
          } else {
            this.setData({ coverUrl: '', coverFailed: true, coverReady: false })
          }
        })
      return
    }

    if (_coverFallback && coverUrl !== _coverFallback) {
      this.setData({
        coverUrl: _coverFallback,
        _coverFallback: '',
        coverReady: false
      })
      return
    }
    this.setData({ coverUrl: '', coverFailed: true, coverReady: false })
  },

  openQtySheet() {
    this.setData({
      showQtySheet: true,
      draftQty: this.data.inCart ? this.data.qty : 1
    })
  },

  closeQtySheet() {
    this.setData({ showQtySheet: false })
  },

  noop() {},

  dec() {
    this.setData({ draftQty: Math.max(1, this.data.draftQty - 1) })
  },

  inc() {
    this.setData({ draftQty: this.data.draftQty + 1 })
  },

  confirmQty() {
    const { name, categoryKey, categoryLabel, draftQty, inCart } = this.data
    const qty = Math.max(1, draftQty)
    setServings(getApp(), { name, categoryKey, categoryLabel }, qty)
    this.setData({ qty, inCart: true, showQtySheet: false })
    wx.showToast({
      title: inCart ? '已更新份数' : '已加入菜单',
      icon: 'success'
    })
  },

  removeFromCart() {
    const { name, categoryKey, categoryLabel } = this.data
    setServings(getApp(), { name, categoryKey, categoryLabel }, 0)
    this.setData({
      inCart: false,
      qty: 1,
      showQtySheet: false
    })
    wx.showToast({ title: '已移出菜单', icon: 'none' })
  }
})
