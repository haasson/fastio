import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/style.css'
import type { GalleryPhoto } from '@fastio/shared'

function getImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1600, height: 1200 })
    img.src = url
  })
}

export default (containerRef: Ref<HTMLElement | null>, photos: Ref<GalleryPhoto[]>) => {
  let lightbox: PhotoSwipeLightbox | null = null
  const sizeCache = new Map<string, { width: number; height: number }>()

  onMounted(async () => {
    // Подгружаем размеры всех фото в фоне
    await Promise.all(
      photos.value.map(async (p) => {
        const size = await getImageSize(p.url)
        sizeCache.set(p.url, size)
      }),
    )

    lightbox = new PhotoSwipeLightbox({
      dataSource: photos.value.map((p) => {
        const size = sizeCache.get(p.url) ?? { width: 1600, height: 1200 }
        return { src: p.url, ...size }
      }),
      pswpModule: () => import('photoswipe'),
    })

    lightbox.init()

    const el = containerRef.value
    if (!el) return

    el.addEventListener('click', handleClick)
  })

  onBeforeUnmount(() => {
    const el = containerRef.value
    if (el) el.removeEventListener('click', handleClick)
    lightbox?.destroy()
    lightbox = null
  })

  function handleClick(e: MouseEvent) {
    const slide = (e.target as HTMLElement).closest<HTMLElement>('[data-pswp-index]')
    if (!slide) return
    const index = Number(slide.dataset.pswpIndex)
    lightbox?.loadAndOpen(index)
  }
}
