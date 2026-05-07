function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractSection(md, sectionTitle) {
  const esc = escapeReg(sectionTitle)
  const mid = new RegExp(
    `\\n##\\s*${esc}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s|$)`
  )
  const m = md.match(mid)
  if (m) return m[1].trim()
  const start = new RegExp(
    `^##\\s*${esc}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s|$)`,
    'm'
  )
  const m2 = md.match(start)
  return m2 ? m2[1].trim() : ''
}

function parseHowToCookMarkdown(md) {
  const h1 = md.match(/^#\s*(.+)$/m)
  const title = h1 ? h1[1].replace(/的做法\s*$/, '').trim() : ''
  const difficulty =
    (md.match(/预估烹饪难度[：:]\s*([^\n\r]+)/) || [])[1] || ''
  const tools = extractSection(md, '必备原料和工具')
  const calc = extractSection(md, '计算')
  const steps = extractSection(md, '操作')
  const extra = extractSection(md, '附加内容')
  return { title, difficulty, tools, calc, steps, extra }
}

function bulletLines(block) {
  if (!block) return []
  return block
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => /^[\*\-•\d]/.test(l))
    .map(l => l.replace(/^[\*\-•]\s*/, '').replace(/^\d+\.\s*/, ''))
}

module.exports = {
  parseHowToCookMarkdown,
  bulletLines
}
