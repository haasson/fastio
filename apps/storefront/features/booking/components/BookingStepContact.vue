<template>
  <FsForm @submit="$emit('submit')">
    <FsField
      label="Имя"
      required
      :model-value="form.guestName"
      :rules="[validationRules.name.required]"
    >
      <FsInput v-model="form.guestName" placeholder="Ваше имя" data-testid="booking-name" />
    </FsField>

    <FsField
      label="Телефон"
      required
      :model-value="form.guestPhone"
      :rules="[validationRules.phone.required, validationRules.phone.format]"
    >
      <FsInput
        v-model="form.guestPhone"
        type="tel"
        placeholder="+7 (999) 000-00-00"
        mask="+7 (###) ###-##-##"
        data-testid="booking-phone"
      />
    </FsField>

    <FsField label="Комментарий">
      <FsTextarea v-model="form.comment" placeholder="Пожелания, аллергии..." :rows="3" />
    </FsField>

    <FsButton type="submit" variant="primary" size="large" data-testid="booking-submit" :loading="loading">
      Забронировать
    </FsButton>
    <p v-if="legalInfoComplete" class="consent-note">
      Нажимая кнопку «Забронировать», вы соглашаетесь с
      <a href="/privacy" target="_blank">обработкой персональных данных</a>
    </p>

    <FsButton variant="ghost" size="small" @click="$emit('back')">← Назад</FsButton>
  </FsForm>
</template>

<script setup lang="ts">
import { FsButton, FsField, FsForm, FsInput, FsTextarea } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import useLegalCompliance from '~/shared/composables/useLegalCompliance'

const { legalInfoComplete } = useLegalCompliance()

type BookingForm = {
  guestName: string
  guestPhone: string
  comment: string
}

const form = defineModel<BookingForm>('form', { required: true })

defineProps<{
  loading: boolean
}>()

defineEmits<{ submit: []; back: [] }>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.consent-note {
  @include consent-note;
}
</style>
