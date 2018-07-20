# productionline-web [![Build Status](https://travis-ci.org/coreybutler/productionline-web.svg?branch=master)](https://travis-ci.org/coreybutler/productionline-web) [![Greenkeeper badge](https://badges.greenkeeper.io/coreybutler/productionline-web.svg)](https://greenkeeper.io/)

`npm install productionline-web --save-dev`

An extension to [productionline](https://github.com/coreybutler/productionline) that adds common tasks for build web applications (ie minification, munging, concatenation, etc).

The are a number of additional methods this class adds to productionline, including:

- `sourcemapurl` _attribute_ (Sourcemap URL root)
- `transpile(filepath)` - Transpile a file to ES5 (Babel)
- `minify()` - Minify a block of CSS code.

There are also a number of additional tasks:

- `clean()` - Clears the output directory.
- `copyAssets()` - Copies a common assets directory from the source to the output directory.
- `buildHTML()` - Copies HTML to the output directory.
- `buildJavaScript()` - Copies a transpiled version of JS files to the output directory.
- `buildCSS()` - Copies a minified version of CSS files to the output directory.
- `make()` (see below)

### Standard "Make" Process

It is worth looking at the source for the `make()` method. By default, this method will copy assets from the source to destination and minify CSS/JS. This can and often will be overridden with logic suitable for your build process (example: adding transpilation or code concatenation).

## Examples

See the examples, and feel free to submit PR's with new examples.

## Basic Use

The source code is well documented with several feature methods.

The following would go in a file called `build.js`.

```js
const Builder = ('productionline-web')
const path = require('path')
const builder = new Builder({
  commands: {
    '--make': () => {
      console.log('Running Build Process:')

      // The following are not explicitly necessary since the source,
      // assets, and destination are all being set to their defaults.
      // However; the code is written so you can supply your own
      // folder structure.
      builder.source = path.resolve('./src')
      builder.assets = path.resolve('./assets') // Relative to source!
      builder.destination = path.resolve('./dist')

      // Queue the built-in build process.
      builder.make()
      builder.run()
    }
  }
})
```

In the `package.json` file, add an npm command like:

```js
{
  "scripts": {
    "test": "...",
    "build": "node build.js --make"
  }
}
```

The entire process can then be run using `npm run build`.

## Live Builds

During development, it's often useful to monitor source code and rebuild whenever a file changes. To support this, productionline contains a `watch`
task, which will remain running and respond to file system changes.

For example:

```js
builder.watch((action, filepath) => {
  builder.make()
  builder.run()
})
```
