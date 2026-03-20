<template>
  <header class="header-root" :class="{ scrolled }">
    <div class="container">
      <a href="/" class="logo"><span>Fast</span><span class="logo-accent">io</span></a>

      <nav class="nav" :class="{ open: menuOpen }">
        <a
          v-for="link in navLinks"
          :key="link.href"
          :href="link.href"
          class="nav-link"
          @click="closeMenu"
        >
          {{ link.label }}
        </a>
        <FsButton variant="primary" class="nav-cta cta-black" @click="closeMenu">
          Попробовать бесплатно
        </FsButton>
      </nav>

      <FsButton variant="primary" class="cta-desktop cta-black">
        Попробовать бесплатно
      </FsButton>

      <button
        class="burger"
        :aria-label="menuOpen ? 'Закрыть меню' : 'Открыть меню'"
        @click="menuOpen = !menuOpen"
      >
        <X v-if="menuOpen" :size="24" />
        <Menu v-else :size="24" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { FsButton } from '@fastio/public-ui'
import { Menu, X } from 'lucide-vue-next'

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

function closeMenu() {
  menuOpen.value = false
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
  z-index: var(--z-sticky);
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
  justify-content: space-between;
}

.logo {
  font-family: var(--heading-font-family);
  font-weight: 800;
  font-size: 24px;
  color: var(--ln-black);
  text-decoration: none;
  flex-shrink: 0;
}

.logo-accent {
  color: var(--ln-accent, #e55a25);
}

.nav {
  display: none;
  flex-direction: column;
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  background: var(--ln-white);
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  gap: 8px;

  &.open {
    display: flex;
  }
}

.nav-link {
  color: var(--color-text);
  text-decoration: none;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 400;
  padding: 10px 8px;
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

.nav-cta {
  display: flex;
  margin-top: 8px;
}

.cta-desktop {
  display: none;
}

.burger {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  padding: 4px;
}

@media (min-width: 768px) {
  .container {
    padding: 0 24px;
  }

  .nav {
    display: flex;
    flex-direction: row;
    position: static;
    background: transparent;
    padding: 0;
    box-shadow: none;
    gap: 4px;
    align-items: center;
  }

  .nav-link {
    padding: 8px 12px;
  }

  .nav-cta {
    display: none;
  }

  .cta-desktop {
    display: inline-flex;
    flex-shrink: 0;
  }

  .burger {
    display: none;
  }
}
</style>
