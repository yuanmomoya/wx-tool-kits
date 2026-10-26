/** Skyline 不认 -webkit- / -ms- 前缀，编译后再清一遍，避免控制台刷警告。 */
module.exports = function stripSkylinePrefixes() {
  return {
    postcssPlugin: 'strip-skyline-prefixes',
    Declaration(decl) {
      if (/^(-webkit-|-moz-|-ms-)/.test(decl.prop)) decl.remove()
    },
    Rule(rule) {
      if (typeof rule.selector === 'string' && rule.selector.includes('::-webkit-')) rule.remove()
    },
  }
}

module.exports.postcss = true
