import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    rules: {
      indent: ['error', 2, {SwitchCase: 1}],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', {avoidEscape: true}],
      semi: ['error', 'never'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public'
        }
      ]
    }
  }
)
