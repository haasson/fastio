import { useRuntimeConfig, useRouter } from '#imports'

const METRIKA_SRC = 'https://mc.yandex.ru/metrika/tag.js'

interface YmFn {
  (id: number, action: string, ...args: unknown[]): void
  a?: unknown[][]
  l?: number
}

declare global {
  interface Window {
    ym: YmFn
  }
}

export default defineNuxtPlugin(() => {
  const { yandexMetrikaId } = useRuntimeConfig().public
  if (!yandexMetrikaId) return

  const id = Number(yandexMetrikaId)

  const alreadyInjected = Array.from(document.scripts).some(s => s.src === METRIKA_SRC)
  if (!alreadyInjected) {
    const script = document.createElement('script')
    script.async = true
    script.src = METRIKA_SRC
    document.head.appendChild(script)
  }

  const ym: YmFn = window.ym || function (...args: unknown[]) {
    (ym.a = ym.a || []).push(args)
  }
  ym.l = Date.now()
  window.ym = ym

  window.ym(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  })

  useRouter().afterEach((to) => {
    window.ym(id, 'hit', to.fullPath)
  })
})
