/**
 * 菜谱数据分包根目录（均在 package-recipes/ 下），大类再分片避免单包 > 2MB。
 * 与 scripts/bundle-recipes.mjs、reshard 脚本共用同一规则。
 */
const RECIPES_ROOT = 'package-recipes'

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

/** 分包叶子目录名，如 aquatic、meat-2 */
function packageLeafForRecipe(categoryKey, name) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) return categoryKey
  const s = hashShard(name, n)
  if (categoryKey === 'meat_dish') return `meat-${s}`
  if (categoryKey === 'staple') return `staple-${s}`
  if (categoryKey === 'vegetable_dish') return `veg-${s}`
  return categoryKey
}

/** 分包根路径（相对项目根），如 package-recipes/meat-2 */
function packageFolderForRecipe(categoryKey, name) {
  return `${RECIPES_ROOT}/${packageLeafForRecipe(categoryKey, name)}`
}

/** 按分片下标得到文件夹（脚本写盘用） */
function packageFolderForShard(categoryKey, shardIndex) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) return `${RECIPES_ROOT}/${categoryKey}`
  if (categoryKey === 'meat_dish') return `${RECIPES_ROOT}/meat-${shardIndex}`
  if (categoryKey === 'staple') return `${RECIPES_ROOT}/staple-${shardIndex}`
  if (categoryKey === 'vegetable_dish') return `${RECIPES_ROOT}/veg-${shardIndex}`
  return `${RECIPES_ROOT}/${categoryKey}`
}

/** 内存/加载去重键：同一分片共用一个 recipe 模块 */
function shardMemoryKey(categoryKey, name) {
  const n = SHARD_COUNT[categoryKey]
  if (!n) return categoryKey
  return `${categoryKey}@${hashShard(name, n)}`
}

module.exports = {
  RECIPES_ROOT,
  SHARD_COUNT,
  hashShard,
  packageLeafForRecipe,
  packageFolderForRecipe,
  packageFolderForShard,
  shardMemoryKey
}
