<template>
  <nav class="category-bar-root">
    <SfSection style="--section-spacing: 0">
      <SfScrollNav
        :items="navItems"
        :model-value="activeId"
        :overflow="overflow"
        @update:model-value="onSelect"
      />
    </SfSection>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfScrollNav from '~/components/sf/nav/SfScrollNav.vue'
import { useMenuStore } from '~/stores/menu'

const props = defineProps<{
  overflow: 'scroll' | 'wrap'
  stickyOffset?: number
}>()

const menuStore = useMenuStore()

const activeId = ref<string | number | undefined>(undefined)

const navItems = computed(() =>
  menuStore.visibleCategories.map((cat) => ({ id: cat.id, label: cat.name })),
)

let ignoreIO = false
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null

const onSelect = (id: string | number) => {
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

// ─── Scroll spy ──────────────────────────────────────────────────────────────

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

onMounted(setupScrollSpy)
watch(navItems, setupScrollSpy)
onUnmounted(() => io?.disconnect())
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.category-bar-root {
  background: var(--color-surface);
  padding: 0;
}
</style>
