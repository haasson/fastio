<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]" current="Профиль">

        <div class="profile-root">
          <FsForm class="form" @submit="onSave">
            <FsField v-slot="{ hasError }" label="Имя" required name="name" :model-value="name" :rules="[validationRules.name.required]">
              <FsInput v-model="name" placeholder="Ваше имя" :error="hasError" />
            </FsField>

            <FsField v-slot="{ hasError }" label="Телефон" name="phone" :model-value="phone" :rules="[validationRules.phone.format]">
              <FsInput v-model="phone" type="tel" placeholder="+7 (999) 123-45-67" mask="+7 (###) ###-##-##" :error="hasError" />
            </FsField>

            <FsField label="Email">
              <FsInput :model-value="authStore.customerEmail" disabled />
            </FsField>

            <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>
            <FsAlert v-if="saved" type="success">Сохранено</FsAlert>

            <FsButton type="submit" :disabled="loading">
              {{ loading ? 'Сохранение...' : 'Сохранить' }}
            </FsButton>
          </FsForm>

          <div class="security-block">
            <div class="security-title">Безопасность</div>
            <FsAlert v-if="revokeError" type="error">{{ revokeError }}</FsAlert>
            <FsButton
              variant="outline"
              :disabled="revoking"
              data-testid="revoke-all-sessions"
              @click="onRevokeAll"
            >
              {{ revoking ? 'Выходим...' : 'Выйти со всех устройств' }}
            </FsButton>
            <p class="security-hint">
              Завершит все ваши сессии в этом заведении, включая текущую. Полезно, если вы заходили с чужого устройства.
            </p>
          </div>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { FsSection, FsField, FsForm, FsInput, FsButton, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import { useAuthStore } from '~/features/auth'
import { useConfirm } from '~/shared/composables/useConfirm'
import { reportError } from '@fastio/shared/observability'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
const { confirm } = useConfirm()

const name = ref('')
const phone = ref('')
const serverError = ref('')
const loading = ref(false)
const saved = ref(false)

const revoking = ref(false)
const revokeError = ref('')

onMounted(async () => {
  await authStore.init()
  if (!isAuthenticated.value) {
    authStore.showLogin()
    navigateTo('/')
    return
  }
  name.value = authStore.customerName
  phone.value = authStore.customerPhone
})

async function onSave() {
  serverError.value = ''
  saved.value = false
  loading.value = true
  try {
    await authStore.updateProfile({ name: name.value, phone: phone.value })
    saved.value = true
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка сохранения'
  } finally {
    loading.value = false
  }
}

async function onRevokeAll() {
  const ok = await confirm(
    'Все ваши сессии в этом заведении будут завершены. Текущая тоже — придётся войти заново.',
    {
      title: 'Выйти со всех устройств?',
      confirmLabel: 'Выйти отовсюду',
      cancelLabel: 'Отмена',
      danger: true,
    },
  )

  if (!ok) return

  revoking.value = true
  revokeError.value = ''

  try {
    await $fetch('/api/auth/revoke-all-sessions', { method: 'POST' })
    // Серверная кука стёрта эндпоинтом, но клиентский authStore про это
    // не знает — чистим его явно. logout() также подметает Supabase legacy session.
    await authStore.logout()
    await navigateTo('/')
  } catch (err: unknown) {
    // Zombie-state guard: revoke-endpoint мог УСПЕТЬ стереть куку до того как
    // authStore.logout() упал (network blip / 500). UI в этом случае держит
    // customer в сторе, а на сервере куки нет → следующий /api/customer/* = 401.
    // forceClear() синхронизирует client-state независимо от того где именно упало.
    authStore.forceClear()
    const fetchErr = err as { data?: { message?: string } }
    revokeError.value = fetchErr?.data?.message ?? 'Не удалось завершить сессии'
    reportError(err)
  } finally {
    revoking.value = false
  }
}
</script>

<style scoped lang="scss">
.profile-root {
  max-width: 400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form {
  // gap handled by FsForm
}

.security-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.security-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.security-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-secondary);
  margin: 0;
}
</style>
