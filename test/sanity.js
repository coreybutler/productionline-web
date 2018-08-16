'use strict'

const WebProductionLine = require('../')
const test = require('tap').test

test('Sanity Test', function (t) {
  let Builder = new WebProductionLine()

  t.ok(typeof WebProductionLine === 'function', 'Builder Class is recognized by Node.')
  t.ok(typeof Builder.make === 'function', 'make exists')
  t.ok(typeof Builder.clean === 'function', 'clean exists')
  t.ok(typeof Builder.copyAssets === 'function', 'copyAssets exists')
  t.ok(typeof Builder.buildHTML === 'function', 'buildHTML exists')
  t.ok(typeof Builder.buildJavaScript === 'function', 'buildJavaScript exists')
  t.ok(typeof Builder.buildCSS === 'function', 'buildCSS exists')
  t.ok(typeof Builder.minify === 'function', 'minify exists')
  t.ok(typeof Builder.transpile === 'function', 'transpile exists')
  t.ok(Builder.sourcemapurl === null, 'sourcemapurl exists')

  t.end()
})
