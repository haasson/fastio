// Опциональный Pinia-стор. Используй ТОЛЬКО если состояние нужно нескольким
// несвязанным страницам/компонентам (например, cart, checkout).
//
// Если фиче хватает локального state в composable — удали этот файл и убери
// его из barrel index.ts.

import { defineStore } from 'pinia'
import { use__FEATURE_PASCAL__ } from '../composables/use__Feature__'

export const use__FEATURE_PASCAL__Store = defineStore('__FEATURE_CAMEL__', () => {
  return use__FEATURE_PASCAL__()
})
