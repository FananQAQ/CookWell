const catalog = require('../../../data/dishes.js')
const { loadMarkdown } = require('../../utils/md-cache.js')
const {
  parseHowToCookMarkdown,
  bulletLines
} = require('../../../utils/howto-parser.js')
const { dishCoverUrl, dishCoverRemoteUrl } = require('../../../utils/dish-image.js')
const { DISH_COVER_PRIMARY } = require('../../../utils/constants.js')
const { readCart, setServings } = require('../../../utils/cart-store.js')
const { substituteServings } = require('../../../utils/aggregate.js')

Page({
  data: {
    name: '',
    categoryKey: '',
    categoryLabel: '',
    coverUrl: '',
    /** 与当前 coverUrl 相反的备用地址（本地↔网络） */
    _coverFallback: '',
    loading: true,
    err: '',
    title: '',
    difficulty: '',
    toolLines: [],
    calcText: '',
    stepLines: [],
    extraLines: [],
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
    const qty = line ? line.servings : 1
    this._calcSection = ''
    this.setData({
      name,
      categoryKey,
      categoryLabel,
      qty: Math.max(1, qty)
    })
    wx.setNavigationBarTitle({ title: name || '菜品详情' })
    // 封面与正文在同一分包：若过早设 coverUrl，<image> 会在分包未下载完时请求，开发工具常报 500
    this.loadBody()
  },

  onShow() {
    const { name, categoryKey } = this.data
    const line = readCart().find(
      x => x.name === name && x.categoryKey === categoryKey
    )
    const q = line ? line.servings : 1
    const next = Math.max(1, q)
    if (next !== this.data.qty) {
      this.setData({
        qty: next,
        calcText: substituteServings(this._calcSection || '', next)
      })
    }
  },

  loadBody() {
    const { categoryKey, name, qty } = this.data
    this.setData({ loading: true, err: '' })
    loadMarkdown(categoryKey, name)
      .then(md => {
        try {
          const p = parseHowToCookMarkdown(md)
          this._calcSection = p.calc
          const toolLines = bulletLines(p.tools)
          const stepLines = bulletLines(p.steps)
          const extraLines = bulletLines(p.extra)
          const local = dishCoverUrl(categoryKey, name)
          const remote = dishCoverRemoteUrl(categoryKey, name)
          const primary =
            DISH_COVER_PRIMARY === 'local' ? local : remote
          const fallback =
            DISH_COVER_PRIMARY === 'local' ? remote : local
          this.setData({
            loading: false,
            title: p.title,
            difficulty: p.difficulty,
            toolLines,
            calcText: substituteServings(p.calc, qty),
            stepLines,
            extraLines,
            coverUrl: primary,
            _coverFallback: fallback
          })
        } catch (pe) {
          console.error('parseHowToCookMarkdown', pe)
          this.setData({
            loading: false,
            err: '菜谱解析失败：' + (pe && pe.message ? pe.message : String(pe))
          })
        }
      })
      .catch(e => {
        const msg =
          (e && (e.message || e.errMsg)) || '加载失败'
        console.error('loadMarkdown', e)
        this.setData({
          loading: false,
          err: msg
        })
      })
  },

  onImgErr() {
    const { coverUrl, _coverFallback } = this.data
    if (_coverFallback && coverUrl !== _coverFallback) {
      this.setData({ coverUrl: _coverFallback })
      return
    }
    this.setData({ coverUrl: '', _coverFallback: '' })
  },

  dec() {
    const q = Math.max(1, this.data.qty - 1)
    this.setData({
      qty: q,
      calcText: substituteServings(this._calcSection || '', q)
    })
  },

  inc() {
    const q = this.data.qty + 1
    this.setData({
      qty: q,
      calcText: substituteServings(this._calcSection || '', q)
    })
  },

  applyQty() {
    const { name, categoryKey, categoryLabel, qty } = this.data
    setServings(getApp(), { name, categoryKey, categoryLabel }, qty)
    wx.showToast({ title: '已更新菜单', icon: 'success' })
  }
})
