<template>
  <div class="service-body-root">
    <div v-if="resources === null" class="chips-skeleton">
      <FsSkeleton v-for="n in 3" :key="n" variant="rect" height="32px" width="80px" rounded />
    </div>

    <DishChips
      v-else-if="resourceChips.length > 0"
      :title="resourceLabelCapitalized"
      :items="resourceChips"
      mode="radio"
      group-name="appt-resource"
      :model-value="[selectedResourceId]"
      @update:model-value="selectedResourceId = $event[0] ?? ANY_VALUE"
    />

    <FsButton variant="primary" size="large" class="add-btn" @click="onConfirm">
      {{ isEdit ? 'Сохранить' : 'В корзину' }}
    </FsButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'nuxt/app'
import { FsButton, FsSkeleton } from '@fastio/public-ui'
import DishChips from '~/components/sf/domain/DishChips.vue'
import { useCartStore } from '~/stores/cart'
import { reportError } from '~/utils/reportError'
import { useResourceLabel } from '~/composables/useResourceLabel'
import { useToast } from '~/composables/useToast'

const { capitalized: resourceLabelCapitalized, anyLabel: resourceAnyLabel } = useResourceLabel()
const toast = useToast()
const route = useRoute()

const branchId = computed(() => (route.query.branchId as string | undefined) ?? null)

type ServiceInfo = {
  id: string
  name: string
  description?: string | null
  price: number
  duration: number
  photos: string[]
}

const props = withDefaults(defineProps<{
  service: ServiceInfo
  currency?: string
  isEdit?: boolean
}>(), { currency: '₽', isEdit: false })

const emit = defineEmits<{
  close: []
}>()

const cart = useCartStore()

const ANY_VALUE = '__any__'
const resources = ref<Array<{ id: string; name: string }> | null>(null)
const selectedResourceId = ref<string>(ANY_VALUE)

const resourceChips = computed(() => {
  if (!resources.value?.length) return []
  return [
    { id: ANY_VALUE, label: resourceAnyLabel.value },
    ...resources.value.map((r) => ({ id: r.id, label: r.name })),
  ]
})

let loadGen = 0

async function loadResources(serviceId: string) {
  const gen = ++loadGen
  const current = cart.serviceItems.find((i) => i.serviceId === serviceId)
  selectedResourceId.value = current?.preferredResourceId ?? ANY_VALUE
  resources.value = null
  try {
    const params = new URLSearchParams({ serviceId })
    if (branchId.value) params.set('branchId', branchId.value)
    const data = await $fetch<Array<{ id: string; name: string }>>(
      `/api/appointments/resources?${params}`,
    )
    if (gen === loadGen) resources.value = data
  } catch (err) {
    reportError(err instanceof Error ? err : new Error('[ServiceModalBody] failed to load resources'))
    if (gen === loadGen) {
      resources.value = []
      toast.warning(
        `Не удалось загрузить ${resourceLabelCapitalized.value.toLowerCase()}`,
        'Можно записаться без выбора — администратор назначит свободного.',
      )
    }
  }
}

onMounted(() => loadResources(props.service.id))
watch(() => props.service.id, (id) => loadResources(id))

const onConfirm = () => {
  const resourceId = selectedResourceId.value === ANY_VALUE ? null : selectedResourceId.value
  if (props.isEdit) {
    const ok = cart.setPreferredResource(props.service.id, resourceId)
    if (!ok) {
      toast.warning('Услуги больше нет в корзине', 'Состав корзины изменился, добавьте услугу заново.')
      emit('close')
      return
    }
  } else {
    cart.add({
      kind: 'service',
      serviceId: props.service.id,
      serviceName: props.service.name,
      price: props.service.price,
      duration: props.service.duration,
      photo: props.service.photos[0] ?? null,
      preferredResourceId: resourceId,
      _key: crypto.randomUUID(),
    })
  }
  emit('close')
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.service-body-root {
  @include flex-col(16px);
}

.chips-skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.add-btn {
  width: 100%;
}
</style>
