<template>
  <nav class="category-bar-root">
    <FsSection style="--section-spacing: 0">
      <FsScrollNav
        :items="navItems"
        :model-value="activeId"
        :overflow="overflow"
        @update:model-value="onSelect"
      />
    </FsSection>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'nuxt/app'
import { FsSection, FsScrollNav } from '@fastio/public-ui'
import { useMenuStore } from '~/stores/menu'

const props = defineProps<{
  overflow: 'scroll' | 'wrap'
  stickyOffset?: number
  navigateOnClick?: boolean
}>()

const menuStore = useMenuStore()
const route = useRoute()
const router = useRouter()

const activeId = ref<string | number | undefined>(undefined)

const navItems = computed(() =>
  menuStore.visibleCategories.map((cat) => ({ id: cat.id, label: cat.name })),
)

const categoryPath = (id: string | number) => {
  const cat = menuStore.visibleCategories.find(c => c.id === String(id))
  return `/category/${cat?.slug ?? String(id)}`
}

const onSelect = (id: string | number) => {
  if (props.navigateOnClick) {
    const path = categoryPath(id)
    // replace между страницами категорий, чтобы не засорять history
    if (route.path.startsWith('/category/')) {
      router.replace(path)
    } else {
      router.push(path)
    }
    return
  }

  activeId.value = id
  if (!import.meta.client) return
  const el = document.getElementById(`category-${id}`)
  if (!el) return

  ignoreIO = true
  const top = el.getBoundingClientRect().top + window.scrollY - (props.stickyOffset ?? 0) - 8
  window.scrollTo({ top, behavior: 'smooth' })

  const onScroll = () => {
    if (scrollEndTimer) clearTimeout(scrollEndTimer)
    scrollEndTimer = setTimeout(() => {
      ignoreIO = false
      window.removeEventListener('scroll', onScroll)
    }, 150)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
}

const syncActiveFromRoute = () => {
  const slug = route.params.slug as string | undefined
  if (!slug) return
  const cat = menuStore.visibleCategories.find(c => (c.slug ?? c.id) === slug)
  if (cat) activeId.value = cat.id
}

// ─── Scroll spy ──────────────────────────────────────────────────────────────

let ignoreIO = false
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null
let io: IntersectionObserver | null = null
const visibleIds = new Set<string>()

const syncActive = () => {
  if (ignoreIO) return
  for (const item of navItems.value) {
    if (visibleIds.has(String(item.id))) {
      activeId.value = item.id
      return
    }
  }
}

const setupScrollSpy = () => {
  if (!import.meta.client) return
  io?.disconnect()
  visibleIds.clear()

  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const id = e.target.id.replace('category-', '')
        if (e.isIntersecting) visibleIds.add(id)
        else visibleIds.delete(id)
      })
      syncActive()
    },
    { rootMargin: '0px 0px -60% 0px', threshold: 0 },
  )

  navItems.value.forEach((item) => {
    const el = document.getElementById(`category-${item.id}`)
    if (el) io!.observe(el)
  })
}

onMounted(() => {
  if (props.navigateOnClick) {
    syncActiveFromRoute()
    return
  }
  setupScrollSpy()
})

watch(navItems, () => {
  if (props.navigateOnClick) {
    syncActiveFromRoute()
    return
  }
  setupScrollSpy()
})

watch(() => route.params.slug, () => {
  if (props.navigateOnClick) syncActiveFromRoute()
})

onUnmounted(() => io?.disconnect())
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.category-bar-root {
  background: var(--color-surface);
  padding: 0;
}
</style>
