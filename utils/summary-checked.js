/** 合并清单里「已购买」勾选项，按菜单 id 或购物车分别存 */

function storageKey(source, recordId) {
  return source === 'saved' && recordId
    ? `cookwell_merged_chk_${recordId}`
    : 'cookwell_merged_chk__cart'
}

function stableMergedEntryId(groupKey, dish, line) {
  return [groupKey, dish, line].join('\u0001')
}

function readMergedChecked(source, recordId) {
  try {
    const raw = wx.getStorageSync(storageKey(source, recordId))
    return raw && typeof raw === 'object' ? raw : {}
  } catch (e) {
    return {}
  }
}

function writeMergedChecked(source, recordId, map) {
  wx.setStorageSync(storageKey(source, recordId), map)
}

module.exports = {
  storageKey,
  stableMergedEntryId,
  readMergedChecked,
  writeMergedChecked
}
