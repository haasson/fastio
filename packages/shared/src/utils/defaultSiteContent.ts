import type { SiteContent } from '../types/tenant'

export const defaultSiteContent = (): SiteContent => ({
  logo: null,
  hero: {
    bgUrl: null,
    text: null,
  },
  about: {
    coverUrl: null,
    text: '',
  },
  delivery: {
    manualText: '',
  },
})
