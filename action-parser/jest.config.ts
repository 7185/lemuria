import type {JestConfigWithTsJest} from 'ts-jest'

const jestConfig: JestConfigWithTsJest = {
  collectCoverage: true,
  preset: 'ts-jest/presets/default-esm',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },
  extensionsToTreatAsEsm: ['.ts']
}

export default jestConfig
