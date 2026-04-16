<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Политика конфиденциальности">
        <div v-if="legalInfo" class="privacy-root">
          <section class="section">
            <h2 class="section-title">Согласие с политикой</h2>
            <p>Использование сайта, оформление заказа или нажатие кнопки подтверждения означает полное и безоговорочное согласие пользователя с настоящей политикой конфиденциальности. Если вы не согласны с её условиями — пожалуйста, не используйте сайт для оформления заказов.</p>
          </section>

          <section class="section">
            <h2 class="section-title">1. Оператор персональных данных</h2>
            <p>{{ legalInfo.legalName }}</p>
            <p v-if="legalInfo.inn">ИНН: {{ legalInfo.inn }}</p>
            <p v-if="legalInfo.ogrn">ОГРН/ОГРНИП: {{ legalInfo.ogrn }}</p>
            <p v-if="legalInfo.legalAddress">Адрес: {{ legalInfo.legalAddress }}</p>
            <p>E-mail для обращений: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a></p>
          </section>

          <section class="section">
            <h2 class="section-title">2. Какие данные мы собираем</h2>
            <p>При оформлении заказа мы запрашиваем следующие данные:</p>
            <ul>
              <li>Имя — для идентификации заказа;</li>
              <li>Номер телефона — для подтверждения заказа и связи по вопросам доставки;</li>
              <li v-if="deliveryEnabled">Адрес доставки — для осуществления доставки;</li>
              <li>Состав и сумма заказа — для его обработки и исполнения.</li>
            </ul>
            <p>Мы не собираем данные банковских карт. Онлайн-оплата проводится через внешний платёжный сервис, который является самостоятельным оператором платёжных данных.</p>
          </section>

          <section class="section">
            <h2 class="section-title">3. Цели обработки</h2>
            <p>Данные используются исключительно для приёма, обработки и исполнения заказов, а также для уведомления о статусе заказа. Мы не используем ваши данные для рекламных рассылок без вашего отдельного согласия.</p>
          </section>

          <section class="section">
            <h2 class="section-title">4. Технический обработчик</h2>
            <p>Для работы сайта и обработки заказов используется платформа <strong>FastIO</strong> — технический сервис для заведений. FastIO обрабатывает данные заказов исключительно в технических целях на основании договора с нами и не использует ваши данные в своих коммерческих целях.</p>
          </section>

          <section class="section">
            <h2 class="section-title">5. Сроки хранения</h2>
            <p>Данные о заказах хранятся в течение срока работы вашего аккаунта на нашем сайте. При удалении аккаунта персональные данные удаляются или обезличиваются в течение 30 дней. Обезличенные агрегированные данные (статистика заказов без привязки к личности) могут храниться без ограничения срока.</p>
          </section>

          <section class="section">
            <h2 class="section-title">6. Ваши права</h2>
            <p>В соответствии с Федеральным законом № 152-ФЗ вы вправе:</p>
            <ul>
              <li>получить информацию об обрабатываемых данных — ответ в течение 30 дней;</li>
              <li>потребовать исправления неточных данных — исправление в течение 7 рабочих дней;</li>
              <li>потребовать удаления данных при отсутствии законных оснований для их хранения;</li>
              <li>отозвать согласие на обработку в любой момент, направив запрос по адресу ниже;</li>
              <li>подать жалобу в Роскомнадзор (rkn.gov.ru).</li>
            </ul>
            <p>Для реализации прав обратитесь: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a></p>
          </section>
        </div>

        <SfEmptyState
          v-else
          title="Документ недоступен"
          description="Заведение ещё не опубликовало политику конфиденциальности"
        >
          <FileX :size="48" />
        </SfEmptyState>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { FileX } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const legalInfo = computed(() => {
  const info = tenant.value?.legalInfo
  return isLegalInfoComplete(info) ? info : null
})

const deliveryEnabled = computed(() => tenant.value?.modules?.delivery ?? false)
</script>

<style scoped lang="scss">
.privacy-root {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 720px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

p, li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0;
}

ul {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link {
  color: var(--primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
