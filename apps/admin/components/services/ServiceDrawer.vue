<template>
  <UiDrawer
    :model-value="modelValue"
    :title="service ? 'Редактировать услугу' : 'Новая услуга'"
    :width="480"
    :actions="drawerActions"
    :on-confirm="onSave"
    :on-decline="() => true"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="service-drawer-root">
      <ImageUploadTrigger
        :model-value="photoUrl"
        aspect-ratio="4:3"
        modal-title="Фото услуги"
        @update:model-value="photoUrl = $event"
        @pending="pendingPhoto = $event"
      />

      <UiForm ref="formRef">
        <UiInput
          v-model="form.name"
          label="Название"
          name="name"
          :rules="[{ required: true, message: 'Укажите название' }]"
        />

        <UiInput
          v-model="form.description"
          label="Описание"
          name="description"
          type="textarea"
          :rows="3"
        />

        <div class="row-2">
          <UiInputNumber
            v-model="form.price"
            label="Цена"
            :min="0"
            :precision="0"
            :show-button="false"
            placeholder="0"
          />
          <UiInputNumber
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

        <UiSelect
          v-if="branchOptions.length > 1"
          v-model:value="form.branchIds"
          label="Филиалы"
          :options="branchOptions"
          multiple
          placeholder="Все филиалы"
        />

        <UiSelect
          v-model:value="form.bookingMode"
          label="Тип записи"
          :options="bookingModeOptions"
        />
      </UiForm>

      <UiCollapse :expanded-names="availableTags.length ? ['tags'] : []">
        <TagsSection v-model="form.tags" :available-tags="availableTags" />
      </UiCollapse>

      <div class="toggles">
        <div class="toggle-row">
          <UiText size="small" span>Запись онлайн</UiText>
          <UiSwitch v-model="form.isBookable" />
        </div>
        <div class="toggle-row">
          <UiText size="small" span>Клиент выбирает исполнителя</UiText>
          <UiSwitch v-model="form.allowResourceChoice" />
        </div>
        <div class="toggle-row">
          <UiText size="small" span>Активна</UiText>
          <UiSwitch v-model="form.active" />
        </div>
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiDrawer, UiForm, UiInput, UiInputNumber, UiSwitch, UiCollapse, UiSelect, UiText, useMessage } from '@fastio/ui'
import type { DrawerAction } from '@fastio/ui'
import type { ServiceWithBranchIds, Category, BookingMode } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTags } from '~/composables/data/useTags'
import { reportError } from '~/utils/reportError'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'
import TagsSection from '~/components/menu/form/TagsSection.vue'

const props = defineProps<{
  modelValue: boolean
  service: ServiceWithBranchIds | null
  categoryId: string | null
  categories: Category[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'saved': []
}>()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { tenantId } = storeToRefs(tenantStore)
const api = useDatabase()
const { tags: availableTags } = useTags(tenantId)
const message = useMessage()

const formRef = ref<{ validate: () => boolean } | null>(null)
const saving = ref(false)

const photoUrl = ref<string | null>(null)
const pendingPhoto = ref<File | null>(null)
const originalPhotoUrl = ref<string | null>(null)

const branchOptions = computed(() => branchStore.branches.map((b) => ({ label: b.name, value: b.id })),
)

const bookingModeOptions: { label: string; value: BookingMode }[] = [
  { label: 'Фикс. длительность', value: 'fixed' },
  { label: 'Открытое окончание (продлеваемое)', value: 'open_ended' },
]

const form = reactive({
  name: '',
  description: '',
  price: 0 as number,
  duration: 60 as number,
  tags: [] as string[],
  isBookable: true,
  bookingMode: 'fixed' as BookingMode,
  allowResourceChoice: true,
  branchIds: [] as string[],
  active: true,
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  const s = props.service

  if (s) {
    form.name = s.name
    form.description = s.description
    form.price = s.price
    form.duration = s.duration
    form.tags = [...s.tags]
    form.isBookable = s.isBookable
    form.bookingMode = s.bookingMode
    form.allowResourceChoice = s.allowResourceChoice
    form.branchIds = [...s.branchIds]
    form.active = s.active
    photoUrl.value = s.photos[0] ?? null
    originalPhotoUrl.value = s.photos[0] ?? null
  } else {
    Object.assign(form, {
      name: '', description: '', price: 0, duration: 60, tags: [],
      isBookable: true, bookingMode: 'fixed', allowResourceChoice: true,
      branchIds: [], active: true,
    })
    photoUrl.value = null
    originalPhotoUrl.value = null
  }
  pendingPhoto.value = null
})

const onSave = async () => {
  if (!formRef.value?.validate()) return false
  const tid = tenantStore.currentTenantId

  if (!tid) return false

  saving.value = true
  try {
    // Сначала загружаем новое фото — иначе при ошибке аплоада старое уже удалено,
    // а новое не залилось, и услуга остаётся без картинки.
    let photos: string[] = photoUrl.value ? [photoUrl.value] : []

    if (pendingPhoto.value) {
      const newUrl = await api.services.uploadPhoto(tid, pendingPhoto.value)

      photos = [newUrl]
      if (originalPhotoUrl.value) await api.services.deletePhoto(originalPhotoUrl.value)
    } else if (!photoUrl.value && originalPhotoUrl.value) {
      await api.services.deletePhoto(originalPhotoUrl.value)
      photos = []
    }

    const data = { ...form, categoryId: props.categoryId, photos, sortOrder: props.service?.sortOrder ?? 0 }

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
  { text: 'Сохранить', type: 'primary', actionType: 'confirm', loading: saving.value },
  { text: 'Отмена', type: 'default', actionType: 'decline' },
])
</script>

<style scoped lang="scss">
.service-drawer-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
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
</style>
