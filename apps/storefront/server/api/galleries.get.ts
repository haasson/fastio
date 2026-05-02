import { getTenantDb } from '../utils/tenantDb'
import type { Gallery, GalleryPhoto } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const { data } = await db
    .from('galleries')
    .select('*, gallery_photos(*)')
    .order('sort_order', { ascending: true })

  return (data ?? []).map((row): Gallery => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    title: row.title ?? null,
    description: row.description ?? null,
    autoplay: row.autoplay,
    autoplayInterval: row.autoplay_interval,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    photos: (Array.isArray(row.gallery_photos) ? row.gallery_photos : [])
      .map((p: Record<string, unknown>): GalleryPhoto => ({
        id: p.id as string,
        galleryId: p.gallery_id as string,
        tenantId: p.tenant_id as string,
        url: p.url as string,
        sortOrder: Number(p.sort_order),
        createdAt: p.created_at as string,
      }))
      .filter((p: GalleryPhoto) => p.url)
      .sort((a: GalleryPhoto, b: GalleryPhoto) => a.sortOrder - b.sortOrder),
  }))
})
