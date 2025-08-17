import gulp from 'gulp';
import cleanCSS from 'gulp-clean-css';
import terser from 'gulp-terser';
import htmlmin from 'gulp-htmlmin';
import imagemin from 'gulp-imagemin';
import { deleteAsync } from 'del';
import path from 'path';
import { fileURLToPath } from 'url';
import newer from 'gulp-newer';
import changed from 'gulp-changed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 清理dist目录
export const clean = () => deleteAsync(['dist']);

// 压缩HTML
export const minifyHtml = () => {
  return gulp.src('src/**/*.html')
    .pipe(newer('dist'))
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true
    }))
    .pipe(gulp.dest('dist'));
};

// 压缩CSS
export const minifyCss = () => {
  return gulp.src('src/**/*.css')
    .pipe(newer('dist'))
    .pipe(cleanCSS({
      compatibility: 'ie8',
      level: 2
    }))
    .pipe(gulp.dest('dist'));
};

// 压缩JavaScript
export const minifyJs = () => {
  return gulp.src('src/**/*.js')
    .pipe(newer('dist'))
    .pipe(terser({
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      mangle: true
    }))
    .pipe(gulp.dest('dist'));
};

// 压缩图片
export const minifyImages = () => {
  return gulp.src('src/**/*.{png,jpg,jpeg,gif,svg,ico}')
    .pipe(newer('dist'))
    .pipe(imagemin({
      verbose: true
    }))
    .pipe(gulp.dest('dist'));
};

// 压缩JSON文件
export const minifyJson = () => {
  return gulp.src('src/**/*.json')
    .pipe(newer('dist'))
    .pipe(gulp.dest('dist'));
};



// 复制其他文件
export const copyOtherFiles = () => {
  return gulp.src([
    'src/**/*',
    '!src/**/*.{html,css,js,png,jpg,jpeg,gif,svg,ico,json}'
  ])
    .pipe(newer('dist'))
    .pipe(gulp.dest('dist'));
};

// 构建任务
export const build = gulp.series(
  clean,
  gulp.parallel(
    minifyHtml,
    minifyCss,
    minifyJs,
    minifyImages,
    minifyJson,
    copyOtherFiles
  )
);

// 默认任务
export default build;

// 监听文件变化（开发用）
export const watch = () => {
  gulp.watch('src/**/*.html', minifyHtml);
  gulp.watch('src/**/*.css', minifyCss);
  gulp.watch('src/**/*.js', minifyJs);
  gulp.watch('src/**/*.{png,jpg,jpeg,gif,svg,ico}', minifyImages);
  gulp.watch('src/**/*.json', minifyJson);
  gulp.watch([
    'src/**/*',
    '!src/**/*.{html,css,js,png,jpg,jpeg,gif,svg,ico,json}'
  ], copyOtherFiles);
};

// 增量构建任务（跳过已处理的文件）
export const buildIncremental = gulp.series(
  gulp.parallel(
    minifyHtml,
    minifyCss,
    minifyJs,
    minifyImages,
    minifyJson,
    copyOtherFiles
  )
);

// 开发模式
export const dev = gulp.series(build, watch);