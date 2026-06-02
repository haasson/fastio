<template>
  <ClientOnly>
    <!-- Показываем кнопку только после загрузки конфига — без дефолтного фолбэка,
         чтобы не было мигания «Официант» → настроенный текст/иконка. -->
    <button
      v-if="loaded"
      class="call-waiter-btn"
      type="button"
      :disabled="loading"
      aria-label="Вызвать официанта"
      data-testid="call-waiter"
      @click="onClick"
    >
      <component :is="iconComponent" :size="18" />
      <span class="call-waiter-btn-label">{{ label }}</span>
    </button>

    <FsDrawer
      v-if="types.length > 1"
      v-model="pickerOpen"
      side="bottom"
      size="sm"
    >
      <div class="call-types">
        <button
          v-for="type in types"
          :key="type.id"
          type="button"
          class="call-type-row"
          :disabled="loading"
          @click="sendCall(type.id)"
        >
          <span class="call-type-name">{{ type.name }}</span>
        </button>
      </div>
    </FsDrawer>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FsDrawer } from '@fastio/public-ui'
import { BellRing, MessageCircle, ChefHat, UtensilsCrossed, CreditCard, Users, CircleHelp, Clock } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useToast } from '~/shared/composables/useToast'
import { reportError } from '@fastio/shared/observability'

const props = defineProps<{ tableId: string }>()

const { success: showSuccess, error: showError } = useToast()

// Иконки кнопки вызова. Имя приходит с сервера (имя из @fastio/icons), рендерим
// соответствующий lucide-компонент. null / неизвестное → колокольчик (дефолт).
const ICON_MAP: Record<string, Component> = {
  bellRing: BellRing,
  messageCircle: MessageCircle,
  chefHat: ChefHat,
  dishes: UtensilsCrossed,
  creditCard: CreditCard,
  users: Users,
  help: CircleHelp,
  clock: Clock,
}
const DEFAULT_LABEL = 'Официант'

type CallType = { id: string; name: string }

const types = ref<CallType[]>([])
const label = ref(DEFAULT_LABEL)
const iconName = ref<string | null>(null)
const loading = ref(false)
const loaded = ref(false)
const pickerOpen = ref(false)

const iconComponent = computed<Component>(() => (iconName.value && ICON_MAP[iconName.value]) || BellRing)

async function loadConfig() {
  try {
    const result = await $fetch<{ types: CallType[]; callButtonLabel?: string; callButtonIcon?: string | null }>(
      `/api/table/${props.tableId}/call-types`,
    )
    types.value = result.types
    if (result.callButtonLabel) label.value = result.callButtonLabel
    iconName.value = result.callButtonIcon ?? null
    loaded.value = true
  } catch (err) {
    // 403 при отсутствии cookie ожидаем (гость ещё не загрузил /api/table/[id]).
    // Не шумим в Sentry. loaded остаётся false → кнопка не показывается (фолбэка нет).
    const status = (err as { statusCode?: number })?.statusCode
    if (status !== 403 && status !== 404) {
      reportError(err instanceof Error ? err : new Error('[CallWaiterButton] failed to load config'))
    }
  }
}

function onClick() {
  if (loading.value || pickerOpen.value) return
  if (types.value.length > 1) {
    pickerOpen.value = true
    return
  }
  // types.length === 0 → отправляем без id (сервер использует дефолт «Вызвать официанта»);
  // types.length === 1 → отправляем единственный id.
  sendCall(types.value[0]?.id ?? null)
}

async function sendCall(callTypeId: string | null) {
  if (loading.value) return
  loading.value = true
  try {
    await $fetch(`/api/table/${props.tableId}/call`, {
      method: 'POST',
      body: callTypeId ? { callTypeId } : {},
    })
    pickerOpen.value = false
    showSuccess('Официант идёт', 'Скоро подойдёт к вашему столу')
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    // Кнопка НЕ блокируется кулдауном — частоту валидирует сервер. На 429 просто
    // показываем тост со сколько ещё ждать (retryAfter с сервера).
    if (status === 429) {
      const retryAfter = (err as { data?: { retryAfter?: number } })?.data?.retryAfter
      const wait = typeof retryAfter === 'number' ? ` Подождите ${retryAfter} с.` : ''
      showError('Официант уже идёт.' + wait)
      return
    }
    const message = (err as { data?: { message?: string }; statusMessage?: string })?.data?.message
      ?? (err as { statusMessage?: string })?.statusMessage
      ?? 'Не получилось вызвать. Попробуйте ещё раз.'
    showError(message)
    if (status !== 400 && status !== 403) {
      reportError(err instanceof Error ? err : new Error('[CallWaiterButton] failed to send call'))
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.call-waiter-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  border-radius: 999px;
  @include text-body-sm(600);
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
  white-space: nowrap;

  &:active:not(:disabled) {
    transform: scale(0.96);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.call-waiter-btn-label {
  @include text-body-sm(600);
}

.call-types {
  @include flex-col(4px);
  padding: 8px 0 16px;
}

.call-type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: var(--surface-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.call-type-name {
  @include text-body(500);
  color: var(--color-text);
}
</style>
