// babel.config.cjs
// Needed only so Jest (which runs tests via CommonJS require()) can parse the
// ESM `export { ... }` syntax used in scoringEngine.js / lockEngine.js /
// questions.js. Does not affect the Vite production build, which uses its
// own esbuild/rollup pipeline and ignores this file.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
