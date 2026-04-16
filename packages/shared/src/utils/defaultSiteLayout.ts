import type { SiteLayout } from '../types/tenant'

export const dishDescriptionOptions = [
  { value: 'below' as const, label: 'Под фото' },
  { value: 'overlay' as const, label: 'На фото' },
]

export const mobileDishCardOptions = [
  { value: 'vertical' as const, label: 'Вертикальная' },
  { value: 'horizontal' as const, label: 'Горизонтальная' },
]

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
      enabled: false,
      size: 'fullscreen',
      bgType: 'none',
      overlayColor: '#000000',
      overlayOpacity: 0.4,
      contentPosition: 5,
      contentAlign: 'left',
      gradientId: 'diag-bp',
    },
    banners: { enabled: false, displayMode: 'single', autoplay: false, autoplayInterval: 4 },
    menu: { enabled: true, defaultView: 'categories', tagDisplayMode: 'both', dishDescriptionMode: 'below', mobileDishCard: 'vertical' },
    gallery: { enabled: false, galleryIds: [] },
    reviews: { enabled: false },
    delivery: { enabled: false },
  },
  sectionsOrder: ['categoryBar', 'hero', 'banners', 'menu', 'gallery', 'reviews', 'delivery'],
  pages: [],
  pageSettings: {
    menu: { defaultView: 'categories', tagDisplayMode: 'both', dishDescriptionMode: 'below', mobileDishCard: 'vertical' },
    delivery: { showMap: false, descriptionMode: 'auto' },
    gallery: { galleryIds: [] },
  },
})
