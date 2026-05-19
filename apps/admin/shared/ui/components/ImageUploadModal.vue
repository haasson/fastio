<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    :width="560"
    :closable="true"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="resetState"
  >
    <!-- Step 1: Pick image -->
    <template v-if="step === 'pick'">
      <div
        class="zone"
        :class="{ dragging }"
        @click="openPicker"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <UiIcon name="image" :size="32" color="var(--color-text-secondary)" />
        <UiText size="small" color="var(--color-text-secondary)">
          Перетащите или нажмите для загрузки
        </UiText>
      </div>

      <div class="url-row">
        <UiInput
          v-model="urlInput"
          placeholder="или вставьте ссылку на изображение"
          :clearable="false"
          @keydown.enter="loadFromUrl"
        />
        <UiButton
          type="primary"
          :disabled="!urlInput.trim()"
          :loading="urlLoading"
          @click="loadFromUrl"
        >
          Загрузить
        </UiButton>
      </div>

      <UiText v-if="urlError || pickError" size="tiny" color="var(--color-error)">
        {{ urlError || pickError }}
      </UiText>

      <input
        ref="inputRef"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="onFileChange"
      />
    </template>

    <!-- Step 2: Crop -->
    <template v-if="step === 'crop'">
      <div class="cropper-wrapper">
        <Cropper
          ref="cropperRef"
          class="cropper"
          :src="imageSrc"
          :stencil-props="stencilProps"
          :default-size="defaultSize"
          image-restriction="stencil"
        />
      </div>
    </template>

    <template #footer>
      <div class="footer">
        <UiButton
          v-if="step === 'crop'"
          type="text"
          icon="chevronLeft"
          @click="backToPick"
        >
          Назад
        </UiButton>
        <div class="footer-right">
          <UiButton type="default" @click="close">
            Отмена
          </UiButton>
          <UiButton
            v-if="step === 'crop'"
            type="primary"
            :loading="cropping"
            @click="applyCrop"
          >
            Готово
          </UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { UiModal, UiIcon, UiText, UiInput, UiButton } from '@fastio/ui'
import { useDatabase } from '~/shared/data/useDatabase'

export type ImageAspectRatio = '4:3' | '3:1' | '16:9' | '1:1' | 'free'

const props = withDefaults(defineProps<{
  modelValue: boolean
  aspectRatio?: ImageAspectRatio
  title?: string
  initialFile?: File | null
}>(), {
  aspectRatio: '4:3',
  title: 'Загрузка изображения',
  initialFile: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'done': [file: File]
}>()

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_FILE_MB = MAX_FILE_BYTES / 1024 / 1024

const step = ref<'pick' | 'crop'>('pick')
const inputRef = ref<HTMLInputElement | null>(null)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const imageSrc = ref<string | null>(null)
const dragging = ref(false)
const urlInput = ref('')
const urlLoading = ref(false)
const urlError = ref('')
const pickError = ref('')
const cropping = ref(false)

const validateFile = (file: File): boolean => {
  if (!file.type.startsWith('image/')) {
    pickError.value = 'Можно загрузить только изображение'

    return false
  }

  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)

    pickError.value = `Файл слишком большой (${sizeMb} MB). Максимум — ${MAX_FILE_MB} MB`

    return false
  }

  pickError.value = ''

  return true
}

const parsedRatio = computed(() => {
  if (props.aspectRatio === 'free') return undefined
  const [w, h] = props.aspectRatio.split(':').map(Number)

  return w / h
})

const stencilProps = computed(() => {
  if (!parsedRatio.value) return {}

  return { aspectRatio: parsedRatio.value }
})

const defaultSize = ({ imageSize }: { imageSize: { width: number; height: number } }) => ({
  width: imageSize.width,
  height: imageSize.height,
})

const openPicker = () => {
  pickError.value = ''
  inputRef.value?.click()
}

const goToCrop = (file: File) => {
  if (imageSrc.value) URL.revokeObjectURL(imageSrc.value)
  imageSrc.value = URL.createObjectURL(file)
  pickError.value = ''
  step.value = 'crop'
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]

  input.value = ''

  if (!file) return
  if (!validateFile(file)) return
  goToCrop(file)
}

const onDrop = (e: DragEvent) => {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]

  if (!file) return
  if (!validateFile(file)) return
  goToCrop(file)
}

const { proxyImage } = useDatabase()

const loadFromUrl = async () => {
  const url = urlInput.value.trim()

  if (!url) return

  urlError.value = ''
  pickError.value = ''
  urlLoading.value = true

  try {
    const blob = await proxyImage.fetchAsBlob(url)
    const contentType = blob.type || 'image/jpeg'
    const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
    const file = new File([blob], `url-image.${ext}`, { type: contentType })

    if (!validateFile(file)) {
      urlError.value = pickError.value
      pickError.value = ''

      return
    }

    goToCrop(file)
    urlInput.value = ''
  } catch (e) {
    urlError.value = e instanceof Error ? e.message : 'Не удалось загрузить изображение'
  } finally {
    urlLoading.value = false
  }
}

const applyCrop = async () => {
  const cropper = cropperRef.value

  if (!cropper) return

  cropping.value = true

  try {
    const { canvas } = cropper.getResult()

    if (!canvas) return

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9),
    )

    if (!blob) return

    const file = new File([blob], 'cropped.webp', { type: 'image/webp' })

    emit('done', file)
    close()
  } finally {
    cropping.value = false
  }
}

const backToPick = () => {
  step.value = 'pick'
  if (imageSrc.value) {
    URL.revokeObjectURL(imageSrc.value)
    imageSrc.value = null
  }
}

const close = () => {
  emit('update:modelValue', false)
}

const resetState = () => {
  if (imageSrc.value) {
    URL.revokeObjectURL(imageSrc.value)
    imageSrc.value = null
  }
  urlInput.value = ''
  urlError.value = ''
  pickError.value = ''
  urlLoading.value = false
  dragging.value = false
  cropping.value = false

  if (props.initialFile && validateFile(props.initialFile)) {
    imageSrc.value = URL.createObjectURL(props.initialFile)
    step.value = 'crop'
  } else {
    step.value = 'pick'
  }
}

watch(() => props.modelValue, (shown) => {
  if (shown) resetState()
})
</script>

<style scoped lang="scss">
.zone {
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-8);
  padding: var(--space-32) var(--space-16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &:hover,
  &.dragging {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.url-row {
  display: flex;
  gap: var(--space-8);
  align-items: stretch;
  margin-top: var(--space-12);
  width: 100%;

  :deep(:first-child) {
    flex: 1;
    min-width: 0;
  }
}

.hidden-input {
  display: none;
}

.cropper-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3;
  min-height: 300px;
  max-height: 60vh;
  border-radius: var(--radius-8);
  overflow: hidden;
}

.cropper {
  width: 100%;
  height: 100%;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-8);
}

.footer-right {
  display: flex;
  gap: var(--space-8);
  margin-left: auto;
}
</style>
