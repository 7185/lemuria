import swc from 'unplugin-swc'
import {configDefaults, defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    coverage: {
      exclude: [...(configDefaults.coverage.exclude ?? []), '*/*.interfaces.ts']
    }
  },
  plugins: [
    swc.vite({
      module: {type: 'es6'}
    })
  ]
})
