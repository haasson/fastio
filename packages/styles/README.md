# @fastio/styles

SCSS-переменные, миксины, типографика, reset-стили и шрифты (Inter, Urbanist).

Leaf-пакет без JS-зависимостей — может использоваться любым приложением.

## Использование

```scss
@use '@fastio/styles/mixins' as *;
@use '@fastio/styles/variables' as *;
@use '@fastio/styles/mixins/media-queries' as *;
```

## Почему отдельный пакет?

Вынесен из `@fastio/ui`, чтобы `storefront` мог использовать общие стили без зависимости от Naive UI.
