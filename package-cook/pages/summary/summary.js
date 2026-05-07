const { readCart, readMenuHistory } = require('../../../utils/cart-store.js')
const { loadMarkdown } = require('../../utils/md-cache.js')
const { runPool } = require('../../../utils/promise-pool.js')
const {
  parseHowToCookMarkdown,
  bulletLines
} = require('../../../utils/howto-parser.js')
const {
  calcIngredientLines,
  buildMergedList
} = require('../../../utils/aggregate.js')
const {
  readMergedChecked,
  writeMergedChecked,
  stableMergedEntryId
} = require('../../../utils/summary-checked.js')

Page({
  data: {
    viewMode: 'byDish',
    loading: true,
    err: '',
    byDish: [],
    merged: [],
    items: []
  },

  onLoad(query) {
    this.source = query.source === 'saved' ? 'saved' : 'cart'
    this.recordId = query.id ? decodeURIComponent(query.id) : ''
    this.checkedMap = readMergedChecked(this.source, this.recordId)
    this.bootstrap()
  },

  onShow() {
    if (this.source === 'cart') {
      this.checkedMap = readMergedChecked(this.source, this.recordId)
      this.bootstrap()
    }
  },

  bootstrap() {
    let items = []
    if (this.source === 'saved') {
      const list = readMenuHistory()
      const r = list.find(x => x.id === this.recordId)
      items = r && r.items ? r.items : []
    } else {
      items = readCart()
    }
    this.setData({ items })
    if (!items.length) {
      this.setData({
        loading: false,
        err: '没有菜品可汇总',
        byDish: [],
        merged: []
      })
      return
    }
    this.loadAll(items)
  },

  setMode(e) {
    const m = e.currentTarget.dataset.m
    if (m) this.setData({ viewMode: m })
  },

  openDetail(e) {
    const { name, cat } = e.currentTarget.dataset
    wx.navigateTo({
      url: `../detail/detail?name=${encodeURIComponent(name)}&categoryKey=${encodeURIComponent(cat)}`
    })
  },

  toggleMergedPurchased(e) {
    if (this.data.viewMode !== 'merged') return
    const id = e.currentTarget.dataset.id
    if (!id) return
    if (!this.checkedMap) this.checkedMap = {}
    if (this.checkedMap[id]) {
      delete this.checkedMap[id]
    } else {
      this.checkedMap[id] = true
    }
    writeMergedChecked(this.source, this.recordId, this.checkedMap)
    const merged = (this.data.merged || []).map(group => ({
      key: group.key,
      entries: (group.entries || []).map(en =>
        en._id === id ? { ...en, purchased: !!this.checkedMap[id] } : en
      )
    }))
    this.setData({ merged })
  },

  loadAll(items) {
    this.setData({ loading: true, err: '' })
    const concurrency = 3
    runPool(items, concurrency, it =>
      loadMarkdown(it.categoryKey, it.name).then(md => ({ it, md }))
    )
      .then(rows => {
        const byDish = []
        const mergeInputs = []
        rows.forEach(({ it, md }) => {
          const p = parseHowToCookMarkdown(md)
          const toolLines = bulletLines(p.tools)
          const calcLines = calcIngredientLines(p.calc, it.servings)
          byDish.push({
            name: it.name,
            categoryKey: it.categoryKey,
            categoryLabel: it.categoryLabel || '',
            servings: it.servings,
            toolLines,
            calcLines
          })
          mergeInputs.push({
            dishName: `${it.name}（×${it.servings}）`,
            lines: calcLines
          })
        })
        const mergedRaw = buildMergedList(mergeInputs)
        const checked = this.checkedMap || {}
        const merged = mergedRaw.map(group => ({
          key: group.key,
          entries: group.entries.map(en => {
            const _id = stableMergedEntryId(group.key, en.dish, en.line)
            return {
              ...en,
              _id,
              purchased: !!checked[_id]
            }
          })
        }))
        this.setData({
          loading: false,
          byDish,
          merged
        })
      })
      .catch(e => {
        this.setData({
          loading: false,
          err: e.message || '汇总失败',
          byDish: [],
          merged: []
        })
      })
  }
})
