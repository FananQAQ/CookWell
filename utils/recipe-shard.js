/**
 * 大类菜谱+配图体积分散到多个分包根目录，避免单包 > 2MB。
 * 与 scripts/bundle-recipes.mjs、reshard 脚本共用同一规则。
 */
const SHARD_COUNT = {
  meat_dish: 4,
  staple: 2,
  vegetable_dish: 2
}

function hashShard(str, n) {
  let h = 0
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) % n
}

/** 分包根目录名（不含前导斜杠），如 package-r-meat-2 */
function packageFolderForRecipe(categoryKey, name) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) return `package-r-${categoryKey}`
  const s = hashShard(name, n)
  if (categoryKey === 'meat_dish') return `package-r-meat-${s}`
  if (categoryKey === 'staple') return `package-r-staple-${s}`
  if (categoryKey === 'vegetable_dish') return `package-r-veg-${s}`
  return `package-r-${categoryKey}`
}

/** 内存/加载去重键：同一分片共用一个 recipe 模块 */
function shardMemoryKey(categoryKey, name) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) return categoryKey
  return `${categoryKey}@${hashShard(name, n)}`
}

module.exports = {
  SHARD_COUNT,
  hashShard,
  packageFolderForRecipe,
  shardMemoryKey
}
