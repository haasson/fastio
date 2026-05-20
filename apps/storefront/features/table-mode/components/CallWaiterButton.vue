<template>
  <ClientOnly>
    <button
      class="call-waiter-btn"
      type="button"
      :disabled="loading || cooldown"
      :aria-label="cooldown ? 'Официант уже идёт' : 'Вызвать официанта'"
      data-testid="call-waiter"
      @click="onClick"
    >
      <BellRing :size="18" />
      <span class="call-waiter-btn-label">{{ cooldown ? 'Официант идёт' : 'Официант' }}</span>
    </button>

    <FsDrawer
      v-if="types.length > 1"
      v-model="pickerOpen"
      title="Что нужно?"
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
import { ref, onMounted } from 'vue'
import { FsDrawer } from '@fastio/public-ui'
import { BellRing } from 'lucide-vue-next'
import { useToast } from '~/shared/composables/useToast'
import { reportError } from '@fastio/shared/observability'

const props = defineProps<{ tableId: string }>()

const { success: showSuccess, error: showError } = useToast()

// Fallback на случай если сервер не вернул значение (старый API / network glitch).
// Реальное значение приходит с сервера в `cooldownSeconds` (200) или `retryAfter` (429).
const FALLBACK_COOLDOWN_SECONDS = 30

type CallType = { id: string; name: string }

const types = ref<CallType[]>([])
const loading = ref(false)
const cooldown = ref(false)
const pickerOpen = ref(false)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

async function loadTypes() {
  try {
    const result = await $fetch<{ types: CallType[] }>(`/api/table/${props.tableId}/call-types`)
    types.value = result.types
  } catch (err) {
    // 403 при отсутствии cookie ожидаем (гость ещё не загрузил /api/table/[id]).
    // Не шумим в Sentry — UI просто покажет дефолтную кнопку без выбора.
    const status = (err as { statusCode?: number })?.statusCode
    if (status !== 403 && status !== 404) {
      reportError(err instanceof Error ? err : new Error('[CallWaiterButton] failed to load types'))
    }
  }
}

function onClick() {
  if (loading.value || cooldown.value || pickerOpen.value) return
  if (types.value.length > 1) {
    pickerOpen.value = true
    return
  }
  // types.length === 0 → отправляем без id (сервер использует дефолт «Вызвать официанта»);
  // types.length === 1 → отправляем единственный id.
  sendCall(types.value[0]?.id ?? null)
}

async function sendCall(callTypeId: string | null) {
  if (loading.value || cooldown.value) return
  loading.value = true
  try {
    const result = await $fetch<{ call: unknown; cooldownSeconds?: number }>(
      `/api/table/${props.tableId}/call`,
      {
        method: 'POST',
        body: callTypeId ? { callTypeId } : {},
      },
    )
    pickerOpen.value = false
    showSuccess('Официант идёт', 'Скоро подойдёт к вашему столу')
    startCooldown(result.cooldownSeconds ?? FALLBACK_COOLDOWN_SECONDS)
  } catch (err) {
    const message = (err as { data?: { message?: string }; statusMessage?: string })?.data?.message
      ?? (err as { statusMessage?: string })?.statusMessage
      ?? 'Не получилось вызвать. Попробуйте ещё раз.'
    showError(message)
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 429) {
      // Сервер знает сколько ещё ждать — синхронизируем клиентский cooldown.
      const retryAfter = (err as { data?: { retryAfter?: number } })?.data?.retryAfter
      startCooldown(typeof retryAfter === 'number' ? retryAfter : FALLBACK_COOLDOWN_SECONDS)
    } else if (status !== 400 && status !== 403) {
      reportError(err instanceof Error ? err : new Error('[CallWaiterButton] failed to send call'))
    }
  } finally {
    loading.value = false
  }
}

function startCooldown(seconds: number) {
  cooldown.value = true
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = setTimeout(() => {
    cooldown.value = false
    cooldownTimer = null
  }, Math.max(1, seconds) * 1000)
}

onMounted(loadTypes)
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
