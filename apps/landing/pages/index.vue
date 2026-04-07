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
    <PricingSection />
    <FaqSection />
    <CtaSection />
    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
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
import CtaSection from '~/components/sections/CtaSection.vue'
import LandingFooter from '~/components/sections/LandingFooter.vue'
</script>

<style scoped lang="scss">
.landing-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
