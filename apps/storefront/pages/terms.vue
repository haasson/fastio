<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Оферта">
        <div v-if="legalInfo" class="terms-root">
          <section class="section">
            <h2 class="section-title">{{ legalInfo.legalName }}</h2>
            <p v-if="legalInfo.inn">ИНН: {{ legalInfo.inn }}</p>
            <p v-if="legalInfo.ogrn">ОГРН/ОГРНИП: {{ legalInfo.ogrn }}</p>
            <p v-if="legalInfo.legalAddress">Адрес: {{ legalInfo.legalAddress }}</p>
            <p>E-mail: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a></p>
          </section>

          <section class="section">
            <h2 class="section-title">§1 Предмет договора</h2>
            <p>
              Настоящая оферта является публичным предложением {{ legalInfo.legalName }} (далее — Продавец) в соответствии со статьёй 437 Гражданского кодекса Российской Федерации
              и адресована любому лицу, выразившему намерение заказать товары/услуги через настоящий сайт (далее — Покупатель).
            </p>
            <p>
              Акцептом настоящей оферты считается оформление заказа Покупателем — момент нажатия кнопки подтверждения заказа
              на сайте. С этого момента договор купли-продажи считается заключённым на условиях настоящей оферты.
            </p>
          </section>

          <section class="section">
            <h2 class="section-title">§2 Порядок оформления заказа</h2>
            <p>
              Для оформления заказа Покупателю необходимо выбрать товары/услуги в каталоге, указать контактные данные
              в форме оформления заказа и подтвердить заказ. После подтверждения заказ направляется Продавцу на обработку.
            </p>
            <p>
              Продавец вправе связаться с Покупателем по указанному номеру телефона для уточнения деталей заказа,
              наличия товаров или подтверждения времени доставки/самовывоза. В случае невозможности выполнения заказа
              Продавец уведомляет об этом Покупателя.
            </p>
            <p>
              Минимальная сумма заказа, доступные способы получения и временны́е ограничения определяются условиями,
              действующими на сайте в момент оформления заказа.
            </p>
          </section>

          <section class="section">
            <h2 class="section-title">§3 Стоимость и оплата</h2>
            <p>
              Цены на товары/услуги указаны на сайте в рублях Российской Федерации и включают НДС в тех случаях,
              когда Продавец является плательщиком НДС. Продавец вправе в одностороннем порядке изменять цены без
              предварительного уведомления; изменение цены после акцепта оферты не допускается.
            </p>
            <p>
              Доступные способы оплаты: наличными при получении заказа, банковской картой при получении,
              онлайн через внешний платёжный сервис. Данные банковских карт обрабатываются исключительно
              платёжным сервисом, являющимся самостоятельным оператором, и не передаются Продавцу.
            </p>
          </section>

          <section class="section">
            <h2 class="section-title">§4 Доставка/самовывоз</h2>
            <p>
              Заказ доставляется по адресу, указанному Покупателем при оформлении, либо готов к самовывозу по адресу
              заведения. Стоимость доставки, минимальная сумма заказа для бесплатной доставки и зоны покрытия
              отображаются на сайте при оформлении заказа.
            </p>
            <p>
              Ориентировочное время доставки сообщается Покупателю при подтверждении заказа и носит справочный характер.
              Продавец не несёт ответственности за задержку, вызванную обстоятельствами непреодолимой силы или
              действиями третьих лиц.
            </p>
            <p>
              Риск случайной гибели или повреждения товара переходит к Покупателю с момента его передачи курьером или
              выдачи при самовывозе.
            </p>
          </section>

          <section class="section">
            <h2 class="section-title">§5 Права и обязанности сторон</h2>
            <p>Покупатель обязуется:</p>
            <ul>
              <li>предоставить достоверные контактные данные при оформлении заказа;</li>
              <li>принять заказ в согласованное время и место;</li>
              <li>оплатить заказ в соответствии с выбранным способом оплаты.</li>
            </ul>
            <p>Продавец обязуется:</p>
            <ul>
              <li>подготовить и передать заказ в соответствии с его составом и в оговорённые сроки;</li>
              <li>обеспечить надлежащее качество товаров/услуг;</li>
              <li>в случае отказа Покупателя от заказа до его передачи — осуществить возврат уплаченных средств
                в соответствии со статьёй 32 Закона РФ «О защите прав потребителей».</li>
            </ul>
          </section>

          <section class="section">
            <h2 class="section-title">§6 Ответственность</h2>
            <p>
              Ответственность Продавца ограничена реальным ущербом, причинённым Покупателю вследствие ненадлежащего
              исполнения настоящей оферты. Продавец освобождается от ответственности при наступлении обстоятельств
              непреодолимой силы (форс-мажор): стихийные бедствия, действия государственных органов,
              аварии инфраструктуры и иные обстоятельства, не зависящие от воли Продавца.
            </p>
            <p>
              Все споры, вытекающие из настоящей оферты, стороны стремятся урегулировать в досудебном порядке.
              При недостижении соглашения споры рассматриваются в судебном порядке по месту нахождения Продавца:
              {{ legalInfo.legalAddress }}, в соответствии с законодательством Российской Федерации.
            </p>
            <p>
              Для направления претензий и обращений: <a :href="`mailto:${legalInfo.privacyEmail}`" class="link">{{ legalInfo.privacyEmail }}</a>
            </p>
          </section>
        </div>

        <SfEmptyState
          v-else
          title="Документ недоступен"
          description="Заведение ещё не опубликовало оферту"
        >
          <FileX :size="48" />
        </SfEmptyState>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData, useHead } from 'nuxt/app'
import { FileX } from 'lucide-vue-next'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const legalInfo = computed(() => {
  const info = tenant.value?.legalInfo
  return isLegalInfoComplete(info) ? info : null
})

useHead({ title: 'Оферта' })
</script>

<style scoped lang="scss">
.terms-root {
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
