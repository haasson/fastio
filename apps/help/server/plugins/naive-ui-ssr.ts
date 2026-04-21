import { defineNitroPlugin } from 'nitropack/runtime'

// Берёт collect() из event.context (его туда кладёт plugins/naive-ui.server.ts)
// и вшивает собранные стили Naive UI в <head>, чтобы SSR-страница приходила оформленной.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const collect = (event.context as { naiveCollect?: () => string }).naiveCollect

    if (!collect) return

    const styles = collect()

    if (styles) html.head.push(`<style id="naive-ui-ssr">${styles}</style>`)
  })
})
