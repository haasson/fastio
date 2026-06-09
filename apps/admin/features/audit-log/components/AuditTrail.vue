<template>
  <section v-if="enabled" class="audit-trail">
    <UiText v-if="loading" size="small" class="empty">Загрузка…</UiText>
    <UiEmpty v-else-if="logs.length === 0" text="Изменений пока не было" />
    <UiTimeline v-else>
      <UiTimelineItem
        v-for="log in logs"
        :key="log.id"
        :color="actionColor(log.action)"
      >
        <template #default>
          <div class="head">
            <UiTag
              :type="actionMeta(log.action).tone"
              size="small"
              round
              empty
            >
              {{ actionMeta(log.action).label }}
            </UiTag>
            <UiText v-if="showEntity && log.entityName" size="small" class="entity">
              {{ entityTypeLabel(log.entityType) }}: {{ log.entityName }}
            </UiText>
          </div>
          <div
            v-for="change in renderChanges(log)"
            :key="change.field"
            class="change"
          >
            <template v-if="change.kind === 'complex'">
              <span class="field-label">{{ change.label }}:</span>
              <span class="changed-note">изменено</span>
            </template>
            <template v-else-if="change.kind === 'price'">
              <span class="field-label">{{ change.label }}:</span>
              <span class="field-old">{{ change.oldValue }}</span>
              <span class="field-arrow">→</span>
              <span
                class="field-new"
                :class="{
                  'price-up': change.direction === 'up',
                  'price-down': change.direction === 'down',
                }"
              >
                {{ change.newValue }}
              </span>
            </template>
            <template v-else>
              <span class="field-label">{{ change.label }}:</span>
              <span class="field-old">{{ change.oldValue }}</span>
              <span class="field-arrow">→</span>
              <span class="field-new">{{ change.newValue }}</span>
            </template>
          </div>
        </template>
        <template #footer>
          <div class="meta">
            <span class="actor">{{ log.actorName ?? 'Система' }}</span>
            <template v-if="log.actorRole">
              <span class="sep">·</span>
              <span class="role">{{ log.actorRole }}</span>
            </template>
            <span class="sep">·</span>
            <span class="time">{{ formatRelativeTime(log.createdAt, now) }}</span>
          </div>
        </template>
      </UiTimelineItem>
    </UiTimeline>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useNow } from '@vueuse/core'
import { UiTimeline, UiTimelineItem, UiTag, UiText, UiEmpty } from '@fastio/ui'
import { COLORS } from '@fastio/kit'
import type { AuditLog } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { useAuditLog } from '../composables/useAuditLog'
import { entityTypeLabel, actionMeta, renderChanges } from '../utils/audit-labels'

const props = defineProps<{
  entityType: string
  entityId: string
  includeChildren?: boolean
  // Показывать тип+имя сущности у каждой записи (нужно при includeChildren).
  showEntity?: boolean
  refreshKey?: number
}>()

const { listForEntity, enabled } = useAuditLog()

const logs = ref<AuditLog[]>([])
const loading = ref(false)
// Тикает раз в минуту — относительное время («5 минут назад») не протухает,
// пока дровер открыт.
const now = useNow({ interval: 60_000 })

const actionColor = (action: string): string => {
  if (action === 'deleted') return COLORS.RED_500
  if (action === 'created') return COLORS.GREEN_500
  if (action === 'restored') return COLORS.ORANGE_400

  return COLORS.BLUE_500
}

const load = async () => {
  if (!enabled || !props.entityId) return
  loading.value = true
  try {
    logs.value = await listForEntity({
      entityType: props.entityType,
      entityId: props.entityId,
      includeChildren: props.includeChildren,
    })
  } catch (error) {
    reportError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => [props.entityId, props.refreshKey], load)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.audit-trail {
  min-height: 32px;
}

.empty {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.entity {
  color: var(--color-text-secondary);
}

.change {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-top: var(--space-4);
  font-size: var(--font-size-sm);
}

.field-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.field-old {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}

.field-arrow {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.field-new {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.price-up {
  color: var(--red-500);
}

.price-down {
  color: var(--green-500);
  font-weight: var(--font-weight-medium);
}

.changed-note {
  color: var(--color-text-secondary);
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.actor {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.sep,
.role,
.time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
