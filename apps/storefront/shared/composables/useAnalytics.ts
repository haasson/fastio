import { computed } from 'vue'
import { useHead } from 'nuxt/app'
import type { TenantSeo } from '@fastio/shared'

export const useAnalytics = (seo: () => TenantSeo | undefined) => {
  useHead(computed(() => {
    const s = seo()
    const scripts: { src?: string; innerHTML?: string; async?: boolean }[] = []

    if (s?.googleAnalyticsId) {
      const gaId = s.googleAnalyticsId
      scripts.push({ src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true })
      scripts.push({ innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}')` })
    }

    if (s?.yandexMetrikaId) {
      const ymId = s.yandexMetrikaId
      scripts.push({ innerHTML: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${ymId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true})` })
    }

    return { script: scripts }
  }))
}
