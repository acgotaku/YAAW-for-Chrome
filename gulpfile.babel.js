import gulp from 'gulp'

import plumber from 'gulp-plumber'
import gulpIf from 'gulp-if'

import eslint from 'gulp-eslint'
import stylelint from 'gulp-stylelint'


import postcss from 'gulp-postcss'
import sass from 'gulp-sass'
import autoprefixer from 'autoprefixer'
import concat from 'gulp-concat'
import cleanCSS from 'gulp-clean-css'

import rollupEach from 'gulp-rollup-each'
import rollupBabel from 'rollup-plugin-babel'
import rollupResolve from 'rollup-plugin-node-resolve'
import rollupCommon from 'rollup-plugin-commonjs'
import uglify from 'gulp-uglify'

import del from 'del'

const paths = {
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
  }
}

const config = {
  plumberConfig: {
    errorHandler: function (err) {
      console.log(err.toString())
      this.emit('end')
    }
  },
  env: {
    dev: process.env.NODE_ENV === 'development',
    prod: process.env.NODE_ENV === 'production'
  }
}

export const clean = () => del([ 'dist' ])

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
    .pipe(concat('style.css'))
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
        rollupCommon()
      ]},
      {
        format: 'iife'
      }
      ))
    .pipe(gulpIf(config.env.prod, uglify()))
    .pipe(gulp.dest(paths.scripts.dest), { sourcemaps: config.env.dev })
}

export function watch() {
  gulp.watch(paths.scripts.src, scripts)
  gulp.watch(paths.styles.src, styles)
}
export const build = gulp.parallel(styles, scripts)

export const serve = gulp.series(clean, build, watch)

export const publish = gulp.series(clean, build)
