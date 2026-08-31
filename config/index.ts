import path from 'path'

const config = {
  projectName: 'image-toolkit-tool-kits',
  date: '2026-7-22',
  designWidth: 375,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-html'],
  defineConstants: {},
  copy: {
    patterns: [
      {
        from: 'src/assets/',
        to: 'dist/assets/',
      },
      {
        from: 'src/sitemap.json',
        to: 'dist/sitemap.json',
      },
    ],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false,
  },
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {
          selectorBlackList: ['nut-'],
        },
      },
      cssModules: {
        enable: false,
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
      },
      cssModules: {
        enable: false,
      },
    },
  },
}

export default function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
