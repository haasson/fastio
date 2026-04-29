<template>
  <FsForm @submit="$emit('submit')">
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

    <FsField label="Комментарий">
      <FsTextarea v-model="form.notes" placeholder="Пожелания, вопросы..." :rows="3" />
    </FsField>

    <FsButton type="submit" variant="primary" size="large" :loading="loading">
      Записаться
    </FsButton>
    <p v-if="legalInfoComplete" class="consent-note">
      Нажимая «Записаться», вы соглашаетесь с
      <a href="/privacy" target="_blank">обработкой персональных данных</a>
    </p>

    <FsButton variant="ghost" size="small" @click="$emit('back')">← Назад</FsButton>
  </FsForm>
</template>

<script setup lang="ts">
import { FsButton, FsField, FsForm, FsInput, FsTextarea } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import useLegalCompliance from '~/composables/useLegalCompliance'

const { legalInfoComplete } = useLegalCompliance()

type ContactForm = {
  customerName: string
  customerPhone: string
  notes: string
}

const form = defineModel<ContactForm>('form', { required: true })

defineProps<{ loading: boolean }>()

defineEmits<{ submit: []; back: [] }>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.fs-form {
  @include flex-col(16px);
}

.consent-note {
  @include consent-note;
}
</style>
