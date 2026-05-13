import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import DOMPurify from 'isomorphic-dompurify'

// isomorphic-dompurify работает и на сервере (через jsdom), и в браузере.
// Раньше: `if (import.meta.server) return raw` — SSR отдавал тенант-html as-is,
// потому что classic dompurify без window работает как noop. Это давало stored
// XSS на гостях через v-html в hero/sections/banners и т.п.
export function useSafeHtml(source: MaybeRefOrGetter<string>) {
  return computed(() => {
    const raw = toValue(source)
    if (!raw) return ''

    return DOMPurify.sanitize(raw)
  })
}
