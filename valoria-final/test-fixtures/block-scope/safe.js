// valoria-final/src/__tests__/fixtures/block-scope/safe.js
//
// NOT executed — a fixture proving the static check has no false positives on
// the constructs it must tolerate: a `let` declared outside the try, object keys
// that look like variables, sibling shadowing, and arrow-function parameters.
export async function handler(res) {
  let insertRes
  try {
    insertRes = await fetch('x')
  } catch (err) {
    return { error: err.message, res }
  }
  const rows = await insertRes.json()
  const config = { limit: 1 }
  for (const row of rows) {
    const limit = row.limit
    if (limit > config.limit) return limit
  }
  const shared = 1
  function inner() {
    const shared = 2
    return shared
  }
  return inner() + shared + rows.map(data => data.id).length
}
