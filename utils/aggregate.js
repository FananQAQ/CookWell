function substituteServings(calcSection, servings) {
  if (!calcSection) return ''
  return calcSection.replace(/份数/g, String(servings))
}

function calcIngredientLines(calcSection, servings) {
  const text = substituteServings(calcSection, servings)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out = []
  for (const line of lines) {
    if (/^总量[：:]?$/.test(line)) continue
    if (/^每次制作/.test(line)) continue
    if (/^一份/.test(line)) continue
    if (line.startsWith('##')) continue
    if (/^[\*\-•]/.test(line) || /^\d+\.\s/.test(line)) {
      out.push(line.replace(/^[\*\-•]\s*/, '').replace(/^\d+\.\s*/, ''))
    }
  }
  return out
}

function mergeKey(line) {
  const idx = line.indexOf('=')
  if (idx > 0) {
    return line.slice(0, idx).trim()
  }
  const lastStar = line.lastIndexOf('*')
  if (lastStar > 0) {
    const right = line.slice(lastStar + 1).trim()
    if (/^[\d（(]/.test(right)) {
      return line.slice(0, lastStar).trim()
    }
  }
  return line
}

function buildMergedList(dishBlocks) {
  const map = {}
  for (const { dishName, lines } of dishBlocks) {
    for (const line of lines) {
      const key = mergeKey(line)
      if (!map[key]) map[key] = []
      map[key].push({ dish: dishName, line })
    }
  }
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(key => ({ key, entries: map[key] }))
}

module.exports = {
  substituteServings,
  calcIngredientLines,
  buildMergedList,
  mergeKey
}
