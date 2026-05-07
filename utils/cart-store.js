const { CART_KEY, MENU_HISTORY_KEY } = require('./constants.js')

function readCart() {
  try {
    return wx.getStorageSync(CART_KEY) || []
  } catch (e) {
    return []
  }
}

function writeCart(items) {
  wx.setStorageSync(CART_KEY, items)
}

function cartLineId(name, categoryKey) {
  return `${categoryKey}::${name}`
}

function addOrIncCart(app, { name, categoryKey, categoryLabel }, delta) {
  const cart = readCart()
  const id = cartLineId(name, categoryKey)
  const idx = cart.findIndex(
    x => x.name === name && x.categoryKey === categoryKey
  )
  if (idx === -1) {
    if (delta > 0) {
      cart.push({
        id,
        name,
        categoryKey,
        categoryLabel: categoryLabel || '',
        servings: delta
      })
    }
  } else {
    cart[idx].servings += delta
    if (cart[idx].servings <= 0) {
      cart.splice(idx, 1)
    }
  }
  writeCart(cart)
  app.globalData.cart = cart
  return cart
}

function setServings(app, { name, categoryKey, categoryLabel }, servings) {
  const cart = readCart()
  const idx = cart.findIndex(
    x => x.name === name && x.categoryKey === categoryKey
  )
  const n = Math.max(0, Math.floor(Number(servings) || 0))
  if (idx === -1) {
    if (n > 0) {
      cart.push({
        id: cartLineId(name, categoryKey),
        name,
        categoryKey,
        categoryLabel: categoryLabel || '',
        servings: n
      })
    }
  } else {
    if (categoryLabel) cart[idx].categoryLabel = categoryLabel
    if (n <= 0) cart.splice(idx, 1)
    else cart[idx].servings = n
  }
  writeCart(cart)
  app.globalData.cart = cart
  return cart
}

function readMenuHistory() {
  try {
    return wx.getStorageSync(MENU_HISTORY_KEY) || []
  } catch (e) {
    return []
  }
}

function writeMenuHistory(list) {
  wx.setStorageSync(MENU_HISTORY_KEY, list)
}

function saveMenuRecord(app, { title, items }) {
  const list = readMenuHistory()
  const record = {
    id: `m_${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: title || formatMenuTitle(),
    items: JSON.parse(JSON.stringify(items))
  }
  list.unshift(record)
  writeMenuHistory(list)
  app.globalData.menuHistory = list
  return record
}

function formatMenuTitle() {
  const d = new Date()
  const pad = n => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 菜单`
}

function updateMenuTitle(app, id, title) {
  const list = readMenuHistory()
  const idx = list.findIndex(x => x.id === id)
  if (idx === -1) return false
  const t = String(title || '').trim()
  if (!t) return false
  list[idx].title = t.slice(0, 80)
  writeMenuHistory(list)
  if (app && app.globalData) app.globalData.menuHistory = list
  return true
}

function deleteMenuRecord(app, id) {
  const list = readMenuHistory().filter(x => x.id !== id)
  writeMenuHistory(list)
  if (app && app.globalData) app.globalData.menuHistory = list
  try {
    wx.removeStorageSync(`cookwell_merged_chk_${id}`)
  } catch (e) {}
  return true
}

module.exports = {
  readCart,
  writeCart,
  addOrIncCart,
  setServings,
  readMenuHistory,
  writeMenuHistory,
  saveMenuRecord,
  updateMenuTitle,
  deleteMenuRecord,
  cartLineId
}
