import { readFileSync, writeFileSync } from 'fs'
import gulp from 'gulp'
import plumber from 'gulp-plumber'
import gulpIf from 'gulp-if'
import htmlhint from 'gulp-htmlhint'
import postcss from 'gulp-postcss'
import * as dartSass from 'sass'
import gulpSass from 'gulp-sass'
import autoprefixer from 'autoprefixer'
import cleanCSS from 'gulp-clean-css'
import rollupEach from 'gulp-rollup-each'
import rollupCommon from '@rollup/plugin-commonjs'
import rollupResolve from '@rollup/plugin-node-resolve'
import terser from 'gulp-terser'
import replace from 'gulp-replace'
import { deleteAsync } from 'del'
import zip from 'gulp-zip'

const sass = gulpSass(dartSass)

const paths = {
  htmls: {
    src: 'src/**/*.html',
    dest: 'dist/'
  },
  styles: {
    src: 'src/css/**/*.scss',
    dest: 'dist/css/'
  },
  scripts: {
    src: 'src/js/**/*.js',
    dest: 'dist/js/'
  },
  images: {
    src: 'src/images/**/*',
    dest: 'dist/images/'
  },
  copys: {
    src: ['_locales/**/*', 'yaaw/**/*', 'background.js', 'manifest.json'],
    dest: 'dist/'
  },
  compress: {
    src: 'dist/**/*',
    dest: 'dist/'
  }
}

const config = {
  plumberConfig: {
    errorHandler: function (err) {
      console.log(err.toString())
      this.emit('end')
    }
  },
  htmlhintConfig: {
    'alt-require': true,
    'attr-lowercase': ['viewBox', 'textLength'],
    'title-require': false
  },
  env: {
    dev: process.env.NODE_ENV === 'development',
    prod: process.env.NODE_ENV === 'production'
  }
}

export function clean () {
  return deleteAsync(['dist'])
}

function htmls () {
  return gulp.src(paths.htmls.src)
    .pipe(plumber(config.plumberConfig))
    .pipe(htmlhint(config.htmlhintConfig))
    .pipe(htmlhint.reporter())
    .pipe(gulp.dest(paths.htmls.dest))
}

function styles () {
  return gulp.src(paths.styles.src, { sourcemaps: config.env.dev })
    .pipe(plumber(config.plumberConfig))
    .pipe(sass({
      precision: 3,
      includePaths: ['.']
    }))
    .pipe(postcss([
      autoprefixer()
    ]))
    .pipe(gulpIf(config.env.prod, cleanCSS()))
    .pipe(gulp.dest(paths.styles.dest, { sourcemaps: config.env.dev }))
}

function scripts () {
  return gulp.src(paths.scripts.src, { sourcemaps: config.env.dev })
    .pipe(plumber(config.plumberConfig))
    .pipe(rollupEach({
      isCache: true,
      plugins: [
        rollupCommon(),
        rollupResolve({
          browser: true
        })
      ]
    },
    {
      format: 'iife'
    }
    ))
    .pipe(gulpIf(config.env.prod, terser()))
    .pipe(gulp.dest(paths.scripts.dest, { sourcemaps: config.env.dev }))
}

function images () {
  return gulp.src(paths.images.src, { encoding: false })
    .pipe(gulp.dest(paths.images.dest, { encoding: false }))
}

function copys () {
  return gulp.src(paths.copys.src, { base: '.', encoding: false })
    .pipe(gulp.dest(paths.copys.dest, { encoding: false }))
}

// Patch yaaw submodule files in dist to remove MV3-incompatible patterns
function patchYaaw () {
  return gulp.src([
    'dist/yaaw/index.html',
    'dist/yaaw/js/jquery.jsonrpc.js',
    'dist/yaaw/js/mustache.js',
    'dist/yaaw/js/yaaw.js'
  ], { base: 'dist' })
    // Remove AppCache manifest attribute
    .pipe(replace(/ manifest="offline\.appcache"/, ''))
    // Replace eval-based JSON parsing with JSON.parse
    .pipe(replace(/eval\s*\(\s*'[(]'\s*\+\s*json\s*\+\s*'[)]'\s*\)/, 'JSON.parse(json)'))
    // Fix default JSON-RPC path: location.* resolves to chrome-extension:// in MV3
    .pipe(replace(
      '$.Storage.get("jsonrpc_path") || location.protocol+"//"+(location.host.split(":")[0]||"localhost")+":6800"+"/jsonrpc"',
      '$.Storage.get("jsonrpc_path") || "http://localhost:6800/jsonrpc"'
    ))
    // Replace old mustache.js with vendor mustache v4 content
    .pipe(gulp.dest('dist'))
}

// Replace old mustache.js in dist with v4 from node_modules.
// Appends a compile() shim because yaaw.js uses Mustache.compile(tpl) which
// was removed in v4 — the shim wraps Mustache.render() with a closure instead.
function replaceMustache (cb) {
  const content = readFileSync('node_modules/mustache/mustache.min.js', 'utf8')
  // compile() shim: removed in v4, but yaaw.js uses it
  // renderSection patch: v4 passes raw template text to lambdas (spec-compliant),
  // but yaaw.js expects pre-rendered content (old mustache behavior).
  const shim = '\n;(function(){' +
    'if(typeof Mustache==="undefined")return;' +
    'if(!Mustache.compile){' +
      'Mustache.compile=function(t){return function(v,p){return Mustache.render(t,v,p||{});};};' +
    '}' +
    'var _rs=Mustache.Writer.prototype.renderSection;' +
    'Mustache.Writer.prototype.renderSection=function(token,context,partials,originalTemplate,config){' +
      'var value=context.lookup(token[1]);' +
      'if(typeof value==="function"){' +
        'var self=this;' +
        'var raw=originalTemplate.slice(token[3],token[5]);' +
        'var rendered=self.render(raw,context,partials,config);' +
        'var result=value.call(context.view,rendered);' +
        'return result!=null?String(result):"";' +
      '}' +
      'return _rs.call(this,token,context,partials,originalTemplate,config);' +
    '};' +
    '})();'
  writeFileSync('dist/yaaw/js/mustache.js', content + shim)
  cb()
}

function watch () {
  gulp.watch(paths.htmls.src, htmls)
  gulp.watch(paths.scripts.src, scripts)
  gulp.watch(paths.styles.src, styles)
  gulp.watch(paths.copys.src, copys)
}

export function compress () {
  return gulp.src(paths.compress.src, { encoding: false })
    .pipe(zip('chrome.zip'))
    .pipe(gulp.dest(paths.compress.dest))
}

const patch = gulp.series(patchYaaw, replaceMustache)
export const build = gulp.series(
  gulp.parallel(htmls, styles, scripts, images, copys),
  patch
)
export const serve = gulp.series(clean, build, watch)
export const publish = gulp.series(clean, build, compress)
