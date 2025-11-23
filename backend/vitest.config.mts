import swc from 'unplugin-swc'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    coverage: {
      provider: 'v8'
    },
    exclude: ['dist/**/*']
  },
  plugins: [
    swc.vite({
      module: {type: 'es6'}
    })
  ]
})
