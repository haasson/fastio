import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import DOMPurify from 'dompurify'

export function useSafeHtml(source: MaybeRefOrGetter<string>) {
  return computed(() => {
    const raw = toValue(source)
    if (import.meta.server) return raw
    return DOMPurify.sanitize(raw)
  })
}
