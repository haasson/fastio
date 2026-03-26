import type { SiteLayout } from '../types/tenant'

export const defaultSiteLayout = (): SiteLayout => ({
  header: {
    showNav: true,
    navItems: [],
    showPhone: true,
    showWorkingHours: true,
  },
  sections: {
    categoryBar: { enabled: true, overflow: 'scroll' },
    hero: {
      enabled: true,
      size: 'fullscreen',
      bgType: 'none',
      overlayColor: '#000000',
      overlayOpacity: 0.4,
      contentPosition: 5,
      contentAlign: 'left',
      gradientId: 'diag-bp',
    },
    banners: { enabled: false, displayMode: 'single', autoplay: false, autoplayInterval: 4 },
    menu: { enabled: true, defaultView: 'categories' },
    gallery: { enabled: false, galleryIds: [] },
    reviews: { enabled: false },
    delivery: { enabled: false },
  },
  sectionsOrder: ['categoryBar', 'hero', 'banners', 'menu', 'gallery', 'reviews', 'delivery'],
  pages: [],
  pageSettings: {
    menu: { defaultView: 'categories' },
    delivery: { showMap: false, descriptionMode: 'auto' },
    gallery: { galleryIds: [] },
  },
})
