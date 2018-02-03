var gulp = require('gulp'),
  uglify = require('gulp-uglify'),
  minify = require('gulp-minify-css'),
  concat = require('gulp-concat'),
  rename = require('gulp-rename'),
  header = require('gulp-header'),
  del = require('del'),
  webserver = require('gulp-webserver'),
  less = require('gulp-less'),
  //当发生异常时提示错误 确保本地安装gulp-notify和gulp-plumber
  notify = require('gulp-notify'),
  plumber = require('gulp-plumber'),
  path = require('path'),
  fs = require('fs'),
  livereload = require('gulp-livereload');


gulp.task('webserver', function () {
  gulp.src('./')
    .pipe(webserver({
      port: 8080, //端口
      liveload: true, //实时刷新代码。不用f5刷新
      open: true,
      directoryListing: {
        path: './',
        enable: true
      }
    }))
});

//
gulp.task('js', function () {
  gulp.src("src/*.js")
    .pipe(concat('jquery.gaodemap.js'))
    .pipe(gulp.dest('./dist'))
    .pipe(uglify().on('error', function (e) {
      console.log(e);
    }))
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest('./dist'));
});



gulp.task('watch', function () {
  gulp.watch(['src/*.js'], ['js']);
});

gulp.task('default', ['webserver', 'js', 'watch']);