<template>
  <div>
    <UiSectionHeader title="Тарифы">
      <template #right>
        <UiButton
          v-if="open"
          type="text"
          size="small"
          @click="open = false"
        >
          Скрыть
        </UiButton>
        <UiButton
          v-else
          type="default"
          size="small"
          @click="open = true"
        >
          Сменить тариф
        </UiButton>
      </template>
    </UiSectionHeader>

    <div v-if="open && tenant" class="plans-grid">
      <PlanCard
        v-for="p in plans"
        :key="p.id"
        :plan="p"
        :is-current="p.key === tenant.subscription.plan"
        :can-afford="p.price === 0 || tenant.balance >= p.price"
        :loading="changingPlan === p.key"
        @select="changePlan(p.key)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiSectionHeader, useMessage } from '@fastio/ui'
import { usePlans } from '~/composables/plan/usePlans'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import PlanCard from '~/components/settings/PlanCard.vue'

const emit = defineEmits<{ changed: [] }>()

const api = useDatabase()
const tenantStore = useTenantStore()
const { tenant } = storeToRefs(tenantStore)
const { plans } = usePlans()
const { success, error: showError } = useMessage()

const open = ref(false)
const changingPlan = ref<string | null>(null)

const changePlan = async (planKey: string) => {
  if (!tenant.value) return

  changingPlan.value = planKey
  try {
    await api.billing.changePlan(tenant.value.id, planKey)
    success('Тариф изменён')
    open.value = false
    await tenantStore.init()
    emit('changed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка смены тарифа'

    showError(msg)
  } finally {
    changingPlan.value = null
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.plans-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 16px;

  @include mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
