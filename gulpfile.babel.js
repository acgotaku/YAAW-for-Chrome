import gulp from 'gulp'

import plumber from 'gulp-plumber'
import gulpIf from 'gulp-if'

import htmlhint from 'gulp-htmlhint'

import eslint from 'gulp-eslint'
import stylelint from 'gulp-stylelint'


import postcss from 'gulp-postcss'
import sass from 'gulp-sass'
import autoprefixer from 'autoprefixer'
import cleanCSS from 'gulp-clean-css'

import rollupEach from 'gulp-rollup-each'
import rollupBabel from 'rollup-plugin-babel'
import rollupResolve from 'rollup-plugin-node-resolve'
import replace from 'rollup-plugin-replace'
import rollupCommon from 'rollup-plugin-commonjs'
import uglify from 'gulp-uglify'

import imagemin from 'gulp-imagemin'
import mozjpeg from 'imagemin-mozjpeg'
import pngquant from 'imagemin-pngquant'

import del from 'del'

import zip from 'gulp-zip'

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

export const clean = () => del([ 'dist' ])

export function htmls() {
  return gulp.src(paths.htmls.src)
    .pipe(plumber(config.plumberConfig))
    .pipe(htmlhint(config.htmlhintConfig))
    .pipe(htmlhint.reporter())
    .pipe(gulp.dest(paths.htmls.dest))
}

export function styles() {
  return gulp.src(paths.styles.src, { sourcemaps: config.env.dev })
    .pipe(plumber(config.plumberConfig))
    .pipe(stylelint({
      reporters: [
        { formatter: 'string', console: true }
      ]
    }))
    .pipe(sass({
      outputStyle: 'nested',
      precision: 3,
      includePaths: ['.']
    }))
    .pipe(postcss([
      autoprefixer({
        browsers: ['last 1 versions']
      })
    ]))
    .pipe(gulpIf(config.env.prod, cleanCSS()))
    .pipe(gulp.dest(paths.styles.dest), { sourcemaps: config.env.dev })
}

export function scripts() {
  return gulp.src(paths.scripts.src, { sourcemaps: config.env.dev })
    .pipe(plumber(config.plumberConfig))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(rollupEach({
      isCache: true,
      plugins: [
        rollupBabel({
          presets: ['@babel/preset-env']
        }),
        rollupResolve({
          browser: true
        }),
        rollupCommon(),
        replace({
          'process.env.NODE_ENV': JSON.stringify('development'),
          'process.env.VUE_ENV': JSON.stringify('browser')
        })
      ]},
      {
        format: 'iife'
      }
      ))
    .pipe(gulpIf(config.env.prod, uglify()))
    .pipe(gulp.dest(paths.scripts.dest), { sourcemaps: config.env.dev })
}

export function images() {
  return gulp.src(paths.images.src)
    .pipe(plumber(config.plumberConfig))
    .pipe(imagemin([
      pngquant(),
      mozjpeg()
    ], {
      verbose: true
    }))
    .pipe(gulp.dest(paths.images.dest))
}

export function copys() {
  return gulp.src(paths.copys.src, { base: '.' })
    .pipe(gulp.dest(paths.copys.dest))
}

export function watch() {
  gulp.watch(paths.htmls.src, htmls)
  gulp.watch(paths.scripts.src, scripts)
  gulp.watch(paths.styles.src, styles)
  gulp.watch(paths.copys.src, copys)
}

export function compress() {
  return gulp.src(paths.compress.src)
    .pipe(zip('chrome.zip'))
    .pipe(gulp.dest(paths.compress.dest))
}
export const build = gulp.parallel(htmls, styles, scripts, images, copys)

export const serve = gulp.series(clean, build, watch)

export const publish = gulp.series(clean, build, compress)
