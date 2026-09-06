import swc from 'unplugin-swc'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    isolate: false,
    root: './',
    coverage: {
      provider: 'v8'
    },
    exclude: ['dist/**/*', 'node_modules/**/*']
  },
  plugins: [
    swc.vite({
      module: {type: 'es6'}
    })
  ]
})
