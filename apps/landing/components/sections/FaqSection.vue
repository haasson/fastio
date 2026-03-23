<template>
  <section id="faq" class="faq-root">
    <div class="container">
      <FsHeading as="h2" align="center">Частые вопросы</FsHeading>

      <div class="accordion">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="item"
          :class="{ open: openIndex === index }"
        >
          <button class="question" @click="toggle(index)">
            <span>{{ item.q }}</span>
            <ChevronDown :size="20" class="chevron" />
          </button>
          <Transition name="slide">
            <div v-if="openIndex === index" class="answer-wrap">
              <FsText color="secondary" class="answer">{{ item.a }}</FsText>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsHeading, FsText } from '@fastio/public-ui'
import { ChevronDown } from 'lucide-vue-next'

type FaqItem = {
  q: string
  a: string
}

const items: FaqItem[] = [
  {
    q: 'Нужно ли уметь программировать?',
    a: 'Нет, Fastio — это конструктор без кода. Вы просто заполняете меню, выбираете дизайн и публикуете сайт.',
  },
  {
    q: 'Могу ли я использовать свой домен?',
    a: 'Да, на тарифах Бизнес и Про вы можете подключить свой домен.',
  },
  {
    q: 'Как клиенты будут оплачивать заказы?',
    a: 'Сейчас поддерживается оплата при получении. Онлайн-оплата появится в ближайшее время.',
  },
  {
    q: 'Можно ли изменить дизайн сайта?',
    a: 'Да, вы можете настроить цвета, шрифты, логотип и стиль карточек под ваш бренд.',
  },
  {
    q: 'Есть ли мобильное приложение?',
    a: 'Сайт полностью адаптивен и работает как приложение на телефоне. Нативное приложение в планах.',
  },
  {
    q: 'Как отменить подписку?',
    a: 'Вы можете отменить подписку в любой момент в личном кабинете. Без штрафов и скрытых условий.',
  },
]

const openIndex = ref<number | null>(null)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.faq-root {
  padding: var(--section-spacing) 0;
  background: var(--ln-white);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.accordion {
  max-width: 800px;
  margin: 48px auto 0;
}

.item {
  border-bottom: 1px solid var(--color-border);
}

.question {
  @include flex-between(16px);
  width: 100%;
  padding: 20px 0;
  background: none;
  border: none;
  cursor: pointer;
  @include text-body-sm(600);
  color: var(--color-text);
  text-align: left;
  font-family: var(--heading-font-family);
  line-height: 1.4;

  &:hover {
    color: var(--primary);
  }
}

.chevron {
  flex-shrink: 0;
  transition: transform 0.25s ease;
  color: var(--color-text-muted);

  .open & {
    transform: rotate(180deg);
  }
}

.answer-wrap {
  overflow: hidden;
}

.answer {
  padding-bottom: 20px;
}

// Slide transition
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  max-height: 200px;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-bottom: 0;
}
</style>
