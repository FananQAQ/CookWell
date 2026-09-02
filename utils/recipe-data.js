/**
 * 菜谱正文异步加载。路径须为「相对本文件」：
 * require.async('/package-recipes/...') 会被错拼到 utils/ 下；
 * 应使用 ../package-recipes/...（本文件在 utils/ 下）。
 */
const {
  shardMemoryKey,
  SHARD_COUNT,
  hashShard
} = require('./recipe-shard.js')

const catCache = {}
const catLoading = {}

function requireRecipeModule(categoryKey, name) {
  switch (categoryKey) {
    case 'aquatic':
      return require.async('../package-recipes/aquatic/recipes/aquatic.js')
    case 'breakfast':
      return require.async('../package-recipes/breakfast/recipes/breakfast.js')
    case 'condiment':
      return require.async('../package-recipes/condiment/recipes/condiment.js')
    case 'dessert':
      return require.async('../package-recipes/dessert/recipes/dessert.js')
    case 'drink':
      return require.async('../package-recipes/drink/recipes/drink.js')
    case 'soup':
      return require.async('../package-recipes/soup/recipes/soup.js')
    case 'semi-finished':
      return require.async(
        '../package-recipes/semi-finished/recipes/semi-finished.js'
      )
    case 'meat_dish': {
      const s = hashShard(name, SHARD_COUNT.meat_dish)
      switch (s) {
        case 0:
          return require.async('../package-recipes/meat-0/recipes/meat_dish.js')
        case 1:
          return require.async('../package-recipes/meat-1/recipes/meat_dish.js')
        case 2:
          return require.async('../package-recipes/meat-2/recipes/meat_dish.js')
        default:
          return require.async('../package-recipes/meat-3/recipes/meat_dish.js')
      }
    }
    case 'staple': {
      const s = hashShard(name, SHARD_COUNT.staple)
      return s === 0
        ? require.async('../package-recipes/staple-0/recipes/staple.js')
        : require.async('../package-recipes/staple-1/recipes/staple.js')
    }
    case 'vegetable_dish': {
      const s = hashShard(name, SHARD_COUNT.vegetable_dish)
      return s === 0
        ? require.async('../package-recipes/veg-0/recipes/vegetable_dish.js')
        : require.async('../package-recipes/veg-1/recipes/vegetable_dish.js')
    }
    default:
      return Promise.reject(new Error('未知分类: ' + categoryKey))
  }
}

function loadCatTable(categoryKey, name) {
  if (!categoryKey) {
    return Promise.reject(new Error('missing categoryKey'))
  }
  const memKey = shardMemoryKey(categoryKey, name)
  if (catCache[memKey]) {
    return Promise.resolve(catCache[memKey])
  }
  if (catLoading[memKey]) {
    return catLoading[memKey]
  }
  catLoading[memKey] = requireRecipeModule(categoryKey, name)
    .then(mod => {
      const t = mod && (mod.default !== undefined ? mod.default : mod)
      catCache[memKey] = t
      delete catLoading[memKey]
      return t
    })
    .catch(err => {
      delete catLoading[memKey]
      return Promise.reject(err)
    })
  return catLoading[memKey]
}

function getRecipeMarkdownAsync(categoryKey, name) {
  return loadCatTable(categoryKey, name).then(t => {
    if (!t || typeof t !== 'object') return ''
    const md = t[name]
    return typeof md === 'string' ? md : ''
  })
}

module.exports = { loadCatTable, getRecipeMarkdownAsync }
