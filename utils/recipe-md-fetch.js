/**
 * 生成 Anduin2017/HowToCook 上菜谱 .md 的候选 raw URL（含 data/recipe-md-urls 覆盖）。
 */
const RAW_BASE =
  'https://raw.githubusercontent.com/Anduin2017/HowToCook/master/dishes'
const OVERRIDES = require('../data/recipe-md-urls.js')

function encPath(relFromDishes) {
  return relFromDishes
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/')
}

function candidateMdUrls(categoryKey, name) {
  const e = encodeURIComponent(name)
  const extraRel = OVERRIDES[`${categoryKey}::${name}`] || []
  const extra = extraRel.map(rel => `${RAW_BASE}/${encPath(rel)}`)
  const standard = [
    `${RAW_BASE}/${categoryKey}/${e}/${e}.md`,
    `${RAW_BASE}/${categoryKey}/${e}.md`
  ]
  return [...extra, ...standard]
}

module.exports = { candidateMdUrls, RAW_BASE }
