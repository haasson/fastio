<template>
  <div class="landing-root">
    <LandingHeader />
    <HeroSection />
    <AudienceSection />
    <PainSection />
    <CostComparisonSection />
    <FeaturesSection />
    <CustomizationSection />
    <ClientSitesSection />
    <HowItWorksSection />
    <EasyStartSection />
    <PricingSection :plans="plans ?? []" />
    <RegistrationSection />
    <FaqSection />
    <CtaSection />
    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { useFetch } from '#imports'
import LandingHeader from '~/components/sections/LandingHeader.vue'
import HeroSection from '~/components/sections/HeroSection.vue'
import AudienceSection from '~/components/sections/AudienceSection.vue'
import PainSection from '~/components/sections/PainSection.vue'
import CostComparisonSection from '~/components/sections/CostComparisonSection.vue'
import FeaturesSection from '~/components/sections/FeaturesSection.vue'
import CustomizationSection from '~/components/sections/CustomizationSection.vue'
import ClientSitesSection from '~/components/sections/ClientSitesSection.vue'
import HowItWorksSection from '~/components/sections/HowItWorksSection.vue'
import EasyStartSection from '~/components/sections/EasyStartSection.vue'
import PricingSection from '~/components/sections/PricingSection.vue'
import FaqSection from '~/components/sections/FaqSection.vue'
import RegistrationSection from '~/components/sections/RegistrationSection.vue'
import CtaSection from '~/components/sections/CtaSection.vue'
import LandingFooter from '~/components/sections/LandingFooter.vue'

import type { LandingPlanRow } from '~/types/plan'

const { data: plans } = await useFetch<LandingPlanRow[]>('/api/plans')
</script>

<style scoped lang="scss">
.landing-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
