import js from '@eslint/js'
import tsPlugin from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import vueParser from 'vue-eslint-parser'
import vuePlugin from 'eslint-plugin-vue'

const stylisticConfig = stylistic.configs.customize({
  indent: 2,
  quotes: 'single',
  semi: false,
  jsx: false,
  arrowParens: true,
  braceStyle: '1tbs',
  commaDangle: 'always-multiline',
})

const vueGlobals = {
  MouseEvent: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  FocusEvent: 'readonly',
  CustomEvent: 'readonly',
  HTMLElement: 'readonly',
  Element: 'readonly',
  NodeList: 'readonly',
  DOMRect: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  getComputedStyle: 'readonly',
  matchMedia: 'readonly',
  Image: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  confirm: 'readonly',
}

const commonVueRules = {
  '@typescript-eslint/no-unused-vars': 'off',
  'vue/component-name-in-template-casing': ['error', 'PascalCase'],
  'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
  'vue/multi-word-component-names': 'off',
  'vue/no-v-html': 'off',
  'vue/require-default-prop': 'off',
  'vue/attribute-hyphenation': 'error',
  'vue/component-definition-name-casing': ['error', 'PascalCase'],
  'vue/first-attribute-linebreak': ['error', { singleline: 'ignore', multiline: 'below' }],
  'vue/max-attributes-per-line': ['error', { singleline: 3, multiline: 1 }],
  'vue/html-closing-bracket-newline': ['error', { singleline: 'never', multiline: 'always' }],
  'vue/html-indent': ['error', 2],
  'vue/html-self-closing': ['error', {
    html: { void: 'always', normal: 'always', component: 'always' },
    svg: 'always',
    math: 'always',
  }],
  'vue/order-in-components': 'error',
  'vue/padding-line-between-blocks': 'error',
  'vue/prefer-template': 'error',
  'no-debugger': 'error',
  'no-prototype-builtins': 'off',
}

const consoleLogRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'CallExpression[callee.object.name=\'console\'][callee.property.name=\'log\']',
      message: 'console.log() is not allowed. Use console.warn() or console.error() instead.',
    },
  ],
}

const commonStylisticRules = {
  '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
  '@stylistic/arrow-parens': ['error', 'always'],
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
  '@stylistic/padding-line-between-statements': [
    'error',
    { blankLine: 'always', prev: '*', next: 'return' },
    { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
    { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
  ],
  '@stylistic/member-delimiter-style': ['error', {
    multiline: { delimiter: 'none', requireLast: false },
    singleline: { delimiter: 'semi', requireLast: false },
  }],
  '@stylistic/type-annotation-spacing': 'error',
  '@stylistic/array-bracket-spacing': ['error', 'never'],
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/space-before-function-paren': ['error', {
    anonymous: 'always',
    named: 'never',
    asyncArrow: 'always',
  }],
  '@stylistic/space-infix-ops': 'error',
  '@stylistic/keyword-spacing': 'error',
  '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
  '@stylistic/padded-blocks': ['error', 'never'],
}

const commonTsRules = {
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
  }],
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
  'no-debugger': 'error',
  'no-prototype-builtins': 'off',
}

export const eslintConfig = [
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  stylisticConfig,
  {
    files: ['**/*.vue'],
    plugins: { vue: vuePlugin },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsPlugin.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: vueGlobals,
    },
    rules: {
      ...commonVueRules,
      ...consoleLogRule,
      ...commonStylisticRules,
      'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...commonTsRules,
      ...commonStylisticRules,
      ...consoleLogRule,
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.d.ts',
    ],
  },
]

export default eslintConfig
