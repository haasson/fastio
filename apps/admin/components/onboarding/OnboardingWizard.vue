<template>
  <div class="wizard-root">
    <UiCard size="large" class="wizard-card">
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
          v-model="form.businessType"
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
        />
        <OnboardingStepModules
          v-else-if="currentStep === 'modules'"
          v-model:delivery="form.delivery"
          v-model:pickup="form.pickup"
          v-model:dine-in="form.dineIn"
        />
        <OnboardingStepComplete
          v-else-if="currentStep === 'complete'"
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
          :disabled="!canProceed"
          :loading="saving"
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
import type { BusinessType } from '@fastio/shared'
import { validateValue, validationRules } from '@fastio/kit'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import OnboardingStepType from '~/components/onboarding/OnboardingStepType.vue'
import OnboardingStepInfo from '~/components/onboarding/OnboardingStepInfo.vue'
import OnboardingStepBranch from '~/components/onboarding/OnboardingStepBranch.vue'
import OnboardingStepModules from '~/components/onboarding/OnboardingStepModules.vue'
import OnboardingStepComplete from '~/components/onboarding/OnboardingStepComplete.vue'

type StepName = 'type' | 'info' | 'branch' | 'modules' | 'complete'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const step = ref(1)
const saving = ref(false)
const infoStepRef = ref<InstanceType<typeof OnboardingStepInfo> | null>(null)
const form = reactive({
  businessType: tenantStore.tenant?.businessType ?? null as BusinessType | null,
  name: tenantStore.tenant?.name ?? '',
  phone: tenantStore.tenant?.contacts?.phone ?? '',
  timezone: tenantStore.tenant?.timezone ?? 'Europe/Moscow',
  delivery: tenantStore.tenant?.modules?.delivery ?? true,
  pickup: tenantStore.tenant?.modules?.pickup ?? true,
  dineIn: tenantStore.tenant?.modules?.dineIn ?? false,
})

const stepList = computed<StepName[]>(() => {
  if (form.businessType === 'services') {
    return ['type', 'info', 'complete']
  }

  return ['type', 'info', 'branch', 'modules', 'complete']
})

const totalSteps = computed(() => stepList.value.length)
const currentStep = computed<StepName>(() => stepList.value[step.value - 1])

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'type':
      return !!form.businessType
    case 'info':
      return form.name.trim().length > 0
        && validateValue(form.phone, [validationRules.phone.required, validationRules.phone.format]) === null
    case 'branch':
      return branchStore.hasBranches
    case 'modules':
      return form.delivery || form.pickup || form.dineIn
    default:
      return true
  }
})

const prev = () => {
  if (step.value > 1) step.value--
}

const next = async () => {
  if (!canProceed.value) return

  if (currentStep.value === 'info') {
    const valid = infoStepRef.value?.validate()

    if (!valid) return
  }

  saving.value = true
  try {
    if (currentStep.value === 'type') {
      const updates: Parameters<typeof tenantStore.update>[0] = { businessType: form.businessType }

      if (form.businessType === 'services') {
        updates.modules = {
          ...tenantStore.tenant!.modules,
          delivery: false,
          pickup: false,
          dineIn: false,
        }
      }
      await tenantStore.update(updates)
    } else if (currentStep.value === 'info') {
      await tenantStore.update({
        name: form.name.trim(),
        contacts: {
          ...tenantStore.tenant!.contacts,
          phone: form.phone.trim(),
        },
        timezone: form.timezone,
      })
    } else if (currentStep.value === 'branch') {
      // Branch is saved inline via branchStore.add — nothing to save here
    } else if (currentStep.value === 'modules') {
      await tenantStore.update({
        modules: {
          ...tenantStore.tenant!.modules,
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
.wizard-root {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.wizard-card {
  max-width: 480px;
  gap: 32px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
}

.progress {
  display: flex;
  justify-content: center;
  gap: 8px;
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
  gap: 12px;
}

.spacer {
  flex: 1;
}
</style>
