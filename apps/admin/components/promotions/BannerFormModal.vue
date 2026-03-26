<template>
  <UiModal
    :model-value="modelValue"
    :title="banner ? 'Редактировать баннер' : 'Новый баннер'"
    :width="620"
    :actions="modalActions"
    :loading="saving"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef">
      <div class="field">
        <span class="field-label">Изображение *</span>
        <ImageUploadTrigger
          v-model="form.url"
          aspect-ratio="3:1"
          modal-title="Баннер"
          @pending="pendingFile = $event; imageError = false"
        />
        <span v-if="imageError" class="field-error">Загрузите изображение</span>
      </div>

      <div class="switch-row">
        <UiSwitch v-model="form.enabled" label="Активен" />
      </div>

      <UiSelect
        v-model:value="linkType"
        label="При клике"
        :options="linkTypeOptions"
      />

      <UiSelect
        v-if="linkType === 'promotion'"
        v-model:value="form.promotionId"
        label="Акция"
        :options="promotionOptions"
        placeholder="Выберите акцию"
        clearable
      />

      <UiSelect
        v-if="linkType === 'promo_code'"
        v-model:value="form.promoCodeId"
        label="Промокод"
        :options="promoCodeOptions"
        placeholder="Выберите промокод"
        clearable
      />

      <UiSelect
        v-if="linkType === 'page'"
        v-model:value="form.page"
        label="Страница"
        :options="pageOptions"
        placeholder="Выберите страницу"
        clearable
      />

      <UiInput
        v-if="linkType === 'custom'"
        v-model="form.link"
        name="link"
        label="Ссылка"
        placeholder="https://..."
        :rules="[{ type: 'required', message: 'Введите ссылку' }]"
      />

      <RichTextEditor
        v-model="form.content"
        label="Контент страницы"
      />
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiSwitch, UiSelect, UiInput } from '@fastio/ui'
import type { ModalAction } from '@fastio/ui'
import type { Banner, BannerFormData, Promotion, PromoCode } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'
import RichTextEditor from '~/components/ui/RichTextEditor.vue'

const props = defineProps<{
  modelValue: boolean
  banner: Banner | null
  promotions: Promotion[]
  promoCodes: PromoCode[]
  pages: string[]
  saving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: BannerFormData, file: File | null]
}>()

// ─── Form state ───────────────────────────────────────────────

type LinkType = 'none' | 'promotion' | 'promo_code' | 'page' | 'custom'

const form = ref<BannerFormData>({
  url: '',
  enabled: true,
  promotionId: null,
  promoCodeId: null,
  link: null,
  page: null,
  content: '',
})

const formRef = ref<InstanceType<typeof UiForm> | null>(null)
const pendingFile = ref<File | null>(null)
const imageError = ref(false)

const getLinkType = (b: Banner | null): LinkType => {
  if (!b) return 'none'
  if (b.promotionId) return 'promotion'
  if (b.promoCodeId) return 'promo_code'
  if (b.page) return 'page'
  if (b.link) return 'custom'

  return 'none'
}

const linkType = ref<LinkType>('none')

watch(() => props.modelValue, (open) => {
  if (!open) return
  const b = props.banner

  pendingFile.value = null
  imageError.value = false
  linkType.value = getLinkType(b)
  form.value = {
    url: b?.url ?? '',
    enabled: b?.enabled ?? true,
    promotionId: b?.promotionId ?? null,
    promoCodeId: b?.promoCodeId ?? null,
    link: b?.link ?? null,
    page: b?.page ?? null,
    content: b?.content ?? '',
  }
}, { immediate: true })

watch(linkType, (val) => {
  if (val !== 'promotion') form.value.promotionId = null
  if (val !== 'promo_code') form.value.promoCodeId = null
  if (val !== 'page') form.value.page = null
  if (val !== 'custom') form.value.link = null
})

// ─── Options ─────────────────────────────────────────────────

const linkTypeOptions = [
  { label: 'Ничего не происходит', value: 'none' },
  { label: 'Страница сайта', value: 'page' },
  { label: 'Страница акции', value: 'promotion' },
  { label: 'Страница промокода', value: 'promo_code' },
  { label: 'Внешняя ссылка', value: 'custom' },
]

const promotionOptions = computed(() => props.promotions.map((p) => ({ label: p.title, value: p.id })),
)

const promoCodeOptions = computed(() => props.promoCodes.map((p) => ({ label: p.code, value: p.id })),
)

const pageOptions = computed(() => props.pages.map((p) => ({ label: featureLabel(p), value: p })),
)

// ─── Actions ─────────────────────────────────────────────────

const modalActions = computed((): ModalAction[] => [
  { text: 'Отмена', type: 'default', actionType: 'decline' },
  { text: props.banner ? 'Сохранить' : 'Добавить', type: 'primary', actionType: 'confirm', loading: props.saving },
])

const onConfirm = () => {
  const fieldsValid = formRef.value?.validate() ?? true

  if (!form.value.url && !pendingFile.value) {
    imageError.value = true

    return false
  }

  if (!fieldsValid) return false

  imageError.value = false
  emit('save', { ...form.value }, pendingFile.value)
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.switch-row {
  align-self: flex-start;
}

.field-error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
