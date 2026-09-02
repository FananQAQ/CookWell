const { readCart, readMenuHistory } = require('../../../utils/cart-store.js')
const { loadMarkdown } = require('../../utils/md-cache.js')
const { runPool } = require('../../../utils/promise-pool.js')
const { parseHowToCookMarkdown } = require('../../../utils/howto-parser.js')
const {
  calcIngredientLines,
  buildMergedList
} = require('../../../utils/aggregate.js')
const {
  readMergedChecked,
  writeMergedChecked,
  stableMergedEntryId
} = require('../../../utils/summary-checked.js')
const { resolveCoverUrls } = require('../../../utils/dish-image.js')
const { ensureRecipePackages, ensureRecipePackage } = require('../../../utils/recipe-package.js')
const { preloadDishCovers } = require('../../../utils/cover-preload.js')

Page({
  data: {
    viewMode: 'byDish',
    loading: true,
    mergedLoading: false,
    err: '',
    byDish: [],
    merged: [],
    items: [],
    dishIndex: 0,
    navScrollInto: ''
  },

  onLoad(query) {
    this.source = query.source === 'saved' ? 'saved' : 'cart'
    this.recordId = query.id ? decodeURIComponent(query.id) : ''
    this.checkedMap = readMergedChecked(this.source, this.recordId)
    this._loadToken = 0
    this._mergedErr = ''
    this.bootstrap()
  },

  onShow() {
    if (this.source === 'cart') {
      this.checkedMap = readMergedChecked(this.source, this.recordId)
      this._mergedErr = ''
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
    this.setData({ items, dishIndex: 0, navScrollInto: '' })
    if (!items.length) {
      this.setData({
        loading: false,
        mergedLoading: false,
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
    if (!m) return
    const patch = { viewMode: m }
    if (m === 'merged' && this._mergedErr && !(this.data.merged || []).length) {
      patch.err = this._mergedErr
    } else if (m === 'byDish' && this.data.byDish && this.data.byDish.length) {
      patch.err = ''
    }
    this.setData(patch)
  },

  onNavTap(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (!Number.isFinite(i) || i < 0) return
    this.setData({
      dishIndex: i,
      navScrollInto: `nav-${i}`
    })
  },

  onSwiperChange(e) {
    const i = Number(e.detail.current)
    if (!Number.isFinite(i)) return
    this.setData({
      dishIndex: i,
      navScrollInto: `nav-${i}`
    })
  },

  onCoverLoad(e) {
    const i = Number(e.currentTarget.dataset.i)
    const list = this.data.byDish || []
    if (!Number.isFinite(i) || !list[i] || list[i].coverReady) return
    const byDish = list.map((row, idx) =>
      idx === i ? { ...row, coverReady: true } : row
    )
    this.setData({ byDish })
  },

  onCoverErr(e) {
    const i = Number(e.currentTarget.dataset.i)
    const list = this.data.byDish || []
    const item = list[i]
    if (!item) return

    // 先等分包再试本地；远程 JPEG 往往更大，作为最后手段
    if (!item._pkgTried) {
      const byDish = list.map((row, idx) =>
        idx === i ? { ...row, _pkgTried: true } : row
      )
      this.setData({ byDish })
      ensureRecipePackage(item.categoryKey, item.name)
        .then(() => {
          const cur = (this.data.byDish || [])[i]
          if (!cur || cur.name !== item.name) return
          const next = (this.data.byDish || []).map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  coverUrl: '',
                  coverFallback: row.coverFallback
                }
              : row
          )
          this.setData({ byDish: next })
          setTimeout(() => {
            const latest = (this.data.byDish || []).map((row, idx) => {
              if (idx !== i) return row
              const cover = resolveCoverUrls(row.categoryKey, row.name)
              return {
                ...row,
                coverUrl: cover.primary,
                coverFallback: cover.fallback,
                coverReady: false
              }
            })
            this.setData({ byDish: latest })
          }, 16)
        })
        .catch(() => {
          if (!item.coverFallback) return
          const next = (this.data.byDish || []).map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  coverUrl: row.coverFallback,
                  coverFallback: ''
                }
              : row
          )
          this.setData({ byDish: next })
        })
      return
    }

    if (!item.coverFallback) return
    if (item.coverUrl === item.coverFallback) return
    const byDish = list.map((row, idx) =>
      idx === i
        ? { ...row, coverUrl: row.coverFallback, coverFallback: '' }
        : row
    )
    this.setData({ byDish })
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

  buildByDish(items) {
    return items.map(it => {
      const cover = resolveCoverUrls(it.categoryKey, it.name)
      return {
        name: it.name,
        categoryKey: it.categoryKey,
        categoryLabel: it.categoryLabel || '',
        servings: it.servings,
        coverUrl: cover.primary,
        coverFallback: cover.fallback,
        coverReady: false
      }
    })
  },

  loadAll(items) {
    const token = ++this._loadToken
    this._mergedErr = ''
    const byDish = this.buildByDish(items)

    // 菜品图结构先出；图本身等 bindload 再淡入，避免自上而下「刷出来」
    this.setData({
      loading: false,
      err: '',
      byDish,
      merged: [],
      mergedLoading: true,
      dishIndex: 0,
      navScrollInto: byDish.length ? 'nav-0' : ''
    })

    preloadDishCovers(items, 3).catch(() => {})

    ensureRecipePackages(items).catch(e => {
      console.warn('ensureRecipePackages', e)
    })

    const concurrency = 3
    runPool(items, concurrency, it =>
      loadMarkdown(it.categoryKey, it.name).then(md => ({ it, md }))
    )
      .then(rows => {
        if (token !== this._loadToken) return
        const mergeInputs = []
        rows.forEach(({ it, md }) => {
          const p = parseHowToCookMarkdown(md)
          const calcLines = calcIngredientLines(p.calc, it.servings)
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
        this.setData({ merged, mergedLoading: false, err: '' })
        this._mergedErr = ''
      })
      .catch(e => {
        if (token !== this._loadToken) return
        this._mergedErr = e.message || '汇总失败'
        const patch = { mergedLoading: false, merged: [] }
        if (this.data.viewMode === 'merged') {
          patch.err = this._mergedErr
        }
        this.setData(patch)
      })
  }
})
