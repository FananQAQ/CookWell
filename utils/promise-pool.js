/**
 * 限制并发数的 Promise 池，保持结果顺序与 items 一致
 */
function runPool(items, concurrency, worker) {
  const n = items.length
  if (n === 0) return Promise.resolve([])
  const limit = Math.max(1, Math.min(concurrency, n))
  return new Promise((resolve, reject) => {
    const out = new Array(n)
    let next = 0
    let active = 0
    let done = 0

    const kick = () => {
      while (active < limit && next < n) {
        const i = next++
        active++
        Promise.resolve(worker(items[i], i))
          .then(val => {
            out[i] = val
          })
          .catch(reject)
          .finally(() => {
            active--
            done++
            if (done === n) resolve(out)
            else kick()
          })
      }
    }
    kick()
  })
}

module.exports = { runPool }
