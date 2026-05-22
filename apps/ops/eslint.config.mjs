import eslintConfig from '@fastio/shared/configs/eslint'

export default [
  ...eslintConfig,

  // Серверный мир ops — отдельная вселенная, без вертикальных барьеров
  {
    files: ['server/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
