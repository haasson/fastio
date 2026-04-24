<template>
  <UiModal
    :model-value="modelValue"
    :title="category ? 'Изменить категорию' : 'Новая категория'"
    :width="560"
    :actions="actions"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <div data-tour="category-photo">
        <ImageUploadTrigger
          :model-value="form.photoUrl"
          aspect-ratio="1:1"
          modal-title="Фото категории"
          compact
          width="72px"
          height="72px"
          @update:model-value="form.photoUrl = $event"
          @pending="pendingPhotoFile = $event"
        />
      </div>

      <div data-tour="category-name">
        <UiInput
          v-model="form.name"
          name="name"
          label="Название"
          placeholder="Пицца"
          :rules="[{ required: true, message: 'Введите название' }]"
          :readonly="isSpecial"
        />
      </div>

      <div>
        <UiInput
          v-model="form.slug"
          name="slug"
          label="Слаг для URL"
          placeholder="pizza"
          :rules="slugRules"
          :feedback="slugFeedback"
          @update:model-value="onSlugInput"
        />
      </div>

      <div v-if="!category && modeOptions.length > 1" class="field" data-tour="category-type">
        <UiText size="small" weight="medium" class="label">Тип</UiText>
        <UiSelect
          :value="formMode"
          :options="modeOptions"
          size="small"
          @update:value="onModeChange($event as FormMode)"
        />
      </div>

      <UiAlert v-if="formMode === 'virtual'" type="info">
        Виртуальная категория автоматически показывает все блюда с выбранным тегом из любых категорий. Блюда не переносятся — отображаются по тегу. Например, выберите тег «Новинки» — и все блюда с этим тегом появятся в категории.
      </UiAlert>

      <div v-if="formMode === 'virtual'" class="field">
        <UiText size="small" weight="medium" class="label">Тег</UiText>
        <UiSelect
          :value="form.tagId"
          :options="tagOptions"
          size="small"
          placeholder="Выберите тег"
          :rules="[{ required: true, message: 'Выберите тег' }]"
          @update:value="form.tagId = ($event as string) ?? null"
        />
      </div>

      <UiSwitch
        :model-value="form.active"
        label="Активна"
        @update:model-value="form.active = $event"
      />
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiText, UiSelect, UiSwitch, UiAlert, useMessage } from '@fastio/ui'
import type { Category, CategoryType, DishTagDefinition } from '@fastio/shared'
import { slugify } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAccess } from '~/composables/plan/useAccess'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'

type FormMode = 'regular' | 'virtual' | 'combo'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  category: Category | null
  tags?: DishTagDefinition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()
const { error: showError } = useMessage()
const access = useAccess()

const formRef = ref()
const saving = ref(false)
const formMode = ref<FormMode>('regular')
const pendingPhotoFile = ref<File | null>(null)
const slugEdited = ref(false)

const form = ref({
  name: '',
  slug: '' as string,
  type: 'regular' as CategoryType,
  tagId: null as string | null,
  active: true,
  photoUrl: null as string | null,
})

const isSpecial = computed(() => !!props.category && props.category.type !== 'regular')

const categoryToMode = (cat: Category): FormMode => {
  if (cat.type === 'combo') return 'combo'
  if (cat.tagId) return 'virtual'

  return 'regular'
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      pendingPhotoFile.value = null
      if (props.category) {
        form.value = {
          name: props.category.name,
          slug: props.category.slug ?? '',
          type: props.category.type,
          tagId: props.category.tagId,
          active: props.category.active,
          photoUrl: props.category.photoUrl,
        }
        formMode.value = categoryToMode(props.category)
        slugEdited.value = !!props.category.slug
      } else {
        form.value = { name: '', slug: '', type: 'regular', tagId: null, active: true, photoUrl: null }
        formMode.value = 'regular'
        slugEdited.value = false
      }
    }
  },
)

watch(() => form.value.name, (name) => {
  if (slugEdited.value) return
  form.value.slug = slugify(name)
})

const onSlugInput = (value: string | null) => {
  slugEdited.value = !!value && value.length > 0
}

const slugRules = [
  { type: 'required' as const, required: true, message: 'Введите слаг' },
  { type: 'pattern' as const, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Только строчные латинские буквы, цифры и дефис (не в начале/конце и без повторов)' },
  { type: 'maxLength' as const, max: 60, message: 'Не длиннее 60 символов' },
]

const slugFeedback = computed(() => form.value.slug
  ? `Адрес страницы: /category/${form.value.slug}`
  : 'Подставится автоматически из названия — можно изменить',
)

const modeOptions = computed<{ label: string; value: FormMode }[]>(() => [
  { label: 'Обычная', value: 'regular' },
  ...(access.virtualCategories.value ? [{ label: 'Виртуальная (по тегу)', value: 'virtual' as FormMode }] : []),
  ...(access.combos.value ? [{ label: 'Комбо', value: 'combo' as FormMode }] : []),
])

const onModeChange = (mode: FormMode) => {
  formMode.value = mode
  form.value.type = mode === 'combo' ? 'combo' : 'regular'
  if (mode !== 'virtual') form.value.tagId = null
}

const tagOptions = computed(() => (props.tags ?? []).map((t) => ({ label: t.name, value: t.id })))

const actions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value, buttonProps: { 'data-tour': 'category-save' } },
])

const handleSave = async () => {
  form.value.name = form.value.name.trim()
  form.value.slug = form.value.slug.trim()
  if (!formRef.value?.validate()) return false

  const slug = form.value.slug

  saving.value = true
  try {
    if (props.category) {
      const data: Record<string, unknown> = { name: form.value.name, active: form.value.active, tagId: form.value.tagId, slug }

      if (pendingPhotoFile.value) {
        if (props.category.photoUrl) await api.categories.deletePhoto(props.category.photoUrl)
        data.photoUrl = await api.categories.uploadPhoto(props.tenantId, pendingPhotoFile.value)
      } else if (form.value.photoUrl === null && props.category.photoUrl) {
        await api.categories.deletePhoto(props.category.photoUrl)
        data.photoUrl = null
      }

      await api.categories.update(props.category.id, data)
    } else {
      const cat = await api.categories.add(props.tenantId, {
        name: form.value.name,
        order: 0,
        type: form.value.type,
        tagId: formMode.value === 'virtual' ? form.value.tagId : null,
        slug,
      })

      if (cat && pendingPhotoFile.value) {
        const url = await api.categories.uploadPhoto(props.tenantId, pendingPhotoFile.value)

        await api.categories.update(cat.id, { photoUrl: url })
      }
    }

    emit('saved')
    emit('update:modelValue', false)
  } catch {
    showError('Не удалось сохранить категорию')

    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  @include modal-form;
}

</style>
