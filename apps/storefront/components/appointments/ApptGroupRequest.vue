<template>
  <FsForm @submit="onSubmit">
    <div class="request-root">
      <div class="request-notice">
        <AlertCircle :size="16" class="notice-icon" />
        <p class="notice-text">{{ noticeText }}</p>
      </div>

      <div v-if="services.length > 0" class="services-list">
        <span class="services-label">Выбранные услуги</span>
        <ul class="services-names">
          <li v-for="service in services" :key="service.id" class="service-row">
            <span class="service-name">{{ service.name }}</span>
            <span class="service-meta">
              <span v-if="service.duration">{{ formatDuration(service.duration) }}</span>
              <span v-if="service.masterName" class="service-master">· {{ service.masterName }}</span>
            </span>
          </li>
        </ul>
      </div>

      <FsField
        label="Имя"
        required
        :model-value="form.customerName"
        :rules="[validationRules.name.required]"
      >
        <FsInput v-model="form.customerName" placeholder="Ваше имя" />
      </FsField>

      <FsField
        label="Телефон"
        required
        :model-value="form.customerPhone"
        :rules="[validationRules.phone.required, validationRules.phone.format]"
      >
        <FsInput
          v-model="form.customerPhone"
          type="tel"
          placeholder="+7 (999) 000-00-00"
          mask="+7 (###) ###-##-##"
        />
      </FsField>

      <FsField label="Примечания">
        <FsTextarea v-model="form.notes" placeholder="Пожелания, вопросы..." :rows="3" />
      </FsField>

      <FsButton type="submit" variant="primary" size="large" :loading="loading">
        Отправить заявку
      </FsButton>
      <FsButton variant="ghost" size="small" @click="emit('back')">← Назад</FsButton>
    </div>
  </FsForm>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { FsButton, FsField, FsForm, FsInput, FsTextarea } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import { formatMinutes } from '@fastio/shared'

type Service = { id: string; name: string; duration?: number; masterName?: string }

const formatDuration = (minutes: number) => formatMinutes(minutes)

type SubmitForm = {
  customerName: string
  customerPhone: string
  notes: string
}

const props = withDefaults(defineProps<{
  loading: boolean
  services: Service[]
  reason?: 'too-long' | 'manual'
}>(), { reason: 'manual' })

const noticeText = computed(() =>
  props.reason === 'too-long'
    ? 'Суммарное время визита превышает рабочий день. Оставьте заявку — мы свяжемся и подберём удобное время.'
    : 'Оставьте заявку — мы свяжемся и подберём удобное время под выбранные услуги.',
)

const emit = defineEmits<{
  submit: [form: SubmitForm]
  back: []
}>()

const form = reactive<SubmitForm>({
  customerName: '',
  customerPhone: '',
  notes: '',
})

const onSubmit = () => {
  emit('submit', { ...form })
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.request-root {
  @include flex-col(16px);
}

.request-notice {
  @include flex-row(10px);
  align-items: flex-start;
  padding: 12px;
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-radius: var(--radius-card);
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.notice-icon {
  color: var(--color-warning);
  flex-shrink: 0;
  margin-top: 1px;
}

.notice-text {
  @include text-caption;
  color: var(--color-text);
  margin: 0;
}

.services-list {
  @include flex-col(6px);
}

.services-label {
  @include text-xs(600);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.services-names {
  list-style: none;
  margin: 0;
  padding: 0;
  @include flex-col(4px);
}

.service-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.service-name {
  @include text-caption(500);
  flex: 1;
  min-width: 0;
}

.service-meta {
  @include text-xs;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}

.service-master {
  margin-left: 4px;
}
</style>
