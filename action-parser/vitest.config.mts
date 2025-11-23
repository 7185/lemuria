import swc from 'unplugin-swc'
import {configDefaults, defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    coverage: {
      provider: 'v8',
      exclude: [...(configDefaults.coverage.exclude ?? []), '*/*.interfaces.ts']
    },
    exclude: ['dist/**/*']
  },
  plugins: [
    swc.vite({
      module: {type: 'es6'}
    })
  ]
})
