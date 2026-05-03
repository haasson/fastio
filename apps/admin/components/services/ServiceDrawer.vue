<template>
  <UiDrawer
    :model-value="modelValue"
    :title="service ? 'Редактировать услугу' : 'Новая услуга'"
    :width="720"
    :actions="drawerActions"
    :on-confirm="onSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <BasicInfoSection
        :photo-url="currentPhotoUrl"
        :name="form.name"
        :price="form.price"
        :description="form.description"
        :show-weight="false"
        :category-id="form.categoryId ?? ''"
        :category-options="categoryOptions"
        :long-description="form.longDescription ?? ''"
        :show-long-description="form.showLongDescription"
        name-placeholder="Например: Ремонт холодильника"
        description-placeholder="Опишите услугу"
        @update:photo-url="currentPhotoUrl = $event"
        @update:photo-removed="photoRemoved = $event"
        @update:pending-photo="pendingPhotoFile = $event"
        @update:name="form.name = $event ?? ''"
        @update:price="form.price = $event ?? 0"
        @update:description="form.description = $event ?? ''"
        @update:category-id="form.categoryId = $event ? String($event) : null"
        @update:long-description="form.longDescription = $event ?? ''"
        @update:show-long-description="form.showLongDescription = $event"
      />

      <UiCollapse :expanded-names="['booking']" class="sections">
        <UiCollapseItem name="booking" title="Запись">
          <div class="booking-section">
            <div :class="form.bookingMode === 'fixed' ? 'row-2' : ''">
              <UiSelect
                v-model:value="form.bookingMode"
                label="Тип записи"
                :options="bookingModeOptions"
              />
              <UiInputNumber
                v-if="form.bookingMode === 'fixed'"
                v-model="form.duration"
                label="Длительность, мин"
                name="duration"
                :min="1"
                :max="480"
                :show-button="false"
                placeholder="60"
                :rules="[{ required: true, message: 'Укажите длительность' }]"
              />
            </div>

            <UiInputNumber
              v-if="form.bookingMode === 'variable'"
              v-model="form.maxDuration"
              label="Максимальная длительность, мин"
              :min="slotStep"
              :max="1440"
              :step="slotStep"
              :show-button="true"
              :placeholder="String(defaultMaxDuration)"
              message="Клиент выбирает время в пределах от 1 слота до этого максимума"
            />

            <UiSelect
              v-if="branchOptions.length > 1"
              v-model:value="form.branchIds"
              label="Филиалы"
              :options="branchOptions"
              multiple
              placeholder="Все филиалы"
            />

            <div class="toggles">
              <div class="toggle-row">
                <UiText size="small" span>Запись онлайн</UiText>
                <UiSwitch v-model="form.isBookable" />
              </div>
              <div class="toggle-row">
                <UiText size="small" span>Клиент выбирает исполнителя</UiText>
                <UiSwitch v-model="form.allowResourceChoice" />
              </div>
            </div>

            <div v-if="form.isBookable" class="resources-block">
              <UiText size="small" class="resources-label">{{ resourcesLabel }}</UiText>
              <div v-if="resourcesLoading" class="resources-skeleton">
                <UiSkeleton text :repeat="2" />
              </div>
              <template v-else-if="resources.length > 0">
                <div class="resources-list">
                  <UiTag v-for="r in resources" :key="r.id">{{ r.name }}</UiTag>
                </div>
              </template>
              <UiAlert v-else-if="form.categoryId" type="warning" class="resources-alert">
                {{ emptyResourcesText }}
                <NuxtLink :to="resourcesLink" class="alert-link">{{ resourcesLinkText }}</NuxtLink>
              </UiAlert>
            </div>
          </div>
        </UiCollapseItem>

        <TagsSection v-model="form.tags" :available-tags="availableTags" />

        <UiCollapseItem name="settings" title="Настройки">
          <div class="settings-section">
            <div class="toggle-row">
              <UiText size="small" span>Активна</UiText>
              <UiSwitch v-model="form.active" />
            </div>
          </div>
        </UiCollapseItem>
      </UiCollapse>
    </UiForm>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiDrawer, UiForm, UiInputNumber, UiSwitch, UiCollapse, UiCollapseItem, UiSelect, UiText, UiAlert, UiTag, UiSkeleton, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { Resource, ServiceWithBranchIds, Category, BookingMode } from '@fastio/shared'
import { NuxtLink } from '#components'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTags } from '~/composables/data/useTags'
import { reportError } from '~/utils/reportError'
import BasicInfoSection from '~/components/menu/form/BasicInfoSection.vue'
import TagsSection from '~/components/menu/form/TagsSection.vue'

const props = defineProps<{
  modelValue: boolean
  service: ServiceWithBranchIds | null
  initialCategoryId: string | null
  categories: Category[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'saved': []
}>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const appointmentSettingsStore = useAppointmentSettingsStore()
const { tenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const { tags: availableTags } = useTags(tenantId)
const message = useMessage()

const formRef = ref<{ validate: () => boolean } | null>(null)
const saving = ref(false)

const currentPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const photoRemoved = ref(false)
const originalPhotoUrl = ref<string | null>(null)

const resources = ref<Resource[]>([])
const resourcesLoading = ref(false)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })))
const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))

const bookingModeOptions: { label: string; value: BookingMode }[] = [
  { label: 'Фикс. длительность', value: 'fixed' },
  { label: 'Произвольная (клиент выбирает)', value: 'variable' },
]

const resourceMode = computed(() => appointmentSettingsStore.settings?.resourceMode ?? 'staff')
const slotStep = computed(() => appointmentSettingsStore.settings?.slotStepMinutes ?? 30)
const defaultMaxDuration = computed(() => appointmentSettingsStore.settings?.defaultMaxDuration ?? 180)

const resourcesLabel = computed(() => resourceMode.value === 'objects' ? 'Объекты для этой услуги' : 'Мастера для этой услуги',
)

const emptyResourcesText = computed(() => resourceMode.value === 'objects'
  ? 'К категории не привязан ни один объект — клиент не сможет записаться.'
  : 'К категории не привязан ни один мастер — клиент не сможет записаться.',
)

const resourcesLink = computed(() => resourceMode.value === 'objects' ? '/appointments/objects' : '/appointments/staff')
const resourcesLinkText = computed(() => resourceMode.value === 'objects' ? 'Перейти к объектам →' : 'Перейти к мастерам →')

const form = reactive({
  categoryId: null as string | null,
  name: '',
  description: '',
  longDescription: null as string | null,
  showLongDescription: false,
  price: 0 as number,
  duration: 60 as number,
  tags: [] as string[],
  isBookable: true,
  bookingMode: 'fixed' as BookingMode,
  maxDuration: null as number | null,
  allowResourceChoice: true,
  branchIds: [] as string[],
  active: true,
})

const loadResources = async (categoryId: string | null) => {
  if (!categoryId || !tenantId.value) {
    resources.value = []

    return
  }
  resourcesLoading.value = true
  try {
    resources.value = await api.resources.listByCategory(
      tenantId.value,
      categoryId,
      props.service?.id,
    )
  } catch (e) {
    reportError(e)
    resources.value = []
  } finally {
    resourcesLoading.value = false
  }
}

watch(() => form.categoryId, loadResources)

watch(() => props.modelValue, (open) => {
  if (!open) return
  const s = props.service
  const settings = appointmentSettingsStore.settings

  if (s) {
    form.categoryId = s.categoryId
    form.name = s.name
    form.description = s.description
    form.longDescription = s.longDescription
    form.showLongDescription = !!s.longDescription
    form.price = s.price
    form.duration = s.duration
    form.tags = [...s.tags]
    form.isBookable = s.isBookable
    form.bookingMode = s.bookingMode
    form.maxDuration = s.maxDuration
    form.allowResourceChoice = s.allowResourceChoice
    form.branchIds = [...s.branchIds]
    form.active = s.active
    currentPhotoUrl.value = s.photos[0] ?? null
    originalPhotoUrl.value = s.photos[0] ?? null
  } else {
    Object.assign(form, {
      categoryId: props.initialCategoryId,
      name: '', description: '', longDescription: null, showLongDescription: false,
      price: 0, duration: 60, tags: [],
      isBookable: settings?.defaultIsBookable ?? true,
      bookingMode: settings?.defaultBookingMode ?? 'fixed',
      maxDuration: null,
      allowResourceChoice: settings?.defaultAllowResourceChoice ?? true,
      branchIds: [], active: true,
    })
    currentPhotoUrl.value = null
    originalPhotoUrl.value = null
  }
  pendingPhotoFile.value = null
  photoRemoved.value = false
})

const onSave = async () => {
  if (!formRef.value?.validate()) return false
  const tid = tenantStore.currentTenantId

  if (!tid) return false

  saving.value = true
  try {
    let photos: string[] = currentPhotoUrl.value ? [currentPhotoUrl.value] : []

    if (pendingPhotoFile.value) {
      const newUrl = await api.services.uploadPhoto(tid, pendingPhotoFile.value)

      photos = [newUrl]
      if (originalPhotoUrl.value) await api.services.deletePhoto(originalPhotoUrl.value)
    } else if (photoRemoved.value && originalPhotoUrl.value) {
      await api.services.deletePhoto(originalPhotoUrl.value)
      photos = []
    }

    const { showLongDescription, ...formData } = form
    const data = {
      ...formData,
      photos,
      sortOrder: props.service?.sortOrder ?? 0,
      longDescription: showLongDescription && form.longDescription ? form.longDescription : null,
    }

    if (props.service) {
      await api.services.update(props.service.id, data)
    } else {
      await api.services.create(tid, data)
    }

    emit('saved')

    return true
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить услугу')

    return false
  } finally {
    saving.value = false
  }
}

const drawerActions = computed<DrawerAction[]>(() => [
  { text: 'Отмена', type: 'default', actionType: 'decline' },
  { text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving.value },
])
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.sections {
  margin-top: var(--space-4);
}

.booking-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.toggles {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-8) 0;
  border-top: 1px solid var(--color-border);
}

.settings-section {
  display: flex;
  flex-direction: column;
}

.resources-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.resources-label {
  color: var(--color-text-secondary);
}

.resources-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.resources-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.resources-alert {
  font-size: var(--font-size-sm);
}

.alert-link {
  display: block;
  margin-top: var(--space-4);
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
