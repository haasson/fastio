export type Gallery = {
  id: string
  tenantId: string
  name: string
  title: string | null
  description: string | null
  autoplay: boolean
  autoplayInterval: number
  sortOrder: number
  createdAt: string
  photos: GalleryPhoto[]
}

export type GalleryPhoto = {
  id: string
  galleryId: string
  tenantId: string
  url: string
  sortOrder: number
  createdAt: string
}

export type GalleryFormData = Omit<Gallery, 'id' | 'tenantId' | 'sortOrder' | 'createdAt' | 'photos'>
