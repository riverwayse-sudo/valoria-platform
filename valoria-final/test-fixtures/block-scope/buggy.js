// valoria-final/src/__tests__/fixtures/block-scope/buggy.js
//
// NOT executed — a fixture for the block-scope static check. This is the exact
// shape that broke every first-time assessment submission: `insertRes` is
// declared with const inside the try and read after the block closed.
export async function handler() {
  try {
    const insertRes = await fetch('x')
    if (!insertRes.ok) return 'error'
  } catch (err) {
    return 'network'
  }
  const rows = await insertRes.json()
  return rows
}
