<template>
  <div class="wizard-root">
    <UiCard size="large" class="wizard-card" :class="{ wide: currentStep === 'plan' }">
      <!-- Progress -->
      <div class="progress">
        <div
          v-for="i in totalSteps"
          :key="i"
          class="progress-dot"
          :class="{ active: i === step, done: i < step }"
        />
      </div>

      <!-- Steps -->
      <div class="step-content">
        <OnboardingStepType
          v-if="currentStep === 'type'"
          ref="typeStepRef"
          v-model="form.businessType"
        />
        <OnboardingStepMenuStyle
          v-else-if="currentStep === 'menuStyle'"
          v-model="form.menuStyle"
        />
        <OnboardingStepPlan
          v-else-if="currentStep === 'plan'"
          v-model="form.plan"
          :business-type="form.businessType"
        />
        <OnboardingStepInfo
          v-else-if="currentStep === 'info'"
          ref="infoStepRef"
          v-model:name="form.name"
          v-model:phone="form.phone"
          v-model:timezone="form.timezone"
        />
        <OnboardingStepBranch
          v-else-if="currentStep === 'branch'"
          ref="branchStepRef"
        />
        <OnboardingStepModules
          v-else-if="currentStep === 'modules'"
          ref="modulesStepRef"
          v-model:delivery="form.delivery"
          v-model:pickup="form.pickup"
          v-model:dine-in="form.dineIn"
          :menu-style="form.menuStyle"
        />
        <OnboardingStepComplete
          v-else-if="currentStep === 'complete'"
          :business-type="form.businessType"
          :menu-style="form.menuStyle"
        />
      </div>

      <!-- Navigation -->
      <div class="nav">
        <UiButton
          v-if="step > 1 && currentStep !== 'complete'"
          type="secondary"
          @click="prev"
        >
          Назад
        </UiButton>
        <div v-else class="spacer" />

        <UiButton
          v-if="currentStep !== 'complete'"
          type="primary"
          :loading="saving"
          :disabled="!canAdvance"
          @click="next"
        >
          Далее
        </UiButton>
        <UiButton
          v-else
          type="primary"
          :loading="saving"
          @click="finish"
        >
          Перейти в админку
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { UiButton, UiCard } from '@fastio/ui'
import type { BusinessType, MenuStyle, TenantModules } from '@fastio/shared'
import { resolveFeaturesForPlan } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { usePlans } from '~/shared/plan/usePlans'
import OnboardingStepType from './OnboardingStepType.vue'
import OnboardingStepMenuStyle from './OnboardingStepMenuStyle.vue'
import OnboardingStepPlan from './OnboardingStepPlan.vue'
import OnboardingStepInfo from './OnboardingStepInfo.vue'
import OnboardingStepBranch from './OnboardingStepBranch.vue'
import OnboardingStepModules from './OnboardingStepModules.vue'
import OnboardingStepComplete from './OnboardingStepComplete.vue'

type StepName = 'type' | 'menuStyle' | 'plan' | 'info' | 'branch' | 'modules' | 'complete'

const tenantStore = useTenantStore()
const { plans } = usePlans()

const step = ref(1)
const saving = ref(false)
const typeStepRef = ref<InstanceType<typeof OnboardingStepType> | null>(null)
const infoStepRef = ref<InstanceType<typeof OnboardingStepInfo> | null>(null)
const branchStepRef = ref<InstanceType<typeof OnboardingStepBranch> | null>(null)
const modulesStepRef = ref<InstanceType<typeof OnboardingStepModules> | null>(null)

const form = reactive({
  businessType: tenantStore.tenant.businessType as BusinessType | null,
  menuStyle: tenantStore.tenant.menuStyle,
  plan: (tenantStore.tenant.subscription?.plan ?? null) as string | null,
  name: tenantStore.tenant.name,
  phone: tenantStore.tenant.contacts?.phone ?? '',
  timezone: tenantStore.tenant.timezone,
  delivery: tenantStore.tenant.modules?.delivery ?? true,
  pickup: tenantStore.tenant.modules?.pickup ?? true,
  dineIn: tenantStore.tenant.modules?.dineIn ?? false,
})

const stepList = computed<StepName[]>(() => {
  if (form.businessType === 'services') {
    return ['type', 'plan', 'info', 'branch', 'complete']
  }

  return ['type', 'menuStyle', 'plan', 'info', 'branch', 'modules', 'complete']
})

const totalSteps = computed(() => stepList.value.length)
const currentStep = computed<StepName>(() => stepList.value[step.value - 1])

// Кнопка «Далее» заблокирована, когда ввод текущего шага не достаточен.
// Это даёт мгновенный визуальный фидбэк, не дожидаясь клика и валидации шага.
const canAdvance = computed(() => {
  switch (currentStep.value) {
    case 'type': return form.businessType !== null
    case 'plan': return form.plan !== null
    case 'modules': return form.delivery || form.pickup || form.dineIn
    default: return true
  }
})

const prev = () => {
  if (step.value > 1) step.value--
}

const next = async () => {
  // Шаг `plan` блокируется на уровне кнопки (canAdvance), поэтому отдельная validate() ему не нужна.
  const stepRefs: Record<string, { validate: () => boolean } | null> = {
    type: typeStepRef.value,
    info: infoStepRef.value,
    branch: branchStepRef.value,
    modules: modulesStepRef.value,
  }
  const valid = stepRefs[currentStep.value]?.validate() ?? true

  if (!valid) return

  saving.value = true
  try {
    if (currentStep.value === 'type') {
      // На type-шаге фиксируем только тип бизнеса. Конкретные модули определит выбор тарифа
      // (для services это всегда `services: true`, для retail — что включает данный план).
      await tenantStore.update({ businessType: form.businessType })
    } else if (currentStep.value === 'menuStyle') {
      await tenantStore.update({ menuStyle: form.menuStyle })
    } else if (currentStep.value === 'plan') {
      // Меняем план только если новый отличается от текущего, иначе RPC кинет 'Already on this plan'.
      if (form.plan && form.plan !== tenantStore.tenant.subscription?.plan) {
        await tenantStore.changePlan(form.plan)
      }
      // По выбранному плану рассчитываем включённые модули и сохраняем.
      // services: для услуг-тенанта дополнительно включаем `services: true` (если тариф его содержит —
      // он уже будет true; если нет — gate всё равно его залочит, но семантика state сохранится).
      const modulesFromPlan = computeModulesForPlan(form.plan, form.businessType)

      await tenantStore.update({ modules: { ...tenantStore.tenant.modules, ...modulesFromPlan } })
      // Синхронизируем `form.*` toggle'ы с тем, что план реально открыл.
      form.delivery = !!modulesFromPlan.delivery
      form.pickup = !!modulesFromPlan.pickup
      form.dineIn = !!modulesFromPlan.dineIn
    } else if (currentStep.value === 'info') {
      await tenantStore.update({
        name: form.name.trim(),
        contacts: {
          ...tenantStore.tenant.contacts,
          phone: form.phone.trim(),
        },
        timezone: form.timezone,
      })
    } else if (currentStep.value === 'branch') {
      if (branchStepRef.value?.isOptedOut()) {
        await tenantStore.update({
          onboardingState: {
            ...tenantStore.tenant.onboardingState,
            branchNotNeeded: true,
          },
        })
      }
    } else if (currentStep.value === 'modules') {
      await tenantStore.update({
        modules: {
          ...tenantStore.tenant.modules,
          delivery: form.delivery,
          pickup: form.pickup,
          dineIn: form.dineIn,
        },
      })
    }

    step.value++
  } finally {
    saving.value = false
  }
}

/**
 * Вычисляет состояние `modules` для тенанта на основании выбранного тарифа.
 * Для услуг — выставляет services=true и явно гасит retail-каналы (на случай если юзер
 * сначала выбрал retail-тип, потом передумал). Для retail — выставляет каналы по умолчанию
 * только в пределах того, что тариф открывает.
 */
function computeModulesForPlan(planKey: string | null, bt: BusinessType | null): Partial<TenantModules> {
  if (!planKey || !bt) return {}
  const features = resolveFeaturesForPlan(plans.value, planKey, bt)
  const allowed = features.modules

  if (bt === 'services') {
    return {
      services: allowed.services,
      delivery: false,
      pickup: false,
      dineIn: false,
    }
  }

  // retail: даём дефолтно delivery+pickup если тариф их открывает; dineIn — отдельный шаг.
  return {
    delivery: allowed.delivery,
    pickup: allowed.pickup,
  }
}

const finish = async () => {
  saving.value = true
  try {
    await tenantStore.update({ onboardingCompleted: true })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.wizard-root {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-24);
  overflow-y: auto;
}

.wizard-card {
  width: 100%;
  max-width: 480px;
  gap: var(--space-32);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);

  &.wide {
    max-width: 860px;
  }
}

.progress {
  display: flex;
  justify-content: center;
  gap: var(--space-8);
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-border);
  transition: background 0.2s;

  &.active {
    background: var(--color-primary);
  }

  &.done {
    background: var(--color-primary);
    opacity: 0.5;
  }
}

.step-content {
  min-height: 280px;
}

.nav {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
}

.spacer {
  flex: 1;
}
</style>
