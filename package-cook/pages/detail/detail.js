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
    qty: 1
  },

  onLoad(query) {
    const name = decodeURIComponent(query.name || '')
    const categoryKey = decodeURIComponent(query.categoryKey || '')
    const dishes = Array.isArray(catalog.dishes) ? catalog.dishes : []
    const hit = dishes.find(
      d => d.name === name && d.categoryKey === categoryKey
    )
    const categoryLabel = hit ? hit.categoryLabel : ''
    const cart = readCart()
    const line = cart.find(
      x => x.name === name && x.categoryKey === categoryKey
    )
    const qty = Math.max(1, line ? line.servings : 1)

    const cover = resolveCoverUrls(categoryKey, name)
    // remote：立刻挂图床；local：等分包就绪后再挂，避免 image 500
    const earlyCover = DISH_COVER_MODE === 'remote'

    this.setData({
      name,
      categoryKey,
      categoryLabel,
      qty,
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
    const { name, categoryKey } = this.data
    if (!name) return
    const line = readCart().find(
      x => x.name === name && x.categoryKey === categoryKey
    )
    const next = Math.max(1, line ? line.servings : 1)
    if (next !== this.data.qty) {
      this.setData({ qty: next })
    }
  },

  /** 拉起菜谱分包（本地封面与正文同包），页面只展示封面 */
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

  dec() {
    this.setData({ qty: Math.max(1, this.data.qty - 1) })
  },

  inc() {
    this.setData({ qty: this.data.qty + 1 })
  },

  applyQty() {
    const { name, categoryKey, categoryLabel, qty } = this.data
    setServings(getApp(), { name, categoryKey, categoryLabel }, qty)
    wx.showToast({ title: '已更新菜单', icon: 'success' })
  }
})
