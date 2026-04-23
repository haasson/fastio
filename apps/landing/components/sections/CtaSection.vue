<template>
  <section id="contact" class="cta-root">
    <div class="container">
      <SectionHeader label="Контакты">
        <template #heading>Остались вопросы?</template>
        <template #subtitle>
          Напишите нам удобным способом — ответим в рабочее время.
        </template>
      </SectionHeader>

      <div class="channels">
        <a
          v-for="ch in channels"
          :key="ch.name"
          :href="ch.href"
          target="_blank"
          rel="noopener"
          class="channel"
        >
          <component :is="ch.icon" :size="22" class="channel-icon" />
          <div class="channel-body">
            <span class="channel-name">{{ ch.name }}</span>
            <span class="channel-desc">{{ ch.desc }}</span>
          </div>
        </a>
      </div>

      <p class="hint">Отвечаем в течение часа в рабочее время</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Send, MessageCircle, Mail } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'
import type { Component } from 'vue'

type Channel = {
  name: string
  desc: string
  href: string
  icon: Component
}

const channels: Channel[] = [
  { name: 'Telegram', desc: '@fastio_ru', href: 'https://t.me/fastio_ru', icon: Send },
  { name: 'MAX', desc: 'fastio_ru', href: 'https://max.ru/fastio_ru', icon: MessageCircle },
  { name: 'Почта', desc: 'hello@fastio.ru', href: 'mailto:hello@fastio.ru', icon: Mail },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cta-root {
  background: var(--ln-surface);
  border-top: 1px solid var(--ln-border);
  padding: var(--section-spacing) 0;
}

.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (min-width: 768px) {
    padding: 0 32px;
  }
}

.channels {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  @media (min-width: 640px) {
    flex-direction: row;
    gap: 16px;
  }
}

.channel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  padding: 14px 20px;
  background: var(--ln-accent);
  border: 1px solid var(--ln-accent);
  border-radius: var(--radius-card);
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  @media (min-width: 480px) {
    padding: 20px;
  }
}

.channel-icon {
  color: #fff;
  flex-shrink: 0;
}

.channel-body {
  @include flex-col(2px);
  flex: 1;
  min-width: 0;
}

.channel-name {
  @include text-caption(600);
  color: #fff;
}

.channel-desc {
  @include text-xs;
  color: rgba(255, 255, 255, 0.7);
}
.hint {
  margin-top: 20px;
  @include text-xs;
  color: var(--ln-muted);
}
</style>
