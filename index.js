const localpackage = require('./package.json')
const ProductionLine = require('productionline')
const path = require('path')
const babel = require('@babel/core')
const minifier = require('uglify-js')
const CleanCSS = require('clean-css')
const chalk = require('chalk')
const fs = require('fs-extra')

class Builder extends ProductionLine {
  constructor (cfg = {}) {
    super(cfg)

    // Overwrite tasks with new runner
    this.tasks = new this.TaskRunner()

    this.PRIVATE = {
      /**
       * @cfg {string} sourcemapurl
       * A standard footer to be applied to files. Defaults to blank.
       */
      SOURCEMAPURL: cfg.sourcemapurl || null,

      /**
       * @cfg {string} sourcemapdir
       * The directory (relative or absolute) where sourcemap files are written.
       */
      SOURCEMAPDIR: cfg.sourcemapdir || './SOURCEMAPS',

      /**
       * @cfg {array} ignoremaps
       * An array of globs for ignoring source map creation.
       * For example: `['/path/to/vendor_js/*.js']`
       */
      IGNOREDSOURCEMAPS: cfg.ignoremaps || [],

      /**
       * @cfg {object} transpile
       * Babel configuration. Defaults to:
       * ```js
       * {
       *   presets: ["@babel/preset-env"]
       * }
       * ```
       */
      TRANSPILECFG: cfg.transpile || {
        presets: ['@babel/preset-env']
      }
    }

    // Get the sourcemap root if it's in the package.
    if (this.PKG.hasOwnProperty('sourcemaps')) {
      let sourcemapuri = this.PKG.sourcemaps
      let urimatch = /\{{2}(.*)\}{2}/i.exec(sourcemapuri)
      let ct = 0

      while (urimatch !== null && ct < 100) {
        if (this.PKG.hasOwnProperty(urimatch[1])) {
          sourcemapuri = sourcemapuri.replace(new RegExp(`{{${urimatch[1]}}}`, 'gi'), this.PKG[urimatch[1]])
        } else {
          sourcemapuri = sourcemapuri.replace(new RegExp(`{{${urimatch[1]}}}`, 'gi'), '')
        }

        urimatch = /\{{2}(.*)\}{2}/i.exec(sourcemapuri)
        ct++
      }

      this.PRIVATE.SOURCEMAPURL = sourcemapuri
    }

    let width = 25

    // Initialize tasks.
    // Rebuild this.prepareBuild // Clear the super method
    this.prepareBuild = () => {
      this.tasks.add('Preparing Build', next => {
        let ui = new this.Table()

        ui.div({
          text: this.COLORS.info(`Running ${localpackage.name} v${localpackage.version} for ${this.PKG.name}`),
          border: false,
          padding: [1, 0, 1, 5]
        })

        ui.div({
          text: chalk.bold('Source:'),
          width,
          padding: [0, 0, 0, 5]
        }, {
          text: this.SOURCE
        })

        ui.div({
          text: chalk.bold('Output:'),
          width,
          padding: [0, 0, 0, 5]
        }, {
          text: this.OUTPUT
        })

        ui.div({
          text: chalk.bold('Assets:'),
          width,
          padding: [0, 0, 0, 5]
        }, {
          text: this.ASSETS.length === 0 ? this.COLORS.warn('None') : this.ASSETS.map(asset => asset).join('\n')
        })

        if (this.PRIVATE.hasOwnProperty('SOURCEMAPURL') && this.PRIVATE.SOURCEMAPURL !== null) {
          ui.div({
            text: chalk.bold('Source Maps:'),
            width,
            padding: [0, 0, 0, 5]
          }, {
            text: this.PRIVATE.SOURCEMAPURL,
            padding: [0, 0, 0, 0]
          })
        }

        ui.div({
          text: this.COLORS.subtle('Ignored:'),
          width,
          padding: [1, 0, this.PRIVATE.IGNOREDSOURCEMAPS.length > 0 ? 0 : 1, 5]
        }, {
          text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
          padding: [1, 0, 0, 0]
        })

        if (this.PRIVATE.IGNOREDSOURCEMAPS.length > 0) {
          ui.div({
            text: this.COLORS.subtle('Ignored SourceMaps:'),
            width,
            padding: [0, 0, 1, 5]
          }, {
            text: this.COLORS.subtle(this.PRIVATE.IGNOREDSOURCEMAPS.join(', ')),
            padding: [0, 0, 1, 0]
          })
        }

        console.log(ui.toString())

        next()
      })
    }
  }

  get sourceMapper () {
    return require('source-map')
  }

  get sourcemapurl () {
    return this.PRIVATE.SOURCEMAPURL
  }

  set sourcemapurl (value) {
    this.PRIVATE.SOURCEMAPURL = value
  }

  get transpilerConfiguration () {
    return this.PRIVATE.TRANSPILECFG
  }

  sourcemapDirectory (filepath) {
    return path.dirname(path.join(this.OUTPUT, this.PRIVATE.SOURCEMAPDIR, this.localDirectory(filepath)))
  }

  // transpile (filepath callback) {
  //   fs.readFile(filepath, (err, content) => {
  //     callback(babel.transform(content, {
  //       presets: ['env']
  //     }))
  //   })
  // }

  /**
   * Synchronously transpile JavaScript code using Babel.
   * By default, this uses `presets: ['env']`.
   * @param  {string} filepath
   * Path of the file to transpile.
   * @param  {object} [transpilerConfiguration]
   * Defaults to the #transpile configuration value.
   * @return {object}
   * Returns the transpiled code object.
   * ```
   * {
   *   code: '...',
   *   map: {}, // Sourcemap
   *   ast: {} // AST tree
   * }
   */
  transpile (filepath, cfg = null) {
    cfg = cfg || this.PRIVATE.TRANSPILECFG

    cfg.sourceFileName = cfg.sourceFileName || path.basename(filepath)
    cfg.sourceMaps = cfg.sourceMaps === false ? false : true // eslint-disable-line

    return babel.transform(fs.readFileSync(filepath).toString(), cfg) // Generates {code, map, ast}
  }

  /**
   * Minify JS code using UglifyJS.
   * @param  {string} code
   * This can be raw code or an input file.
   * @param {string} [sourcefilename]
   * The name of the source file. This is required for sourcemaps.
   * @param {object} [sourcemap]
   * Apply a sourcemap to the minification.
   * @return {object}
   * ```
   * {
   *   code: '...',
   *   map: {}, // Sourcemap
   * }
   * ```
   */
  minify (code, filename = null, sourcemap = null) {
    try {
      code = fs.readFileSync(code).toString()
    } catch (e) {}

    let options = {
      mangle: true,
      compress: true
    }

    if (filename !== null) {
      options.sourceMap = {
        root: this.PRIVATE.SOURCEMAPURL,
        url: filename
      }

      if (sourcemap !== null) {
        options.sourceMap.content = sourcemap
        options.sourceMap.url = (this.PRIVATE.SOURCEMAPURL + '/' + filename + '.map').replace(/\/{2,10}/gi, '/')

        if (options.sourceMap.url.startsWith('http')) {
          let match = /https?:\/{1}/i.exec(options.sourceMap.url)
          options.sourceMap.url = options.sourceMap.url.replace(match[0], match[0] + '/').replace(/\/{3,100}/i, '//')
        }

        options.sourceMap.root = options.sourceMap.url.replace(this.PRIVATE.SOURCEMAPURL, this.PRIVATE.SOURCEMAPURL + '/sources/')

        // delete options.sourceMap.root
      }
    }

    return minifier.minify(code, options)
  }

  /**
   * Clean the output directory. This guarantees the output directory exists
   * and is empty.
   */
  clean () {
    this.tasks.add(`Cleaning ${this.OUTPUT}`, next => fs.emptyDir(this.OUTPUT, next))
  }

  // Setting verbose=true will log the path of each copy.
  copyAssets (verbose = false) {
    this.tasks.add('Copy Assets', next => {
      let assetTasks = new this.TaskRunner()

      this.ASSETS.forEach(assetPath => {
        assetTasks.add(`Copying ${assetPath} to output.`, cont => {
          if (verbose) {
            console.log(this.COLORS.verysubtle(`     - Copy ${assetPath} to `) + this.COLORS.subtle(this.outputDirectory(assetPath)))
          }

          this.copyToOutput(assetPath, cont)
        })
      })

      assetTasks.on('complete', next)
      assetTasks.run()
    })
  }

  buildHTML () {
    this.tasks.add('Build HTML', next => {
      this.walk(path.join(this.SOURCE, '/**/*.htm*')).forEach(filepath => {
        fs.copySync(filepath, this.outputDirectory(filepath))
      })

      next()
    })
  }

  buildJavaScript (transpile = true, minify = true, createsourcemaps = true) {
    if (createsourcemaps && this.PRIVATE.SOURCEMAPURL === null) {
      createsourcemaps = false
    }

    this.tasks.add('Build JavaScript', next => {
      let transpiler = new this.TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.js')).forEach(filepath => {
        transpiler.add(`Transpile ${this.localDirectory(filepath)}`, cont => {
          // Handle transpilation
          let transpiled = transpile ? this.transpile(filepath) : { code: fs.readFileSync(filepath), map: null }

          // Sourcemap configuration
          let createmap = createsourcemaps

          if (!createsourcemaps) {
            transpiled.map = null
          } else if (this.PRIVATE.IGNOREDSOURCEMAPS.length > 0) {
            for (let i = 0; i < this.PRIVATE.IGNOREDSOURCEMAPS.length; i++) {
              if (this.minimatch(filepath, path.join(this.SOURCE, this.PRIVATE.IGNOREDSOURCEMAPS[i]))) {
                createmap = false
                transpiled.map = null
                this.warn('     - Skipped sourcemap creation for ' + this.localDirectory(filepath) + ' (EXPLICITLY IGNORED)')
                break
              }
            }
          }

          // Handle minification
          let minified = minify ? this.minify(transpiled.code, this.localDirectory(filepath), transpiled.map) : transpiled

          // Apply comment header & footer
          let content = this.applyHeader(minified.code, 'js')
          content = this.applyFooter(minified.code, 'js')

          // Create sourcemaps
          if (createmap && minified.map !== null) {
            let mappath = path.join(this.sourcemapDirectory(filepath), path.basename(filepath) + '.map')
            this.writeFileSync(mappath, minified.map)
            this.subtle('     + SourceMap created:', this.localDirectory(mappath))
          }

          this.writeFile(this.outputDirectory(filepath), content, cont)
        })
      })

      transpiler.on('complete', next)
      transpiler.run()
    })
  }

  buildCSS () {
    this.tasks.add('Build CSS', next => {
      let cssTasks = new this.TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.css')).forEach(filepath => {
        cssTasks.add(`Minify ${this.localDirectory(filepath)}`, cont => {
          let minified = new CleanCSS().minify(fs.readFileSync(filepath).toString())
          let content = this.applyHeader(minified.styles, 'js')
          this.writeFile(this.outputDirectory(filepath), content, cont)
        })
      })

      cssTasks.on('complete', next)
      cssTasks.run()
    })
  }

  // Preserve header content during minification
  applyHeader (code, type = 'js', preserveHeader = true) {
    if (!this.HEADER) {
      return code
    }

    if (preserveHeader && this.PRIVATE.SOURCEMAPURL !== null) {
      code = `@preserve\n${code}`
    }

    return super.applyHeader(code, type)
  }

  /**
   * A standard build process. Most build processes will override/extend this,
   * but this will add the following tasks to the process:
   *
   * 1. Clean the output directory.
   * 1. Copy #assets from the #source to #output directory.
   * 1. Build HTML (or just copy if minification isn't configured).
   * 1. Transpile JS using Babel.
   * 1. Minify JS using Uglify.
   * 1. Minify CSS.
   */
  make () {
    this.clean()
    this.copyAssets()
    this.buildHTML()
    this.buildJavaScript()
    this.buildCSS()
  }

  debug () {

  }
}

module.exports = Builder
