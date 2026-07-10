// Used ONLY by Jest, to let it read scoringEngine.js / lockEngine.js — which
// are written as ES modules (export {...}) for Vite's browser build — inside
// test files that use require(). Vite's own build does not read this file
// (it uses esbuild/SWC, not Babel), so this has zero effect on the actual
// site or assessment app that ships to users.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
}
