# @fastio/icons

Компонент `UiIcon` и реестр иконок на базе lucide-vue-next.

## Использование

```ts
import { UiIcon } from '@fastio/icons'
import type { IconName } from '@fastio/icons'
```

```vue
<UiIcon name="plus" :size="20" color="#333" />
```

## Зависимости

- `@fastio/kit` — используется `useBreakpoints` для responsive-размеров иконок
- `lucide-vue-next` — библиотека SVG-иконок

## Почему отдельный пакет?

Вынесен из `@fastio/ui`, чтобы `storefront` мог использовать единый набор иконок без Naive UI.
