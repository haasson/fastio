<template>
  <div class="landing-root">
    <LandingHeader />
    <HeroSection />
    <FeaturesSection />
    <HowItWorksSection />
    <ClientSitesSection />
    <PricingSection />
    <FaqSection />
    <CtaSection />
    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import LandingHeader from '~/components/sections/LandingHeader.vue'
import HeroSection from '~/components/sections/HeroSection.vue'
import FeaturesSection from '~/components/sections/FeaturesSection.vue'
import HowItWorksSection from '~/components/sections/HowItWorksSection.vue'
import ClientSitesSection from '~/components/sections/ClientSitesSection.vue'
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
