function substituteServings(calcSection, servings) {
  if (!calcSection) return ''
  return calcSection.replace(/份数/g, String(servings))
}

function formatScaledNumber(n) {
  if (!Number.isFinite(n)) return String(n)
  const r = Math.round(n * 1000) / 1000
  if (Number.isInteger(r)) return String(r)
  return String(r)
}

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 半: 0.5 }

/**
 * 将行内用量按份数放大。用于「每份：奥利奥 6 块」这类未写「* 份数」的菜谱。
 * 已含「份数」占位的行由调用方先替换且不再进入本函数，避免加倍。
 */
function multiplyQuantities(line, factor) {
  if (!factor || factor <= 1) return line
  let s = String(line)

  // 先保护并放大区间，避免后续再把右端数字乘第二次（3-5g ×3 → 9-15g，而非 9-45g）
  const rangeHold = []
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*[-~～到至]\s*(\d+(?:\.\d+)?)/g,
    (_, a, b) => {
      const token = `__RQ${rangeHold.length}__`
      rangeHold.push(
        `${formatScaledNumber(Number(a) * factor)}-${formatScaledNumber(
          Number(b) * factor
        )}`
      )
      return token
    }
  )

  // 阿拉伯数字 + 单位（不用 \b，以免中文单位匹配失败）
  s = s.replace(
    /(\d+(?:\.\d+)?)(\s*)(g|ml|l|kg|克|毫升|升|斤|两|茶匙|汤匙|大勺|小勺|个|颗|根|瓣|片|条|块|只|盒|瓶|袋|支|把|棵|头|朵|串|碗|盘|勺|匙|cm)(?![a-zA-Z0-9])/gi,
    (_, num, sp, unit) =>
      `${formatScaledNumber(Number(num) * factor)}${sp}${unit}`
  )

  // 中文数量：一条 / 一根 / 一块 / 半只
  s = s.replace(
    /(一|二|两|三|四|五|半)(\s*)(条|根|块|个|颗|只|盒|瓶|袋|支|把|棵|头|瓣|片|朵)/g,
    (full, cn, sp, unit) => {
      const base = CN_NUM[cn]
      if (base == null) return full
      return `${formatScaledNumber(base * factor)}${sp || ' '}${unit}`
    }
  )

  rangeHold.forEach((val, i) => {
    s = s.replace(`__RQ${i}__`, val)
  })

  return s
}

function calcIngredientLines(calcSection, servings) {
  const n = Math.max(1, Math.floor(Number(servings) || 1))
  const lines = String(calcSection || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  const out = []
  for (const line of lines) {
    if (/^总量[：:]?$/.test(line)) continue
    if (/^每次制作/.test(line)) continue
    if (/^一份/.test(line)) continue
    if (/^每份[：:]?$/.test(line)) continue
    if (line.startsWith('##')) continue
    if (/^[\*\-•]/.test(line) || /^\d+\.\s/.test(line)) {
      let item = line.replace(/^[\*\-•]\s*/, '').replace(/^\d+\.\s*/, '')
      const hadFenshu = /份数/.test(item)
      item = item.replace(/份数/g, String(n))
      // 「每份」写法没有「* 份数」时，按份数放大用量
      if (!hadFenshu && n > 1) {
        item = multiplyQuantities(item, n)
      }
      out.push(item)
    }
  }
  return out
}

/**
 * 从计算行抽出食材名（去掉用量、括号备注、markdown 噪声）。
 * 支持：大蒜 = 10g / 生抽 5 ml / 大蒜10g / 八角：3个
 */
function mergeKey(line) {
  let s = String(line || '').trim()
  s = s.replace(/^`+|`+$/g, '').replace(/^\*+|\*+$/g, '').trim()
  // 表情等前缀
  s = s.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u, '').trim()

  const eq = s.indexOf('=')
  if (eq > 0) s = s.slice(0, eq).trim()

  const lastStar = s.lastIndexOf('*')
  if (lastStar > 0) {
    const right = s.slice(lastStar + 1).trim()
    if (/^[\d（(份]/.test(right)) s = s.slice(0, lastStar).trim()
  }

  // 中文冒号后多为用量：八角：3个
  s = s.replace(/\s*[:：].*$/, '').trim()
  // 括号备注
  s = s.replace(/[（(][^）)]*[）)]/g, ' ').trim()
  // 空格 + 数字用量
  s = s
    .replace(
      /\s+[\d.~～\-到至\/]+\s*(g|ml|克|毫升|茶匙|汤匙|大勺|小勺|个|颗|根|瓣|片|条|块|只|两|斤|kg|l|撮|适量|cm|毫升).*$/i,
      ''
    )
    .trim()
  // 紧贴数字用量：大蒜10g / 生抽5ml / 奥利奥6块
  s = s
    .replace(
      /[\d.~～]+(g|ml|克|毫升|个|颗|根|瓣|片|条|块|只|两|斤|kg|l|茶匙|汤匙).*$/i,
      ''
    )
    .trim()
  // 中文数量词：一条 / 一根 / 半只 / 两盒（可有空格）
  // 例：昂刺鱼或者沙光鱼一条、香葱 一根
  s = s
    .replace(
      /\s*(一|二|两|三|四|五|六|七|八|九|十|几|半)\s*(条|根|块|个|颗|只|盒|瓶|袋|支|把|棵|头|瓣|片|朵|串|碗|盘|勺|匙)\s*$/u,
      ''
    )
    .trim()
  s = s
    .replace(
      /(一|二|两|三|四|五|六|七|八|九|十|几|半)(条|根|块|个|颗|只|盒|瓶|袋|支|把|棵|头|瓣|片|朵|串|碗|盘)$/u,
      ''
    )
    .trim()
  // 少许 / 适量 / 若干
  s = s.replace(/\s*(少许|适量|若干)\s*$/u, '').trim()
  // 残留空白与尾部标点
  s = s.replace(/[。．.]+$/g, '').replace(/\s+/g, ' ').trim()
  return s
}

/**
 * 同物异名 / 不同刀工 → 统一采购名。
 * 例：蒜片、蒜末、大蒜 → 大蒜；不合并蒜苗、蒜苔（品种不同）。
 */
const INGREDIENT_ALIAS = {
  蒜: '大蒜',
  蒜头: '大蒜',
  蒜瓣: '大蒜',
  蒜片: '大蒜',
  蒜末: '大蒜',
  蒜蓉: '大蒜',
  蒜泥: '大蒜',
  蒜碎: '大蒜',
  大蒜瓣: '大蒜',
  大蒜片: '大蒜',
  大蒜末: '大蒜',
  大蒜蓉: '大蒜',
  大蒜泥: '大蒜',
  独头蒜: '大蒜',

  生姜: '姜',
  姜片: '姜',
  姜丝: '姜',
  姜末: '姜',
  姜蓉: '姜',
  姜泥: '姜',
  姜汁: '姜',
  黄姜: '姜',
  生姜片: '姜',

  葱花: '葱',
  葱段: '葱',
  葱丝: '葱',
  葱末: '葱',
  葱白: '葱',
  小葱: '葱',
  香葱: '葱',
  青葱: '葱',
  大葱: '葱',
  葱叶: '葱',
  小葱花: '葱',

  干辣椒: '辣椒',
  辣椒段: '辣椒',
  辣椒丝: '辣椒',
  辣椒圈: '辣椒',
  红辣椒: '辣椒',
  小米辣: '辣椒',
  小米椒: '辣椒',
  朝天椒: '辣椒',
  辣椒粉: '辣椒面',
  辣椒碎: '辣椒',
  干辣椒段: '辣椒',

  鸡蛋清: '鸡蛋',
  蛋清: '鸡蛋',
  蛋黄: '鸡蛋',
  鸡蛋黄: '鸡蛋',
  蛋: '鸡蛋',

  番茄: '西红柿',
  蕃茄: '西红柿',
  圣女果: '小番茄',

  马铃薯: '土豆',
  洋芋: '土豆',
  土豆丝: '土豆',
  土豆片: '土豆',
  土豆块: '土豆',
  土豆丁: '土豆',

  青椒丝: '青椒',
  青椒片: '青椒',
  青椒丁: '青椒',
  柿子椒: '青椒',
  菜椒: '青椒',
  尖椒: '青椒',

  胡萝卜丝: '胡萝卜',
  胡萝卜片: '胡萝卜',
  胡萝卜丁: '胡萝卜',

  洋葱丝: '洋葱',
  洋葱片: '洋葱',
  洋葱丁: '洋葱',

  五花肉片: '五花肉',
  五花肉丝: '五花肉',
  五花肉丁: '五花肉',
  猪肉丝: '猪肉',
  猪肉片: '猪肉',
  猪肉丁: '猪肉',
  里脊肉丝: '里脊肉',
  里脊肉片: '里脊肉',
  鸡胸肉丝: '鸡胸肉',
  鸡胸肉片: '鸡胸肉',
  鸡胸肉丁: '鸡胸肉',
  牛肉丝: '牛肉',
  牛肉片: '牛肉',
  牛肉丁: '牛肉',

  白砂糖: '白糖',
  细砂糖: '白糖',
  绵白糖: '白糖',
  砂糖: '白糖',

  生粉: '淀粉',
  玉米淀粉: '淀粉',
  土豆淀粉: '淀粉',
  木薯淀粉: '淀粉',
  勾芡粉: '淀粉',

  植物油: '食用油',
  色拉油: '食用油',
  菜籽油: '食用油',
  玉米油: '食用油',
  大豆油: '食用油',
  花生油: '食用油',
  菜油: '食用油',

  清水: '水',
  温水: '水',
  开水: '水',
  热水: '水',
  冷水: '水',
  沸水: '水',

  黄酒: '料酒',
  米酒: '料酒',

  陈醋: '香醋',
  米醋: '香醋',
  镇江香醋: '香醋',

  黑胡椒粉: '黑胡椒',
  白胡椒粉: '白胡椒',
  胡椒粉: '胡椒',

  味精: '鸡精'
}

/** 这些词带「丝/条」等是成品名，不能当刀工后缀剥掉 */
const FORM_STRIP_BLOCKLIST = new Set([
  '粉丝',
  '粉条',
  '面条',
  '挂面',
  '方便面',
  '河粉',
  '米线',
  '宽粉',
  '土豆粉',
  '螺蛳粉',
  '凉皮',
  '蒜苗',
  '蒜苔',
  '蒜薹',
  '蒜黄',
  '葱油',
  '姜糖',
  '豆皮',
  '百叶'
])

const FORM_SUFFIX_RE = /^(.*?)(片|末|丝|丁|块|段|蓉|泥|粒|碎|沫|圈)$/

/** 单字基料也可剥刀工后缀：姜沫→姜 */
const SINGLE_CHAR_BASE = new Set(['姜', '葱', '蒜', '盐', '糖', '油', '醋', '水', '肉', '蛋'])

function stripNotes(name) {
  return String(name || '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function canonicalizeIngredient(rawName) {
  let s = stripNotes(rawName)
  if (!s) return rawName

  if (INGREDIENT_ALIAS[s]) return INGREDIENT_ALIAS[s]
  if (FORM_STRIP_BLOCKLIST.has(s)) return s

  const m = s.match(FORM_SUFFIX_RE)
  if (m && m[1] && m[1].length >= 1) {
    const base = m[1]
    // 仅当整词是成品名（粉丝等）才跳过；黑胡椒碎应剥成黑胡椒
    if (FORM_STRIP_BLOCKLIST.has(s)) return s
    if (INGREDIENT_ALIAS[base]) return INGREDIENT_ALIAS[base]
    if (base.length >= 2 || SINGLE_CHAR_BASE.has(base)) return base
  }

  return s
}

function buildMergedList(dishBlocks) {
  const map = {}
  for (const { dishName, lines } of dishBlocks) {
    for (const line of lines) {
      const rawKey = mergeKey(line)
      const key = canonicalizeIngredient(rawKey)
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push({ dish: dishName, line, rawKey })
    }
  }
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(key => ({ key, entries: map[key] }))
}

module.exports = {
  substituteServings,
  calcIngredientLines,
  multiplyQuantities,
  buildMergedList,
  mergeKey,
  canonicalizeIngredient
}
