<template>
  <div class="root">
    <UiFormSection title="Браузерные уведомления" :columns="1">
      <div class="prefs">
        <div class="pref">
          <div>
            <UiText size="small" class="pref-label">Мигающий счётчик в меню</UiText>
            <span class="hint">Счётчик новых заказов будет мигать в боковом меню</span>
          </div>
          <UiSwitch v-model="blinkingCounter" />
        </div>
      </div>
    </UiFormSection>

    <UiFormSection v-if="gate.telegramNotifications.value.enabled" title="Telegram" :columns="1">
      <UiText size="small" class="tg-intro">
        Подключи личный чат или группу — бот будет писать туда о каждом новом заказе и бронировании.
        Можно подключить несколько чатов: сообщения улетят во все сразу.
      </UiText>

      <div v-if="subscribers.length" class="subs">
        <div v-for="sub in subscribers" :key="sub.id" class="sub">
          <span class="sub-icon">
            <UiIcon :name="sub.chatType === 'private' ? 'smartphone' : 'users'" :size="20" />
          </span>
          <div class="sub-info">
            <UiText size="small" class="sub-label">{{ sub.label ?? 'Telegram-чат' }}</UiText>
            <UiText size="tiny" class="sub-meta">
              {{ chatTypeLabel(sub.chatType) }} · подключён {{ formatDate(sub.addedAt) }}
            </UiText>
          </div>
          <UiButton
            size="small"
            :loading="removingId === sub.id"
            @click="disconnect(sub)"
          >
            Отключить
          </UiButton>
        </div>
      </div>

      <UiEmpty v-else message="Пока нет подключённых чатов" />

      <UiButton
        size="small"
        type="primary"
        :loading="generating"
        class="add-btn"
        @click="connect"
      >
        {{ subscribers.length ? 'Подключить ещё чат' : 'Подключить Telegram' }}
      </UiButton>
    </UiFormSection>
  </div>

  <TelegramConnectModal
    v-model="showModal"
    :dm-deep-link="dmDeepLink"
    :group-deep-link="groupDeepLink"
    :dm-qr-data-url="dmQrDataUrl"
    :group-qr-data-url="groupQrDataUrl"
    :polling="polling"
    :just-connected="justConnected"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { UiFormSection, UiButton, UiText, UiIcon, UiSwitch, UiEmpty, useMessage } from '@fastio/ui'
import type { TenantTelegramSubscriber } from '@fastio/shared'
import { useNotificationPrefs } from '~/features/settings'
import TelegramConnectModal from '~/features/settings/components/TelegramConnectModal.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { useRuntimeConfig } from '#imports'
import { useDatabase } from '~/shared/data/useDatabase'
import { useConfirm } from '@fastio/kit'
import { renderQrToDataUrl } from '~/shared/utils/renderQr'

const { blinkingCounter } = useNotificationPrefs()
const tenantStore = useTenantStore()
const gate = useGate()
const { telegramLink } = useDatabase()
const { confirm } = useConfirm()
const { success } = useMessage()

const generating = ref(false)
const removingId = ref<string | null>(null)
const showModal = ref(false)
const linkCode = ref('')
const polling = ref(false)
const justConnected = ref(false)
const subscribers = ref<TenantTelegramSubscriber[]>([])
const subsCountAtOpen = ref(0)
const dmQrDataUrl = ref('')
const groupQrDataUrl = ref('')

let pollInterval: ReturnType<typeof setInterval> | null = null

const botUsername = useRuntimeConfig().public.telegramTenantBotUsername

const dmDeepLink = computed(() => `https://t.me/${botUsername}?start=${linkCode.value}`)
const groupDeepLink = computed(() => `https://t.me/${botUsername}?startgroup=${linkCode.value}`)

const chatTypeLabel = (type: TenantTelegramSubscriber['chatType']): string => {
  if (type === 'private') return 'Личный чат'
  if (type === 'channel') return 'Канал'

  return 'Группа'
}

const formatDate = (iso: string): string => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso))

const loadSubscribers = async () => {
  const tid = tenantStore.currentTenantId

  if (!tid) return

  subscribers.value = await telegramLink.listSubscribers(tid)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  polling.value = false
}

const startPolling = () => {
  polling.value = true
  pollInterval = setInterval(async () => {
    await loadSubscribers()

    if (subscribers.value.length > subsCountAtOpen.value) {
      stopPolling()
      justConnected.value = true
      setTimeout(() => {
        showModal.value = false
      }, 2000)
    }
  }, 3000)
}

watch(showModal, (open) => {
  if (!open) {
    stopPolling()
    justConnected.value = false
  }
})

onMounted(() => {
  loadSubscribers()
})

onUnmounted(() => stopPolling())

const connect = async () => {
  const tid = tenantStore.currentTenantId

  if (!tid) return

  generating.value = true
  try {
    // 6 цифр читается проще буквенно-цифровой смеси. Энтропия закрывается
    // server-side rate-limit'ом в /api/telegram/webhook (5 попыток/15 мин на chat).
    // crypto.getRandomValues — чтобы выход PRNG не восстанавливался по нескольким
    // наблюдениям (Math.random в V8 — xorshift128+, state восстанавливается за ~5).
    //
    // Деление вместо `% 900000` — modulo-bias на Uint32: 2³² mod 900000 = 167296,
    // т.е. первые ~167K значений (100000-267295) встречались бы в 2× чаще. Через
    // floor(buf/2³² * 900000) bias уходит (uniform mapping [0,1) → [0, 900000)).
    //
    // PK-коллизия в окне 3 мин крайне маловероятна; если упадёт INSERT — юзер
    // просто кликнет «Подключить» ещё раз.
    const buf = new Uint32Array(1)

    globalThis.crypto.getRandomValues(buf)
    const code = (100000 + Math.floor((buf[0] / 0x100000000) * 900000)).toString()

    await telegramLink.upsertCode(tid, code)
    linkCode.value = code

    // QR заранее, чтобы при открытии модалки не было «прыжка» от пустого слота к картинке.
    const [dm, group] = await Promise.all([
      renderQrToDataUrl(dmDeepLink.value, 160),
      renderQrToDataUrl(groupDeepLink.value, 160),
    ])

    dmQrDataUrl.value = dm
    groupQrDataUrl.value = group

    justConnected.value = false
    subsCountAtOpen.value = subscribers.value.length
    showModal.value = true
    startPolling()
  } finally {
    generating.value = false
  }
}

const disconnect = async (sub: TenantTelegramSubscriber) => {
  const ok = await confirm({
    title: 'Отключить чат?',
    message: `${sub.label ?? 'Telegram-чат'} перестанет получать уведомления о заказах и бронированиях.`,
    confirmText: 'Отключить',
    confirmType: 'error',
  })

  if (!ok) return

  removingId.value = sub.id
  try {
    await telegramLink.removeSubscriber(sub.id)
    await loadSubscribers()
    success('Чат отключён')
  } finally {
    removingId.value = null
  }
}

</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.root {
  @include flex-col(var(--space-12));
  max-width: 680px;
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
}

.prefs {
  @include flex-col(var(--space-12));
}

.pref {
  @include flex-between(var(--space-16));
}

.pref-label {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-4);
  display: block;
}

.tg-intro {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.subs {
  @include flex-col(var(--space-8));
}

.sub {
  @include flex-row(var(--space-12));
  padding: var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-12);
  align-items: center;
}

.sub-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.sub-info {
  flex: 1;
  min-width: 0;
}

.sub-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-title);
  margin-bottom: var(--space-2);
}

.sub-meta {
  color: var(--color-text-secondary);
}

.add-btn {
  align-self: flex-start;
  margin-top: var(--space-8);
}
</style>
