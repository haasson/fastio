<template>
  <section id="faq" class="faq-root">
    <div class="container">
      <SectionHeader label="FAQ">
        <template #heading>Частые вопросы</template>
      </SectionHeader>

      <div class="accordion">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="item"
          :class="{ open: openIndexes.has(index) }"
        >
          <button class="question" @click="toggle(index)">
            <span>{{ item.q }}</span>
            <ChevronDown :size="20" class="chevron" />
          </button>
          <Transition name="slide">
            <div v-if="openIndexes.has(index)" class="answer-wrap">
              <p class="answer">
                <template v-for="(part, i) in item.a" :key="i">
                  <a v-if="typeof part !== 'string'" :href="part.href">{{ part.text }}</a>
                  <template v-else>{{ part }}</template>
                </template>
              </p>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '#imports'
import { ChevronDown } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'

type AnswerPart = string | { text: string; href: string }
type FaqItem = {
  q: string
  a: AnswerPart[]
}

const items: FaqItem[] = [
  {
    q: 'Как начать работу с Fastio?',
    a: [
      { text: 'Зарегистрируйтесь прямо на сайте', href: '#try' },
      ' — никаких звонков менеджера, никакого ожидания, никакой привязки карты. 14 дней по-честному бесплатно. Введите название заведения, адрес сайта и email — займёт 2 минуты. После подтверждения почты сразу получаете доступ к панели управления.',
    ],
  },
  {
    q: 'Для каких бизнесов подходит Fastio?',
    a: ['Для двух направлений. Первое — рестораны, кафе, пиццерии, суши, бургерные, фастфуд, кофейни, бары и магазины: онлайн-заказы с доставкой или самовывозом, QR-меню, кухонный экран. Второе — сервисный бизнес: салоны красоты, барбершопы, ногтевые студии, массаж, клиники, фитнес-тренеры: онлайн-запись на услуги через сайт. Выберите нужный тип при настройке — тариф и функционал подстроятся.'],
  },
  {
    q: 'Нужно ли уметь программировать?',
    a: ['Нет. Меню, дизайн, настройки доставки или записи — всё через простую панель управления. Если что-то непонятно — напишите в поддержку, поможем.'],
  },
  {
    q: 'Кто будет обновлять меню и цены?',
    a: ['Вы сами — через удобную админку. Добавить блюдо, изменить цену, поставить на стоп — пара кликов с телефона или компьютера. Никаких звонков разработчику и ожидания правок. А если не хотите заниматься переносом — мы можем загрузить ваше меню в сервис за вас за отдельную плату.'],
  },
  {
    q: 'У меня уже есть Яндекс Еда / Delivery Club. Зачем свой сайт?',
    a: ['Агрегаторы забирают 25–35% комиссии с каждого заказа. Свой сайт — это прямой канал без посредников: клиент заказывает у вас, вы получаете 100% выручки. Плюс вы контролируете бренд, собираете базу клиентов и не зависите от чужих алгоритмов.'],
  },
  {
    q: 'Можно ли изменить дизайн сайта?',
    a: ['Да, и очень гибко. Выбирайте из множества готовых тем — светлых, тёмных, цветных. Настраивайте шрифты, цвета, стиль кнопок, структуру страниц. Если нужна точная палитра под ваш бренд — мы бесплатно создадим индивидуальную тему с вашими корпоративными цветами.'],
  },
  {
    q: 'Сайт нормально работает на телефонах?',
    a: ['Да. Сайт адаптирован под любые экраны — телефон, планшет, компьютер. В общепите до 80% заказов приходит с мобильных, поэтому мобильная версия — приоритет.'],
  },
  {
    q: 'Можно ли использовать свой домен?',
    a: ['Да. После регистрации вы сразу получаете поддомен вида your-cafe.fastio.ru. Собственный домен с бесплатным SSL-сертификатом можно подключить в любой момент в настройках.'],
  },
  {
    q: 'Есть ли пробный период?',
    a: ['Да — первые 14 дней бесплатно, без карты и без звонков. Регистрируетесь сами, настраиваете, пробуете в деле. Если не подойдёт — просто не продлеваете.'],
  },
  {
    q: 'Как клиенты будут оплачивать заказы?',
    a: ['Сейчас поддерживается оплата при получении — наличными или картой курьеру. Онлайн-оплата на сайте находится в разработке.'],
  },
  {
    q: 'Что если мне нужна функция, которой пока нет?',
    a: ['Напишите нам — мы прислушиваемся к каждому клиенту. Многие функции появились именно по запросам пользователей. Обновления выходят регулярно и входят в стоимость подписки без доплат.'],
  },
  {
    q: 'Как отменить подписку?',
    a: ['В любой момент — через личный кабинет. Без штрафов и скрытых условий.'],
  },
]

function answerToPlainText(parts: AnswerPart[]): string {
  return parts
    .map(p => (typeof p === 'string' ? p : p.text).trim())
    .filter(Boolean)
    .join(' ')
}

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answerToPlainText(item.a),
        },
      })),
    }),
  }],
})

const openIndexes = ref(new Set<number>())

function toggle(index: number) {
  const next = new Set(openIndexes.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  openIndexes.value = next
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.faq-root {
  padding: var(--section-spacing) 0;
  background: var(--ln-surface);
  border-top: 1px solid var(--ln-border);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (min-width: 768px) {
    padding: 0 32px;
  }
}

.accordion {
  width: 100%;
  max-width: 800px;
}

.item {
  border-bottom: 1px solid var(--ln-border);
}

.question {
  @include flex-between(16px);
  width: 100%;
  padding: 20px 0;
  background: none;
  border: none;
  cursor: pointer;
  @include text-body-sm(600);
  color: var(--ln-white);
  text-align: left;
  font-family: var(--font-family);
  line-height: 1.4;
  transition: color 0.15s;

  &:hover {
    color: var(--ln-accent);
  }
}

.chevron {
  flex-shrink: 0;
  transition: transform 0.25s ease;
  color: var(--ln-muted);

  .open & {
    transform: rotate(180deg);
    color: var(--ln-accent);
  }
}

.answer-wrap {
  overflow: hidden;
}

.answer {
  @include text-caption;
  color: var(--color-text-secondary);
  line-height: 1.7;
  padding-bottom: 20px;
  margin: 0;

  a {
    color: var(--ln-accent);
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      opacity: 0.8;
    }
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  max-height: 200px;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
