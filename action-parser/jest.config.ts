import type {Config} from '@jest/types'

const config: Config.InitialOptions = {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest'
  }
}
export default config
