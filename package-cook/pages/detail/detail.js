const catalog = require('../../../data/dishes.js')
const { loadMarkdown } = require('../../utils/md-cache.js')
const { resolveCoverUrls } = require('../../../utils/dish-image.js')
const { DISH_COVER_MODE } = require('../../../utils/constants.js')
const { readCart, setServings } = require('../../../utils/cart-store.js')

Page({
  data: {
    name: '',
    categoryKey: '',
    categoryLabel: '',
    coverUrl: '',
    _coverFallback: '',
    coverFailed: false,
    loading: true,
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
    const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
    const hit = dishes.find(
      d => d.name === name && d.categoryKey === categoryKey
    )
    const categoryLabel = hit ? hit.categoryLabel : ''
    const { qty, inCart } = this.readCartLine(name, categoryKey)

    const cover = resolveCoverUrls(categoryKey, name)
    const earlyCover = DISH_COVER_MODE === 'remote'

    this.setData({
      name,
      categoryKey,
      categoryLabel,
      qty,
      inCart,
      showAddBar,
      coverUrl: earlyCover ? cover.primary : '',
      _coverFallback: cover.fallback,
      coverFailed: false,
      loading: true,
      err: ''
    })
    this._pendingCover = cover
    wx.setNavigationBarTitle({ title: name || '菜品详情' })
    this.loadCover()
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

  loadCover() {
    const { categoryKey, name } = this.data
    this.setData({ loading: true, err: '' })

    loadMarkdown(categoryKey, name)
      .then(() => {
        const cover = this._pendingCover || resolveCoverUrls(categoryKey, name)
        const patch = { loading: false, err: '' }
        if (!this.data.coverUrl && cover.primary) {
          patch.coverUrl = cover.primary
          patch._coverFallback = cover.fallback
          patch.coverFailed = false
        }
        this.setData(patch)
      })
      .catch(e => {
        console.error('loadCover', e)
        const cover = this._pendingCover || resolveCoverUrls(categoryKey, name)
        const patch = {
          loading: false,
          err: (e && (e.message || e.errMsg)) || '加载失败'
        }
        if (!this.data.coverUrl && cover.fallback) {
          patch.coverUrl = cover.fallback
          patch._coverFallback = ''
          patch.err = ''
        }
        this.setData(patch)
      })
  },

  onImgErr() {
    const { coverUrl, _coverFallback } = this.data
    if (_coverFallback && coverUrl !== _coverFallback) {
      this.setData({ coverUrl: _coverFallback, _coverFallback: '' })
      return
    }
    this.setData({ coverUrl: '', coverFailed: true })
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
