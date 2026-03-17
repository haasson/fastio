import type { TenantSeo } from '../types/tenant'

export const defaultSeo = (): TenantSeo => ({
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  favicon: null,
  robots: 'index',
})
