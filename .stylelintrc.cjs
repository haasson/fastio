/**
 * Design-system enforcement:
 * - hex/rgb → var(--color-*)
 * - литералы px в spacing/radius/font → var(--space-*) / var(--radius-*) / var(--font-*)
 *
 * Пока severity: warning — чтобы не блокировать коммиты, но подсветить все нарушения.
 * После миграции горячих файлов поднимем до error и добавим в pre-commit.
 */
module.exports = {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-recommended-vue/scss',
  ],
  plugins: ['stylelint-declaration-strict-value'],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'color-no-hex': [true, { severity: 'warning' }],
    'color-named': ['never', { severity: 'warning' }],

    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background',
        'background-color',
        'fill',
        'stroke',
        'border-color',
        'font-size',
        'font-weight',
        'line-height',
        'border-radius',
        'gap',
        'row-gap',
        'column-gap',
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'transition-duration',
      ],
      {
        ignoreValues: [
          '0',
          '0px',
          'auto',
          'inherit',
          'initial',
          'unset',
          'none',
          'transparent',
          'currentColor',
          '/^-?\\d+%$/',
          '/^-?\\d+(\\.\\d+)?(vh|vw|em|rem|fr)$/',
          '/^calc\\(/',
          '/^var\\(/',
          '/^\\$/',
        ],
        severity: 'warning',
      },
    ],

    // Разрешаем 1px/2px на border — шкалу на бордеры не делаем.
    'declaration-property-value-allowed-list': null,

    // SCSS нюансы — глушим шумные правила, которые не про дизайн-систему.
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'scss/dollar-variable-pattern': null,
    'scss/at-mixin-pattern': null,
    'scss/percent-placeholder-pattern': null,
    'custom-property-pattern': null,
    'value-keyword-case': null,
    'alpha-value-notation': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'hue-degree-notation': null,
    'shorthand-property-no-redundant-values': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'rule-empty-line-before': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'media-feature-range-notation': null,
    'at-rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    'number-max-precision': null,
    'length-zero-no-unit': null,
    'declaration-block-single-line-max-declarations': null,
    'no-invalid-position-declaration': null,
    'color-hex-length': null,
    'property-no-vendor-prefix': null,
    'font-family-name-quotes': null,
    'scss/double-slash-comment-empty-line-before': null,
    'selector-not-notation': null,
  },
};
