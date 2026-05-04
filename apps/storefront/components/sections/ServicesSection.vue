<template>
  <FsSection v-bind="$attrs" class="services-root">
    <!-- Режим categories: сетка карточек категорий (как у блюд) -->
    <template v-if="defaultView === 'categories'">
      <div v-if="categories.length" class="services-content">
        <div class="categories-grid">
          <FsCard
            v-for="category in categories"
            :key="category.id"
            as="button"
            :image="categoryPhotos[category.id] ?? undefined"
            :image-alt="category.name"
            @click="navigateToCategory(category)"
          >
            <template v-if="!categoryPhotos[category.id]" #image>
              <div class="category-placeholder">
                <component :is="placeholderIcon" :size="32" />
              </div>
            </template>
            <FsText as="span" variant="body-sm" class="category-name">{{ category.name }}</FsText>
          </FsCard>
        </div>
      </div>
      <SfEmptyState v-else v-bind="emptyStateProps">
        <component :is="placeholderIcon" :size="48" />
      </SfEmptyState>
    </template>

    <!-- Список услуг -->
    <template v-else>
      <div v-if="displayCategories.length" class="services-content">
        <div
          v-for="category in displayCategories"
          :id="`category-${category.id}`"
          :key="category.id"
          class="category-block"
        >
          <div class="category-title">
            <FsHeading as="h3">{{ category.name }}</FsHeading>
          </div>
          <div class="services-grid">
            <SfProductCard
              v-for="svc in servicesByCategory[category.id] ?? []"
              :key="svc.id"
              variant="service"
              :product="buildProduct(svc)"
              :currency="currency"
              :duration="svc.duration"
              :can-book="bookingEnabled && svc.isBookable"
              :in-cart="isInCart(svc.id)"
              :mobile-compact="props.mobileServiceCard === 'horizontal'"
              @card-click="openModal(svc)"
              @add="addServiceToCart(svc)"
              @remove="removeServiceWithConfirm(svc)"
            />
          </div>
        </div>
      </div>
      <SfEmptyState v-else v-bind="emptyStateProps">
        <component :is="placeholderIcon" :size="48" />
      </SfEmptyState>
    </template>
  </FsSection>

  <SfProductModal
    v-if="modalService"
    v-model="showModal"
    :title="modalService.name"
    :photo="modalService.photos[0] ?? null"
    :description="modalService.longDescription || modalService.description || null"
  >
    <template #meta>
      <div class="meta">
        <span class="meta-item">{{ modalService.duration }} мин</span>
        <span v-if="modalService.price" class="meta-item meta-price">{{ modalService.price }} {{ currency }}</span>
      </div>
      <BranchAvailabilityHint :branch-ids="modalService.branchIds" />
    </template>
    <ServiceModalBody
      v-if="bookingEnabled"
      :key="modalService.id"
      :service="modalService"
      :currency="currency"
      :is-edit="isInCart(modalService.id)"
      @close="showModal = false"
    />
  </SfProductModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Tenant, Category } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'
import { useNuxtData, useRouter } from 'nuxt/app'
import { FsSection, FsHeading, FsCard, FsText } from '@fastio/public-ui'
import { useServicesStore, type ServiceCard } from '~/stores/services'
import { useCartStore } from '~/stores/cart'
import { useCurrency } from '~/composables/useCurrency'
import useLegalCompliance from '~/composables/useLegalCompliance'
import { useItemPlaceholder } from '~/composables/useItemPlaceholder'
import { resolveTagIcon } from '~/utils/tag-icons'
import SfProductCard from '~/components/sf/domain/SfProductCard.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import SfProductModal from '~/components/sf/domain/SfProductModal.vue'
import ServiceModalBody from '~/components/appointments/ServiceModalBody.vue'
import BranchAvailabilityHint from '~/components/branch/BranchAvailabilityHint.vue'
import { useConfirm } from '~/composables/useConfirm'

defineOptions({ inheritAttrs: false })

type ProductTag = {
  id: string
  name: string
  preset: { color: string; background: string } | undefined
  iconComponent: unknown
}

const props = withDefaults(defineProps<{
  defaultView?: 'categories' | 'dishes'
  categoryId?: string | null
  mobileServiceCard?: 'vertical' | 'horizontal'
}>(), { defaultView: 'dishes' })

const { data: tenant } = useNuxtData<Tenant>('tenant')
const servicesStore = useServicesStore()
const cart = useCartStore()
const currency = useCurrency()
const router = useRouter()
const { legalInfoComplete } = useLegalCompliance()
const { placeholderIcon } = useItemPlaceholder()

const bookingEnabled = computed(() =>
  tenant.value?.modules?.services === true && legalInfoComplete.value,
)

const categories = computed(() => servicesStore.visibleCategories)
const servicesByCategory = computed(() => servicesStore.servicesByCategory)

const displayCategories = computed(() =>
  props.categoryId
    ? categories.value.filter(c => c.id === props.categoryId)
    : categories.value,
)

const categoryPhotos = computed<Record<string, string | null>>(() =>
  categories.value.reduce((acc, cat) => {
    acc[cat.id] = cat.photoUrl ?? null
    return acc
  }, {} as Record<string, string | null>),
)

const navigateToCategory = (cat: Category) => {
  router.push(`/category/${cat.slug ?? cat.id}`)
}

const emptyStateProps = {
  title: 'Услуг пока нет',
  description: 'Загляните позже — каталог скоро пополнится',
}

const emit = defineEmits<{ 'service-click': [svc: ServiceCard] }>()

const modalService = ref<ServiceCard | null>(null)
const showModal = ref(false)

const openModal = (svc: ServiceCard) => {
  modalService.value = svc
  showModal.value = true
  emit('service-click', svc)
}

function resolveTags(svc: ServiceCard): ProductTag[] {
  return svc.tags
    .map<ProductTag | null>((tagId) => {
      const def = servicesStore.tagDefinitions.find((t) => t.id === tagId)
      if (!def) return null
      const preset = getTagColorPreset(def.color)
      const iconComponent = resolveTagIcon(def.icon)
      return { id: def.id, name: def.name, preset, iconComponent }
    })
    .filter((t): t is ProductTag => t !== null)
}

function buildProduct(svc: ServiceCard) {
  return {
    id: svc.id,
    name: svc.name,
    description: svc.description,
    photos: svc.photos,
    price: svc.price,
    tags: resolveTags(svc),
  }
}

function isInCart(serviceId: string): boolean {
  return cart.serviceItems.some((i) => i.serviceId === serviceId)
}

function addServiceToCart(svc: ServiceCard) {
  if (isInCart(svc.id)) return
  cart.add({
    kind: 'service',
    serviceId: svc.id,
    serviceName: svc.name,
    price: svc.price,
    duration: svc.duration,
    photo: svc.photos[0] ?? null,
    preferredResourceId: null,
    allowResourceChoice: svc.allowResourceChoice,
    _key: crypto.randomUUID(),
  })
}

const { confirm } = useConfirm()

async function removeServiceWithConfirm(svc: ServiceCard) {
  const ok = await confirm(`Убрать «${svc.name}» из корзины?`, {
    title: 'Удаление услуги',
    confirmLabel: 'Убрать',
    danger: true,
  })
  if (ok) cart.removeService(svc.id)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.services-content {
  max-width: 400px;
  margin-inline: auto;

  @include md { max-width: none; }
}

.services-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;

  @include md { grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @include mdl { grid-template-columns: repeat(3, 1fr); }
  @include lg { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}

.category-block {
  margin-bottom: 32px;

  &:last-child { margin-bottom: 0; }
}

.category-title {
  margin-bottom: 16px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @include md { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @include lg { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}

.category-placeholder {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
}

.category-name {
  padding: 10px 12px;
  font-weight: 600;
  line-height: 1.3;
}

.meta {
  @include flex-row(12px);
}

.meta-item {
  @include text-caption;
  color: var(--color-text-secondary);
}

.meta-price {
  @include text-caption(700);
  color: var(--primary);
}
</style>
