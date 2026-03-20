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

      <FsButton variant="primary" class="cta-desktop cta-black">
        Попробовать бесплатно
      </FsButton>

      <FsBurger v-model="menuOpen" style="--burger-color: var(--ln-black)" />
    </div>
  </header>

  <FsMobileMenu v-model="menuOpen" style="--mobile-menu-bg: var(--ln-white)">
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
      <FsButton variant="primary" size="large" class="cta-black" @click="menuOpen = false">
        Попробовать бесплатно
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
.header-root {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky, 100);
  background: transparent;
  transition: background 0.25s, box-shadow 0.25s;

  &.scrolled {
    background: var(--ln-white);
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08);
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
  color: var(--ln-black);
  text-decoration: none;
  flex-shrink: 0;
  margin-right: auto;
}

.logo-accent {
  color: var(--ln-accent, #e55a25);
}

.nav {
  display: none;
  gap: 4px;
  align-items: center;

  @media (min-width: 768px) {
    display: flex;
  }
}

.nav-link {
  color: var(--color-text);
  text-decoration: none;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 400;
  padding: 8px 12px;
  border-radius: var(--radius-btn);
  transition: color 0.15s;

  &:hover {
    color: var(--ln-accent);
  }
}

.cta-black {
  --primary: var(--ln-black, #1a1a1a);
  --on-primary: #fff;
  --primary-hover: var(--ln-black, #1a1a1a);
  border-radius: 8px;

  &:hover {
    opacity: 0.9;
  }
}

.cta-desktop {
  display: none;
  flex-shrink: 0;

  @media (min-width: 768px) {
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
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
  transition: color 0.15s;

  &:first-child { border-top: 1px solid var(--color-border); }
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
