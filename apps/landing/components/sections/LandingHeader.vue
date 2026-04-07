<template>
  <header class="header-root" :class="{ scrolled }">
    <div class="container">
      <a href="/" class="logo"><span>Fast</span><span class="logo-accent">io</span></a>

      <nav class="nav">
        <a
          v-for="link in navLinks"
          :key="link.href"
          :href="link.href"
          class="nav-link"
        >
          {{ link.label }}
        </a>
      </nav>

      <FsButton as="a" href="#contact" variant="primary" class="cta-desktop cta-accent">
        Оставить заявку
      </FsButton>

      <FsBurger v-model="menuOpen" style="--burger-color: var(--ln-white)" />
    </div>
  </header>

  <FsMobileMenu v-model="menuOpen" style="--mobile-menu-bg: #161412">
    <nav class="mobile-nav">
      <a
        v-for="link in navLinks"
        :key="link.href"
        :href="link.href"
        class="mobile-nav-link"
        @click="menuOpen = false"
      >
        {{ link.label }}
      </a>
    </nav>
    <div class="mobile-bottom">
      <FsButton as="a" href="#contact" variant="primary" size="large" class="cta-accent" @click="menuOpen = false">
        Оставить заявку
      </FsButton>
    </div>
  </FsMobileMenu>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { FsButton, FsBurger, FsMobileMenu } from '@fastio/public-ui'

type NavLink = {
  label: string
  href: string
}

const navLinks: NavLink[] = [
  { label: 'Возможности', href: '#features' },
  { label: 'Как это работает', href: '#how-it-works' },
  { label: 'Тарифы', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

const scrolled = ref(false)
const menuOpen = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 10
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.header-root {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky, 100);
  background: transparent;
  transition: background 0.25s, border-color 0.25s;

  &.scrolled {
    background: rgba(13, 12, 11, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--ln-border);
  }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;

  @media (min-width: 768px) {
    padding: 0 24px;
  }
}

.logo {
  font-family: var(--heading-font-family);
  font-weight: 800;
  font-size: 24px;
  color: var(--ln-white);
  text-decoration: none;
  flex-shrink: 0;
  margin-right: auto;
}

.logo-accent {
  color: var(--ln-accent);
}

.nav {
  display: none;
  gap: 4px;
  align-items: center;

  @media (min-width: 1280px) {
    display: flex;
  }
}

.nav-link {
  color: rgba(245, 243, 238, 0.7);
  text-decoration: none;
  font-family: var(--font-family);
  @include text-caption(400);
  padding: 8px 12px;
  border-radius: var(--radius-btn);
  transition: color 0.15s;

  &:hover {
    color: var(--ln-white);
  }
}

.cta-accent {
  --primary: var(--ln-accent);
  --on-primary: #fff;
  --primary-hover: var(--primary-hover);
  border-radius: 8px;
}

.cta-desktop {
  display: none;
  flex-shrink: 0;

  @media (min-width: 1280px) {
    display: inline-flex;
  }
}

// ─── Mobile menu content ────────────────────────────────────────────────────

.mobile-nav {
  display: flex;
  flex-direction: column;
}

.mobile-nav-link {
  display: block;
  @include text-body(600);
  color: var(--ln-white);
  text-decoration: none;
  padding: 14px 0;
  border-bottom: 1px solid var(--ln-border);
  transition: color 0.15s;

  &:first-child { border-top: 1px solid var(--ln-border); }
  &:hover { color: var(--ln-accent); }
}

.mobile-bottom {
  margin-top: auto;
  padding-top: 32px;

  :deep(button) {
    width: 100%;
  }
}
</style>
