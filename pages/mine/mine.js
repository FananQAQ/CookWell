const { readMenuHistory } = require('../../utils/cart-store.js')

function formatLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = n => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`
}

Page({
  data: {
    list: []
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      const bar = this.getTabBar()
      if (bar && typeof bar.setData === 'function') {
        bar.setData({ selected: 1 })
      }
    }
    const app = getApp()
    if (app && app.syncMenuHistoryFromStorage) {
      app.syncMenuHistoryFromStorage()
    }
    const raw = readMenuHistory()
    const list = raw.map(r => {
      const items = r.items || []
      const servings = items.reduce((s, x) => s + x.servings, 0)
      return {
        id: r.id,
        title: r.title,
        dateText: formatLocal(r.createdAt),
        dishCount: items.length,
        servings
      }
    })
    this.setData({ list })
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/package-cook/pages/menu-detail/menu-detail?id=${encodeURIComponent(id)}`
    })
  }
})
