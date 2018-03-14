const localpackage = require('./package.json')
const ProductionLine = require('productionline')
const path = require('path')
const babel = require('babel-core')
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
      SOURCEMAPURL: cfg.sourcemapurl || null
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

    let width = 15

    // Initialize tasks.
    // Rebuild this.prepareBuild // Clear the super method
    this.prepareBuild = () => {
      this.tasks.add('Preparing Build', next => {
        let ui = new this.Table()

        ui.div({
          text: this.COLORS.info(`Running ${localpackage.name} v${localpackage.version} for ${this.PKG.name}`),
          border: false,
          padding: [1, 0, 1, 2]
        })

        ui.div({
          text: chalk.bold('Source:'),
          width,
          padding: [0, 0, 0, 2]
        }, {
          text: this.SOURCE
        })

        ui.div({
          text: chalk.bold('Output:'),
          width,
          padding: [0, 0, 0, 2]
        }, {
          text: this.OUTPUT
        })

        ui.div({
          text: chalk.bold('Assets:'),
          width,
          padding: [0, 0, 0, 2]
        }, {
          text: this.ASSETS.map(asset => path.join(this.SOURCE, asset)).join('\n')
        })

        if (this.hasOwnProperty('SOURCEMAPURL') && this.PRIVATE.SOURCEMAPURL !== null) {
          ui.div({
            text: chalk.bold('SourceMaps:'),
            width,
            padding: [1, 0, 0, 2]
          }, {
            text: this.PRIVATE.SOURCEMAPURL,
            padding: [1, 0, 0, 0]
          })
        }

        ui.div({
          text: this.COLORS.subtle('Ignored:'),
          width,
          padding: [1, 0, 1, 2]
        }, {
          text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
          padding: [1, 0, 1, 0]
        })

        console.log(ui.toString())

        next()
      })
    }

    this.prepareBuild()
  }

  get sourcemapurl () {
    return this.PRIVATE.SOURCEMAPURL
  }

  set sourcemapurl (value) {
    this.PRIVATE.SOURCEMAPURL = value
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
   * @param  {[type]} filepath [description]
   * @return {[type]}          [description]
   */
  transpile (filepath) {
    return babel.transform(fs.readFileSync(filepath).toString(), {
      presets: ['env']
    })
  }

  /**
   * Minify JS code using UglifyJS.
   * @param  {string} code
   * This can be raw code or an input file.
   * @return {[type]}      [description]
   */
  minify (code) {
    try {
      code = fs.readFileSync(code).toString()
    } catch (e) {}

    return minifier.minify(code, {
      mangle: true,
      compress: true
    })
  }

  /**
   * Clean the output directory. This guarantees the output directory exists
   * and is empty.
   */
  clean () {
    this.tasks.add(`Cleaning ${this.OUTPUT}`, next => fs.emptyDir(this.OUTPUT, next))
  }

  copyAssets () {
    this.tasks.add('Copy Assets', next => {
      let assetTasks = new this.TaskRunner()

      this.ASSETS.forEach(assetPath => {
        assetTasks.add(`Copying ${assetPath} to output.`, cont => {
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

  buildJavaScript () {
    this.tasks.add('Build JavaScript', next => {
      let transpiler = new this.TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.js')).forEach(filepath => {
        transpiler.add(`Transpile ${this.localDirectory(filepath)}`, cont => {
          let transpiled = this.transpile(filepath)
          let minified = this.minify(transpiled.code)
          // console.log(transpiled.map)
          // console.log(transpiled.ast)
          let content = this.applyHeader(minified.code, 'js')

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

    super.applyHeader(code, type)
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
    this.run()
  }
}

module.exports = Builder
