const {
  readMenuHistory,
  updateMenuTitle,
  deleteMenuRecord
} = require('../../../utils/cart-store.js')
const { preloadDishCover } = require('../../../utils/cover-preload.js')

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
    record: null,
    dateText: ''
  },

  onLoad(query) {
    this.menuId = decodeURIComponent(query.id || '')
    this.loadRecord()
  },

  onShow() {
    this.loadRecord()
  },

  loadRecord() {
    const id = this.menuId
    const list = readMenuHistory()
    const hit = list.find(x => x.id === id)
    if (hit) {
      wx.setNavigationBarTitle({ title: hit.title || '菜单详情' })
    }
    const record = hit
      ? {
          ...hit,
          items: (hit.items || []).map(it => ({
            ...it,
            id: it.id || `${it.categoryKey}::${it.name}`
          }))
        }
      : null
    this.setData({
      record,
      dateText: record ? formatLocal(record.createdAt) : ''
    })
  },

  renameRecord() {
    const rec = this.data.record
    if (!rec) return
    wx.showModal({
      title: '编辑菜单名称',
      editable: true,
      placeholderText: '输入新名称',
      content: rec.title || '',
      success: res => {
        if (!res.confirm) return
        const next = (res.content != null ? String(res.content) : '').trim()
        if (!next) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        if (!updateMenuTitle(getApp(), rec.id, next)) {
          wx.showToast({ title: '保存失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已保存', icon: 'success' })
        this.loadRecord()
      }
    })
  },

  deleteRecord() {
    const rec = this.data.record
    if (!rec) return
    wx.showModal({
      title: '删除菜单',
      content: '确定删除该菜单吗？合并清单中的购买勾选也会清除。',
      confirmText: '删除',
      confirmColor: '#c45c26',
      success: res => {
        if (!res.confirm) return
        deleteMenuRecord(getApp(), rec.id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      }
    })
  },

  goSummary() {
    const id = this.data.record && this.data.record.id
    if (!id) return
    wx.navigateTo({
      url: `../summary/summary?source=saved&id=${encodeURIComponent(id)}`
    })
  },

  openDetail(e) {
    const { name, cat } = e.currentTarget.dataset
    if (!name || !cat || this._openingDetail) return
    this._openingDetail = true
    let finished = false
    const go = warm => {
      if (finished) return
      finished = true
      this._openingDetail = false
      clearTimeout(timer)
      wx.navigateTo({
        url: `../detail/detail?name=${encodeURIComponent(
          name
        )}&categoryKey=${encodeURIComponent(cat)}&from=menu${
          warm ? '&warm=1' : ''
        }`
      })
    }
    const timer = setTimeout(() => go(false), 1200)
    preloadDishCover(cat, name)
      .then(() => go(true))
      .catch(() => go(false))
  }
})
