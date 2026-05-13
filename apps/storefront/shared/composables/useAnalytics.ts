import { computed } from 'vue'
import { useHead } from 'nuxt/app'
import type { TenantSeo } from '@fastio/shared'
import { GA_ID_RE, YM_ID_RE } from '@fastio/shared'
import { reportError } from '~/shared/utils/reportError'

// ID идут в inline-script через ${interpolation}, поэтому интерполируем
// ТОЛЬКО после strict-валидации — иначе manager-аккаунт получает arbitrary JS
// execution на всех гостях через tenant.seo. Regex — единый источник истины
// в @fastio/shared/utils/analyticsValidation.ts.

export const useAnalytics = (seo: () => TenantSeo | undefined) => {
  useHead(computed(() => {
    const s = seo()
    const scripts: { src?: string; innerHTML?: string; async?: boolean }[] = []

    const rawGa = s?.googleAnalyticsId?.trim()

    if (rawGa) {
      if (GA_ID_RE.test(rawGa)) {
        const gaId = rawGa.toUpperCase()
        scripts.push({ src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true })
        scripts.push({ innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}')` })
      } else {
        reportError(new Error(`useAnalytics: невалидный Google Analytics ID, скрипт не подключён: ${rawGa}`))
      }
    }

    const rawYm = s?.yandexMetrikaId?.trim()

    if (rawYm) {
      if (YM_ID_RE.test(rawYm)) {
        const ymId = rawYm
        scripts.push({ innerHTML: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${ymId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true})` })
      } else {
        reportError(new Error(`useAnalytics: невалидный Яндекс.Метрика ID, скрипт не подключён: ${rawYm}`))
      }
    }

    return { script: scripts }
  }))
}
