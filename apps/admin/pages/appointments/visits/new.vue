<template>
  <div class="visit-new-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="goBack"
      >
        Назад
      </UiButton>
      <span class="page-title">Новый визит</span>
    </div>

    <VisitContent
      ref="contentRef"
      mode="create"
      :initial-preset="preset"
    />

    <div class="actions">
      <UiButton
        type="primary"
        :loading="contentRef?.saving"
        :disabled="!contentRef?.canSave || !contentRef?.dirty"
        @click="contentRef?.save()"
      >Сохранить</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton } from '@fastio/ui'
import VisitContent, { type EditorPreset } from '~/features/appointments/components/VisitContent.vue'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

const route = useRoute()
const router = useRouter()

const contentRef = ref<InstanceType<typeof VisitContent> | null>(null)

// Guard читает dirty из VisitContent через template ref. До mount'а ref=null → false (clean) — норм.
const isDirty = computed(() => Boolean(contentRef.value?.dirty))

useUnsavedGuard(isDirty)

// Префилл из таймлайна: ?date=YYYY-MM-DD&slotTime=HH:MM&resourceId=...&branchId=...
const preset = computed<EditorPreset | null>(() => {
  const date = route.query.date as string | undefined
  const slotTime = route.query.slotTime as string | undefined
  const resourceId = route.query.resourceId as string | undefined
  const branchId = route.query.branchId as string | undefined

  if (!date && !slotTime && !resourceId && !branchId) return null

  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    slotTime: slotTime && /^\d{2}:\d{2}$/.test(slotTime) ? slotTime : null,
    preferredResourceId: resourceId ?? null,
    branchId: branchId ?? null,
  }
})

const goBack = () => {
  if (route.query.from === 'timeline') router.push('/appointments/timeline')
  else router.push('/appointments/list')
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.visit-new-root {
  @include flex-col(var(--space-20));
}

.page-header {
  @include flex-row(var(--space-12));
  align-items: center;
}

.page-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
