<template>
  <FsForm @submit="$emit('submit')">
    <FsField
      label="Имя"
      required
      :model-value="form.guestName"
      :rules="[validationRules.name.required]"
    >
      <FsInput v-model="form.guestName" placeholder="Ваше имя" />
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
      />
    </FsField>

    <FsField label="Комментарий">
      <FsTextarea v-model="form.comment" placeholder="Пожелания, аллергии..." :rows="3" />
    </FsField>

    <FsButton type="submit" variant="primary" size="large" :loading="loading">
      Забронировать
    </FsButton>

    <FsButton variant="ghost" size="small" @click="$emit('back')">← Назад</FsButton>
  </FsForm>
</template>

<script setup lang="ts">
import { FsButton, FsField, FsForm, FsInput, FsTextarea } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'

type BookingForm = {
  guestName: string
  guestPhone: string
  comment: string
}

defineProps<{
  form: BookingForm
  loading: boolean
}>()

defineEmits<{ submit: []; back: [] }>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.fs-form {
  @include flex-col(16px);
}
</style>
