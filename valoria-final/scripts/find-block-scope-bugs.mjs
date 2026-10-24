#!/usr/bin/env node
// scripts/find-block-scope-bugs.mjs
//
// Static check for the defect class that broke every first-time assessment
// submission: an identifier declared with const/let inside a block (try, if,
// for, …) and referenced outside that block. const/let are block-scoped, so the
// reference throws ReferenceError at runtime — but only on the path that reaches
// it, which is why text-assertion tests and a green build miss it.
//
// A real parser (@babel/parser) with lexical-scope tracking is used, so this is
// not fooled by object keys, property names, or same-named variables in sibling
// scopes the way a regex would be.
//
// Usage: node scripts/find-block-scope-bugs.mjs [dir ...]
// Exit code 1 when any finding is reported.

import { parse } from '@babel/parser'
import * as t from '@babel/types'
import fs from 'node:fs'
import path from 'node:path'

const roots = process.argv.slice(2)
if (roots.length === 0) roots.push('api', 'src', 'lib')

export function walkFiles(target, out = []) {
  if (!fs.existsSync(target)) return out
  const stat = fs.statSync(target)
  if (stat.isFile()) {
    if (/\.(js|mjs|cjs|jsx)$/.test(target)) out.push(target)
    return out
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walkFiles(full, out)
    } else if (/\.(js|mjs|cjs|jsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function linkParents(node, parent = null) {
  if (!node || typeof node.type !== 'string') return
  node.__parent = parent
  for (const key of Object.keys(node)) {
    if (key === '__parent' || key === 'loc') continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const c of value) if (c && typeof c.type === 'string') linkParents(c, node)
    } else if (value && typeof value.type === 'string') {
      linkParents(value, node)
    }
  }
}

const isScopeNode = node =>
  t.isFunction(node) || t.isBlockStatement(node) || t.isProgram(node) ||
  t.isFor(node) || t.isCatchClause(node) || t.isSwitchStatement(node) ||
  t.isClassDeclaration(node) || t.isClassExpression(node)

function bindingNames(id, out = []) {
  if (!id) return out
  if (t.isIdentifier(id)) out.push(id.name)
  else if (t.isObjectPattern(id)) for (const p of id.properties) bindingNames(p.value || p.argument, out)
  else if (t.isArrayPattern(id)) for (const el of id.elements) bindingNames(el, out)
  else if (t.isAssignmentPattern(id)) bindingNames(id.left, out)
  else if (t.isRestElement(id)) bindingNames(id.argument, out)
  return out
}

// Names that are not a value read: declaration ids, non-computed property keys,
// member property names, labels, function/param ids.
function isNonRead(node) {
  const p = node.__parent
  if (!p) return false
  if (t.isMemberExpression(p) && p.property === node && !p.computed) return true
  if (t.isOptionalMemberExpression?.(p) && p.property === node && !p.computed) return true
  if (t.isObjectProperty(p) && p.key === node && !p.computed) return true
  if (t.isVariableDeclarator(p) && p.id === node) return true
  if ((t.isFunction(p) || t.isClassDeclaration(p) || t.isClassExpression(p)) && p.id === node) return true
  if (t.isFunction(p) && p.params?.includes(node)) return true
  if (t.isLabeledStatement(p) || t.isBreakStatement(p) || t.isContinueStatement(p)) return true
  return false
}

// A binding is in scope at a use site only if the use's scope is the declaring
// scope or a descendant of it. Sibling scopes (e.g. a `catch` block referencing
// a `const` from the `try` block) are not covered, and neither is code after a
// block has closed — both are ReferenceErrors.
function scopeContains(declScope, useScope) {
  let s = useScope
  while (s) {
    if (s === declScope) return true
    s = s.parent
  }
  return false
}

export function analyse(code, file) {
  const ast = parse(code, { sourceType: 'unambiguous', errorRecovery: true, plugins: ['jsx'] })
  linkParents(ast)

  const scopeByNode = new WeakMap()
  const bindings = [] // { name, scope, fnScope, kind, line }

  // ── pass 1: build the scope tree and record every declaration ────────────
  function collect(node, scope) {
    if (!node || typeof node.type !== 'string') return
    let current = scope
    if (isScopeNode(node)) {
      current = { parent: scope, bindings: new Map(), node }
      scopeByNode.set(node, current)
    }

    // Function and catch parameters are bindings too. Without these, a use of a
    // parameter resolves to nothing and gets misreported as an out-of-block use.
    if (t.isFunction(node)) {
      for (const param of node.params) {
        for (const name of bindingNames(param)) {
          current.bindings.set(name, { name, scope: current, fnScope: current, kind: 'param', line: node.loc?.start.line })
        }
      }
    }
    if (t.isCatchClause(node) && node.param) {
      for (const name of bindingNames(node.param)) {
        current.bindings.set(name, { name, scope: current, fnScope: current, kind: 'catch', line: node.loc?.start.line })
      }
    }

    if (t.isVariableDeclaration(node)) {
      // `var` hoists to the nearest function scope; const/let stay in this block.
      let target = current
      if (node.kind === 'var') {
        while (target.parent && !(t.isFunction(target.node) || t.isProgram(target.node))) target = target.parent
      }
      for (const d of node.declarations) {
        for (const name of bindingNames(d.id)) {
          const binding = { name, scope: target, fnScope: fnScopeOf(target), kind: node.kind, line: node.loc?.start.line }
          target.bindings.set(name, binding)
          bindings.push(binding)
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === '__parent' || key === 'loc') continue
      const value = node[key]
      if (Array.isArray(value)) {
        for (const c of value) if (c && typeof c.type === 'string') collect(c, current)
      } else if (value && typeof value.type === 'string') {
        collect(value, current)
      }
    }
  }

  const rootScope = { parent: null, bindings: new Map(), node: ast.program }
  scopeByNode.set(ast.program, rootScope)
  collect(ast.program, rootScope)

  // ── pass 2: evaluate every read; report uses the lexical scope cannot see ─
  const findings = []
  function check(node, scope) {
    if (!node || typeof node.type !== 'string') return
    const current = scopeByNode.get(node) || scope

    if (t.isIdentifier(node) && !isNonRead(node)) {
      let s = current
      let visible = null
      while (s && !visible) {
        if (s.bindings.has(node.name)) visible = s.bindings.get(node.name)
        s = s.parent
      }
      if (!visible) {
        // Unresolved lexically. If a binding with this name exists inside the
        // same function but in a block this use cannot see, that is the bug.
        const sameFn = bindings.filter(b => b.name === node.name && b.fnScope === fnScopeOf(current) && !scopeContains(b.scope, current))
        if (sameFn.length > 0) {
          const nearest = sameFn[sameFn.length - 1]
          findings.push({ file, name: node.name, declLine: nearest.line, useLine: node.loc?.start.line })
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === '__parent' || key === 'loc') continue
      const value = node[key]
      if (Array.isArray(value)) {
        for (const c of value) if (c && typeof c.type === 'string') check(c, current)
      } else if (value && typeof value.type === 'string') {
        check(value, current)
      }
    }
  }

  check(ast.program, rootScope)
  return findings
}

function fnScopeOf(scope) {
  let s = scope
  while (s && !(t.isFunction(s.node) || t.isProgram(s.node))) s = s.parent
  return s || scope
}

// ── CLI ────────────────────────────────────────────────────────────────────
// Only runs when executed directly, so the test suite can import analyse().
const invokedDirectly = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`
if (invokedDirectly) {
  let total = 0
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      try {
        for (const f of analyse(fs.readFileSync(file, 'utf8'), file)) {
          total += 1
          console.log(`${f.file}:${f.useLine}  '${f.name}' declared with const/let at line ${f.declLine} inside a block, used outside it`)
        }
      } catch (err) {
        console.error(`skip ${file}: ${err.message}`)
      }
    }
  }
  console.log(`\n${total} finding(s)`)
  process.exit(total > 0 ? 1 : 0)
}
