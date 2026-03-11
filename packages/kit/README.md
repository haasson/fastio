# @fastio/kit

UI composables, типы, утилиты и константы. Зависит только от Vue — без Naive UI.

## Что внутри

- **Composables:** `useBreakpoints`, `useModals`, `useConfirm`, `useResponsiveSize`, `useQuery`, `useMutation`
- **Types:** `Size`, `Breakpoint`, `ValidationRule`, `ModalController` и др.
- **Utils:** валидация форм, `throttle`, `layerManager`
- **Constants:** `COLORS`, `FORM_SIZE_KEY`

## Использование

```ts
import { useBreakpoints, useConfirm, COLORS } from '@fastio/kit'
import type { Size, Breakpoint, ValidationRule } from '@fastio/kit'
```

## Почему отдельный пакет?

Вынесен из `@fastio/ui`, чтобы `storefront` (и другие приложения) могли использовать UI-инфраструктуру без зависимости от Naive UI.

`useMessage` остался в `@fastio/ui` — он обёртка над Naive UI.
