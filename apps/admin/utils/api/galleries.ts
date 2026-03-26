import type { SupabaseClient } from '@supabase/supabase-js'
import type { Gallery, GalleryFormData, GalleryPhoto } from '@fastio/shared'
import { query } from '~/utils/query'
import { optimizeImage } from '~/utils/imageOptimize'

const mapPhoto = (raw: Record<string, unknown>): GalleryPhoto => ({
  id: raw.id as string,
  galleryId: raw.gallery_id as string,
  tenantId: raw.tenant_id as string,
  url: raw.url as string,
  sortOrder: Number(raw.sort_order),
  createdAt: raw.created_at as string,
})

const mapGallery = (raw: Record<string, unknown>): Gallery => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  name: raw.name as string,
  title: (raw.title as string) ?? null,
  description: (raw.description as string) ?? null,
  autoplay: raw.autoplay as boolean,
  autoplayInterval: Number(raw.autoplay_interval),
  sortOrder: Number(raw.sort_order),
  createdAt: raw.created_at as string,
  photos: Array.isArray(raw.gallery_photos)
    ? (raw.gallery_photos as Record<string, unknown>[]).map(mapPhoto).sort((a, b) => a.sortOrder - b.sortOrder)
    : [],
})

const formToDb = (data: Partial<GalleryFormData>) => ({
  ...(data.name !== undefined && { name: data.name }),
  ...(data.title !== undefined && { title: data.title }),
  ...(data.description !== undefined && { description: data.description }),
  ...(data.autoplay !== undefined && { autoplay: data.autoplay }),
  ...(data.autoplayInterval !== undefined && { autoplay_interval: data.autoplayInterval }),
})

export const galleriesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Gallery[]> {
    const data = await query(
      sb.from('galleries')
        .select('*, gallery_photos(*)')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true }),
    )

    return (data ?? []).map(mapGallery)
  },

  async add(sb: SupabaseClient, tenantId: string, data: GalleryFormData, sortOrder: number): Promise<Gallery | null> {
    const result = await query(
      sb.from('galleries').insert({
        tenant_id: tenantId,
        sort_order: sortOrder,
        ...formToDb(data),
      }).select('*, gallery_photos(*)').single(),
    )

    return result ? mapGallery(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<GalleryFormData>): Promise<Gallery | null> {
    const result = await query(
      sb.from('galleries').update(formToDb(data)).eq('id', id).select('*, gallery_photos(*)').single(),
    )

    return result ? mapGallery(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('galleries').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder }) => query(sb.from('galleries').update({ sort_order: sortOrder }).eq('id', id))),
    )
  },

  // ─── Photos ───────────────────────────────────────────────────

  async addPhoto(sb: SupabaseClient, galleryId: string, tenantId: string, sortOrder: number): Promise<GalleryPhoto | null> {
    const result = await query(
      sb.from('gallery_photos').insert({
        gallery_id: galleryId,
        tenant_id: tenantId,
        sort_order: sortOrder,
      }).select().single(),
    )

    return result ? mapPhoto(result) : null
  },

  async updatePhoto(sb: SupabaseClient, id: string, data: Partial<Pick<GalleryPhoto, 'url'>>): Promise<GalleryPhoto | null> {
    const result = await query(
      sb.from('gallery_photos').update({ url: data.url }).eq('id', id).select().single(),
    )

    return result ? mapPhoto(result) : null
  },

  async removePhoto(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('gallery_photos').delete().eq('id', id))
  },

  async reorderPhotos(sb: SupabaseClient, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder }) => query(sb.from('gallery_photos').update({ sort_order: sortOrder }).eq('id', id))),
    )
  },

  async uploadPhoto(sb: SupabaseClient, tenantId: string, file: File, galleryId: string, photoId: string): Promise<string> {
    const blob = await optimizeImage(file)
    const path = `${tenantId}/gallery-${galleryId}/photo-${photoId}.webp`

    await query(sb.storage.from('tenant-assets').upload(path, blob, { contentType: 'image/webp', upsert: true }))

    const { publicUrl } = sb.storage.from('tenant-assets').getPublicUrl(path).data

    return `${publicUrl}?t=${Date.now()}`
  },
}
