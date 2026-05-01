<template>
  <UiCard
    size="small"
    :class="['service-card', {
      'tone-success': tone === 'success',
      cancelled: pendingRemove,
      selected,
      interactive: clickable,
      compact,
    }]"
    @click="onCardClick"
  >
    <div class="service-row">
      <UiText :size="compact ? 'tiny' : 'small'" class="service-name">{{ name }}</UiText>
      <UiTag v-if="pendingRemove" size="small" type="error">Будет удалена</UiTag>
      <UiText :size="compact ? 'tiny' : 'small'" span class="service-price">{{ formatPrice(price) }}</UiText>
      <UiButton
        v-if="showRemove"
        type="text"
        size="small"
        icon="close"
        class="action-btn"
        @click.stop="emit('remove')"
      />
      <UiButton
        v-if="showRestore"
        type="text"
        size="small"
        class="action-btn"
        @click.stop="emit('restore')"
      >Вернуть</UiButton>
    </div>

    <UiText size="tiny" class="service-time">
      <template v-if="startTime">
        <span v-if="slotChanged" class="strike-old">
          {{ originalStartTime }}–{{ originalEndTime }}
        </span>
        <span :class="timeInvalid ? 'value-invalid' : (slotChanged ? 'value-new' : '')">
          {{ startTime }}–{{ endTime }}
        </span>
        <span class="dot-sep">•</span>
        <span class="muted">{{ formatMinutes(durationMinutes) }}</span>
      </template>
      <span v-else class="slot-empty">
        Слот не выбран — кликните, чтобы подобрать
      </span>
    </UiText>

    <UiText size="tiny" class="service-master">
      <template v-if="showAnyMaster">
        <span :class="masterInvalid ? 'value-invalid' : 'muted'">Любой исполнитель</span>
      </template>
      <template v-else-if="masterChanged">
        <span class="strike-old">{{ originalMasterName }}</span>
        <span class="dot-sep">→</span>
        <span :class="masterInvalid ? 'value-invalid' : 'value-new'">{{ masterName }}</span>
      </template>
      <template v-else>
        <span :class="masterInvalid ? 'value-invalid' : 'muted'">{{ masterName }}</span>
      </template>
      <UiButton
        v-if="editableMaster"
        type="text"
        size="tiny"
        icon="pencil"
        class="edit-master-btn"
        @click.stop="emit('editMaster')"
      />
    </UiText>

    <UiAlert v-if="alertText" type="error" class="validity-alert">
      {{ alertText }}
    </UiAlert>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiText, UiTag, UiButton, UiAlert } from '@fastio/ui'
import { formatPrice, formatMinutes } from '@fastio/shared'

const props = withDefaults(defineProps<{
  name: string
  price: number
  durationMinutes: number
  startTime?: string | null
  endTime?: string | null
  masterName?: string | null
  // Снапшоты исходных значений: если переданы и отличаются от текущих, рисуется
  // «старое зачёркнутое → новое». Не передавать для новых/переносных карточек.
  originalStartTime?: string | null
  originalEndTime?: string | null
  originalMasterName?: string | null
  pendingRemove?: boolean
  // Variant'ы:
  selected?: boolean // подсветка выбранной карточки (border + glow)
  clickable?: boolean // курсор-пойнтер + hover, эмитит click
  compact?: boolean // плотные отступы и шрифт чуть меньше
  showRemove?: boolean
  showRestore?: boolean
  editableMaster?: boolean // показать кнопку-карандаш у мастера, эмитит editMaster
  // Если true — вместо имени мастера показываем «Любой исполнитель». Используется
  // для услуг с auto-подбором (менеджеру неинтересно кого алгоритм выбрал) и для
  // несохранённых услуг где слот ещё не выбран.
  showAnyMaster?: boolean
  // Гранулярные флаги невалидности слота на дату визита.
  // timeInvalid — подсвечивает только строку времени.
  // masterInvalid — подсвечивает только мастера.
  // alertText — текст алерта внутри карточки (резюме проблемы).
  timeInvalid?: boolean
  masterInvalid?: boolean
  alertText?: string
  tone?: 'success' | null // светло-зелёный фон (для превью «после переноса»)
}>(), {
  startTime: null,
  endTime: null,
  masterName: null,
  originalStartTime: null,
  originalEndTime: null,
  originalMasterName: null,
  pendingRemove: false,
  selected: false,
  clickable: false,
  compact: false,
  showRemove: false,
  showRestore: false,
  editableMaster: false,
  showAnyMaster: false,
  timeInvalid: false,
  masterInvalid: false,
  alertText: '',
  tone: null,
})

const emit = defineEmits<{
  click: []
  remove: []
  restore: []
  editMaster: []
}>()

const slotChanged = computed(() => !!props.originalStartTime
  && !!props.startTime
  && (props.originalStartTime !== props.startTime || props.originalEndTime !== props.endTime))

const masterChanged = computed(() => !!props.originalMasterName
  && !!props.masterName
  && props.originalMasterName !== props.masterName)

const onCardClick = () => {
  if (!props.clickable || props.pendingRemove) return
  emit('click')
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

// UiCard внутри обёрнут в .card, у него border:none. Через :deep тянемся к нему,
// чтобы навесить dashed-border визита (превращающийся в solid при selected) и hover.
:deep(.card) {
  gap: var(--space-8);
  border: 1px dashed var(--color-border);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.service-card.compact :deep(.card) {
  padding: var(--space-8);
  gap: var(--space-2);
}

.service-card.cancelled :deep(.card) {
  opacity: 0.6;
}

.service-card.interactive :deep(.card) {
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.service-card.selected :deep(.card) {
  border-style: solid;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.service-card.tone-success :deep(.card) {
  background: var(--color-success-light);
  // Прозрачный border той же ширины, чтобы внутренняя ширина/высота совпадала
  // с обычной карточкой (1px dashed) и колонки выравнивались по высоте.
  border: 1px solid transparent;
}

.service-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.service-name {
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.service-price {
  font-weight: var(--font-weight-semibold);
  margin-left: auto;
  flex-shrink: 0;
  white-space: nowrap;
}

.action-btn {
  flex-shrink: 0;
}

.service-time,
.service-master {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.muted {
  color: var(--color-text-secondary);
}

.dot-sep {
  color: var(--color-text-hint);
}

.strike-old {
  text-decoration: line-through;
  color: var(--color-text-hint);
}

.value-new {
  color: var(--color-warning);
  font-weight: var(--font-weight-medium);
}

.value-invalid {
  color: var(--color-error);
  font-weight: var(--font-weight-medium);
}

.validity-alert {
  margin-top: var(--space-4);
}

.slot-empty {
  color: var(--color-text-hint);
  font-style: italic;
}

.edit-master-btn {
  margin-left: var(--space-4);
}
</style>
