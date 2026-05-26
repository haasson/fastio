<template>
  <UiModal
    :model-value="modelValue"
    :title="tag ? 'Изменить тег' : 'Новый тег'"
    :width="560"
    :actions="actions"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef" class="form">
      <div data-tour="tag-name">
        <UiInput
          v-model="form.name"
          name="name"
          label="Название"
          :placeholder="namePlaceholder"
          :rules="[{ required: true, message: 'Введите название' }]"
        />
      </div>

      <div class="field" data-tour="tag-icon">
        <UiText size="small" weight="medium" class="label">Иконка</UiText>
        <div class="icon-grid">
          <UiPickerItem
            v-for="icon in iconPresets"
            :key="icon"
            :selected="form.icon === icon"
            class="icon-btn"
            @click="form.icon = icon"
          >
            <component :is="getIcon(icon)" :size="18" />
          </UiPickerItem>
        </div>
      </div>

      <div class="field" data-tour="tag-color">
        <UiText size="small" weight="medium" class="label">Цвет</UiText>
        <ColorSwatch
          v-model="form.color"
          :presets="tagColorOptions"
        />
      </div>

      <div class="field" data-tour="tag-preview">
        <UiText size="small" weight="medium" class="label">Превью</UiText>
        <div class="tag-preview" :style="previewStyle">
          <component :is="getIcon(form.icon)" :size="14" />
          <span>{{ form.name || 'Тег' }}</span>
        </div>
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiText } from '@fastio/ui'
import ColorSwatch, { type ColorOption } from '~/shared/ui/components/ColorSwatch.vue'
import type { DishTagDefinition } from '@fastio/shared'
import { TAG_COLOR_PRESETS, getTagColorPreset, getTagIconPresets, getTagNamePlaceholder } from '@fastio/shared'
import * as icons from 'lucide-vue-next'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { reportError } from '@fastio/shared/observability'

const props = defineProps<{
  modelValue: boolean
  tenantId: string
  tag: DishTagDefinition | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()
const tenantStore = useTenantStore()

const iconPresets = computed(() => getTagIconPresets(tenantStore.tenant.businessType, tenantStore.tenant.menuStyle))
const namePlaceholder = computed(() => getTagNamePlaceholder(tenantStore.tenant.businessType, tenantStore.tenant.menuStyle))
const tagColorOptions = computed<ColorOption[]>(() => TAG_COLOR_PRESETS.map((p) => ({ value: p.key, color: p.color, bg: p.background })),
)

const formRef = ref()
const saving = ref(false)

const form = ref({
  name: '',
  icon: 'Tag' as string,
  color: 'slate' as string,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = props.tag
        ? { name: props.tag.name, icon: props.tag.icon, color: props.tag.color }
        : { name: '', icon: 'Tag', color: 'slate' }
    }
  },
)

const actions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value, buttonProps: { 'data-tour': 'tag-save' } },
])

const previewStyle = computed(() => {
  const preset = getTagColorPreset(form.value.color)

  return preset
    ? { color: preset.color, backgroundColor: preset.background }
    : { color: '#475569', backgroundColor: '#f1f5f9' }
})

const getIcon = (name: string) => (icons as Record<string, unknown>)[name] ?? icons.Tag

const handleSave = async () => {
  form.value.name = form.value.name.trim()
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    const data = {
      name: form.value.name,
      icon: form.value.icon,
      color: form.value.color,
    }

    if (props.tag) {
      await api.tags.update(props.tag.id, data)
    } else {
      await api.tags.add(props.tenantId, data)
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    reportError(e, { context: 'TagFormModal:save', tenantId: props.tenantId, tagId: props.tag?.id ?? null })

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

.icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

// UiPickerItem уже делает border + selected ring. Здесь — только размер/фон/цвет иконки.
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-8);
  background: var(--color-fill-quaternary);
  color: var(--color-text-secondary);

  &:hover {
    background: var(--color-fill-tertiary);
  }

  &.ui-picker-item--selected {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.tag-preview {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-8);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  width: fit-content;
}
</style>
