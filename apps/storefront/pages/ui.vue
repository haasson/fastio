<template>
  <div class="ui-root">
    <nav class="ui-nav">
      <span class="nav-title">UI Kit</span>
      <div class="nav-links">
        <a v-for="s in sections" :key="s.id" :href="`#${s.id}`" class="nav-link">{{ s.label }}</a>
      </div>
    </nav>

    <main class="ui-main">

      <!-- ─── Buttons ─────────────────────────────────────────────────────── -->
      <section id="buttons" class="section-root">
        <h2 class="section-title">SfButton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row">
            <SfButton variant="primary">Primary</SfButton>
            <SfButton variant="secondary">Secondary</SfButton>
            <SfButton variant="ghost">Ghost</SfButton>
            <SfButton variant="outline">Outline</SfButton>
            <SfButton variant="destructive">Destructive</SfButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap">
            <SfButton size="small">Small</SfButton>
            <SfButton size="medium">Medium</SfButton>
            <SfButton size="large">Large</SfButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="row wrap">
            <SfButton :loading="true">Loading</SfButton>
            <SfButton :disabled="true">Disabled</SfButton>
            <SfButton variant="secondary" :loading="true">Loading</SfButton>
            <SfButton variant="outline" :disabled="true">Disabled</SfButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">As link</p>
          <div class="row">
            <SfButton as="a" href="#buttons">Link button</SfButton>
          </div>
        </div>
      </section>

      <!-- ─── Icon Buttons ────────────────────────────────────────────────── -->
      <section id="icon-buttons" class="section-root">
        <h2 class="section-title">SfIconButton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row">
            <SfIconButton variant="primary" aria-label="primary"><Heart /></SfIconButton>
            <SfIconButton variant="secondary" aria-label="secondary"><Heart /></SfIconButton>
            <SfIconButton variant="ghost" aria-label="ghost"><Heart /></SfIconButton>
            <SfIconButton variant="outline" aria-label="outline"><Heart /></SfIconButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row">
            <SfIconButton size="small" aria-label="small"><Heart /></SfIconButton>
            <SfIconButton size="medium" aria-label="medium"><Heart /></SfIconButton>
            <SfIconButton size="large" aria-label="large"><Heart /></SfIconButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="row">
            <SfIconButton :loading="true" aria-label="loading"><Heart /></SfIconButton>
            <SfIconButton :disabled="true" aria-label="disabled"><Heart /></SfIconButton>
          </div>
        </div>
      </section>

      <!-- ─── Input ───────────────────────────────────────────────────────── -->
      <section id="inputs" class="section-root">
        <h2 class="section-title">SfInput</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <SfInput v-model="inputVal" size="small" placeholder="Small input" />
            <SfInput v-model="inputVal" size="medium" placeholder="Medium input" />
            <SfInput v-model="inputVal" size="large" placeholder="Large input" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <SfInput v-model="inputVal" placeholder="Normal" />
            <SfInput v-model="inputVal" :error="true" placeholder="Error state" />
            <SfInput v-model="inputVal" :disabled="true" placeholder="Disabled" />
            <SfInput v-model="inputVal" :readonly="true" model-value="Readonly value" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">With prefix</p>
          <div class="col">
            <SfInput v-model="inputVal" prefix="https://" placeholder="domain.ru" />
            <SfInput v-model="inputVal" size="small" prefix="₽" placeholder="Сумма" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Number — кастомные кнопки ±</p>
          <div class="col">
            <SfInput v-model="numA" type="number" size="small" />
            <SfInput v-model="numA" type="number" size="medium" />
            <SfInput v-model="numA" type="number" size="large" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Number — min / max / step</p>
          <div class="col">
            <SfInput v-model="numB" type="number" :min="0" :max="10" />
            <SfInput v-model="numC" type="number" :min="0" :max="100" :step="5" />
            <SfInput v-model="numA" type="number" :error="true" />
            <SfInput v-model="numA" type="number" :disabled="true" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Other types</p>
          <div class="col">
            <SfInput v-model="inputVal" type="email" placeholder="Email" />
            <SfInput v-model="inputVal" type="password" placeholder="Password" />
          </div>
        </div>
      </section>

      <!-- ─── Select ──────────────────────────────────────────────────────── -->
      <section id="selects" class="section-root">
        <h2 class="section-title">SfSelect</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <SfSelect v-model="selectVal" size="small" :options="selectOptions" placeholder="Small select" />
            <SfSelect v-model="selectVal" size="medium" :options="selectOptions" placeholder="Medium select" />
            <SfSelect v-model="selectVal" size="large" :options="selectOptions" placeholder="Large select" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <SfSelect v-model="selectVal" :options="selectOptions" placeholder="Normal" />
            <SfSelect v-model="selectVal" :options="selectOptions" :error="true" placeholder="Error state" />
            <SfSelect v-model="selectVal" :options="selectOptions" :disabled="true" placeholder="Disabled" />
          </div>
        </div>
      </section>

      <!-- ─── Textarea ────────────────────────────────────────────────────── -->
      <section id="textarea" class="section-root">
        <h2 class="section-title">SfTextarea</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <SfTextarea v-model="textareaVal" size="small" placeholder="Small textarea" />
            <SfTextarea v-model="textareaVal" size="medium" placeholder="Medium textarea" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <SfTextarea v-model="textareaVal" placeholder="Normal" />
            <SfTextarea v-model="textareaVal" :error="true" placeholder="Error state" />
            <SfTextarea v-model="textareaVal" :disabled="true" placeholder="Disabled" />
            <SfTextarea v-model="textareaVal" resize="none" placeholder="No resize" />
          </div>
        </div>
      </section>

      <!-- ─── Checkbox ────────────────────────────────────────────────────── -->
      <section id="checkbox" class="section-root">
        <h2 class="section-title">SfCheckbox</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="col">
            <SfCheckbox v-model="checkA" size="sm" label="Small unchecked" />
            <SfCheckbox v-model="checkB" size="sm" label="Small checked" />
            <SfCheckbox v-model="checkC" size="md" label="Medium unchecked" />
            <SfCheckbox v-model="checkD" size="md" label="Medium checked" />
            <SfCheckbox v-model="checkC" size="md" label="Disabled" :disabled="true" />
            <SfCheckbox v-model="checkD" size="md" label="Disabled checked" :disabled="true" />
          </div>
        </div>
      </section>

      <!-- ─── Switch ──────────────────────────────────────────────────────── -->
      <section id="switch" class="section-root">
        <h2 class="section-title">SfSwitch</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="col">
            <SfSwitch v-model="switchA" size="sm" label="Small off" />
            <SfSwitch v-model="switchB" size="sm" label="Small on" />
            <SfSwitch v-model="switchC" size="md" label="Medium off" />
            <SfSwitch v-model="switchD" size="md" label="Medium on" />
            <SfSwitch v-model="switchC" size="md" label="Disabled" :disabled="true" />
            <SfSwitch v-model="switchD" size="md" label="Disabled on" :disabled="true" />
          </div>
        </div>
      </section>

      <!-- ─── RadioGroup ──────────────────────────────────────────────────── -->
      <section id="radio" class="section-root">
        <h2 class="section-title">SfRadioGroup</h2>

        <div class="demo-group">
          <p class="demo-label">Vertical (default)</p>
          <SfRadioGroup v-model="radioVal" :options="radioOptions" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Horizontal</p>
          <SfRadioGroup v-model="radioVal" :options="radioOptions" orientation="horizontal" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Small size</p>
          <SfRadioGroup v-model="radioVal" :options="radioOptions" size="sm" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Disabled</p>
          <SfRadioGroup v-model="radioVal" :options="radioOptions" :disabled="true" />
        </div>
      </section>

      <!-- ─── Field ───────────────────────────────────────────────────────── -->
      <section id="field" class="section-root">
        <h2 class="section-title">SfField</h2>

        <div class="demo-group">
          <div class="col">
            <SfField label="Нормальное поле">
              <SfInput v-model="inputVal" placeholder="Введите значение" />
            </SfField>
            <SfField label="С подсказкой" hint="Это вспомогательный текст">
              <SfInput v-model="inputVal" placeholder="Введите значение" />
            </SfField>
            <SfField label="С ошибкой" error="Это поле обязательно для заполнения">
              <SfInput v-model="inputVal" :error="true" placeholder="Введите значение" />
            </SfField>
            <SfField label="Обязательное" :required="true" hint="Помечено звёздочкой">
              <SfSelect v-model="selectVal" :options="selectOptions" />
            </SfField>
          </div>
        </div>
      </section>

      <!-- ─── Badge ───────────────────────────────────────────────────────── -->
      <section id="badge" class="section-root">
        <h2 class="section-title">SfBadge</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row wrap">
            <SfBadge variant="default">Default</SfBadge>
            <SfBadge variant="primary">Primary</SfBadge>
            <SfBadge variant="success">Success</SfBadge>
            <SfBadge variant="warning">Warning</SfBadge>
            <SfBadge variant="error">Error</SfBadge>
            <SfBadge variant="info">Info</SfBadge>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap">
            <SfBadge size="small" variant="primary">Small</SfBadge>
            <SfBadge size="medium" variant="primary">Medium</SfBadge>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Dot mode</p>
          <div class="row wrap">
            <SfBadge :dot="true" variant="primary" />
            <SfBadge :dot="true" variant="success" />
            <SfBadge :dot="true" variant="warning" />
            <SfBadge :dot="true" variant="error" />
          </div>
        </div>
      </section>

      <!-- ─── Tag ─────────────────────────────────────────────────────────── -->
      <section id="tag" class="section-root">
        <h2 class="section-title">SfTag</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="row wrap">
            <SfTag size="small">Small</SfTag>
            <SfTag size="medium">Medium</SfTag>
            <SfTag size="medium" :active="true">Active</SfTag>
            <SfTag size="medium" :disabled="true">Disabled</SfTag>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Toggleable group</p>
          <div class="row wrap">
            <SfTag
              v-for="t in tagOptions"
              :key="t"
              :active="activeTag === t"
              @click="activeTag = t"
            >{{ t }}</SfTag>
          </div>
        </div>
      </section>

      <!-- ─── Spinner ─────────────────────────────────────────────────────── -->
      <section id="spinner" class="section-root">
        <h2 class="section-title">SfSpinner</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row">
            <SfSpinner size="small" />
            <SfSpinner size="medium" />
            <SfSpinner size="large" />
          </div>
        </div>
      </section>

      <!-- ─── Skeleton ────────────────────────────────────────────────────── -->
      <section id="skeleton" class="section-root">
        <h2 class="section-title">SfSkeleton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="col">
            <SfSkeleton variant="line" width="80%" />
            <SfSkeleton variant="line" width="60%" />
            <SfSkeleton variant="line" width="90%" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Circle</p>
          <div class="row">
            <SfSkeleton variant="circle" width="40px" />
            <SfSkeleton variant="circle" width="56px" />
            <SfSkeleton variant="circle" width="72px" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Rect (card-like)</p>
          <div class="row">
            <SfSkeleton variant="rect" width="160px" height="120px" :rounded="true" />
            <SfSkeleton variant="rect" width="160px" height="120px" :rounded="true" />
          </div>
        </div>
      </section>

      <!-- ─── Divider ─────────────────────────────────────────────────────── -->
      <section id="divider" class="section-root">
        <h2 class="section-title">SfDivider</h2>

        <div class="demo-group">
          <p class="demo-label">Horizontal / spacings</p>
          <div class="col" style="max-width: 400px">
            <span class="demo-text">Выше</span>
            <SfDivider spacing="none" />
            <span class="demo-text">spacing: none</span>
            <SfDivider spacing="sm" />
            <span class="demo-text">spacing: sm</span>
            <SfDivider spacing="md" />
            <span class="demo-text">spacing: md</span>
            <SfDivider spacing="lg" />
            <span class="demo-text">spacing: lg</span>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Vertical</p>
          <div class="row" style="height: 48px; align-items: stretch">
            <span class="demo-text">Left</span>
            <SfDivider orientation="vertical" spacing="md" />
            <span class="demo-text">Middle</span>
            <SfDivider orientation="vertical" spacing="md" />
            <span class="demo-text">Right</span>
          </div>
        </div>
      </section>

      <!-- ─── Typography Headings ─────────────────────────────────────────── -->
      <section id="headings" class="section-root">
        <h2 class="section-title">SfHeading</h2>

        <div class="demo-group">
          <div class="col">
            <SfHeading as="h1">H1 — Заголовок страницы</SfHeading>
            <SfHeading as="h2">H2 — Заголовок секции</SfHeading>
            <SfHeading as="h3">H3 — Подзаголовок</SfHeading>
            <SfHeading as="h4">H4 — Небольшой заголовок</SfHeading>
            <SfHeading as="h5">H5 — Мелкий заголовок</SfHeading>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Colors</p>
          <div class="col">
            <SfHeading color="default">Default color</SfHeading>
            <SfHeading color="primary">Primary color</SfHeading>
            <SfHeading color="muted">Muted color</SfHeading>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Align</p>
          <div class="col">
            <SfHeading align="left">Left align</SfHeading>
            <SfHeading align="center">Center align</SfHeading>
            <SfHeading align="right">Right align</SfHeading>
          </div>
        </div>
      </section>

      <!-- ─── Typography Text ─────────────────────────────────────────────── -->
      <section id="text" class="section-root">
        <h2 class="section-title">SfText</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="col">
            <SfText variant="body">body — Основной текст страницы, 16px. Используется для длинных описаний.</SfText>
            <SfText variant="body-sm">body-sm — Вторичный текст, 14px. Подписи, описания.</SfText>
            <SfText variant="caption">caption — Мелкий текст, 12px. Метки, дата/время.</SfText>
            <SfText variant="label">label — Текст для меток, 14px/500. Кнопки, теги.</SfText>
            <SfText variant="overline">overline — ЗАГОЛОВОК СЕКЦИИ, 11px uppercase</SfText>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Colors</p>
          <div class="col">
            <SfText color="default">default color</SfText>
            <SfText color="secondary">secondary color</SfText>
            <SfText color="muted">muted color</SfText>
            <SfText color="primary">primary color</SfText>
            <SfText color="error">error color</SfText>
            <SfText color="success">success color</SfText>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Truncate & clamp</p>
          <div class="col" style="max-width: 300px">
            <SfText :truncate="true">Очень длинный текст который обрезается в одну строку без переноса</SfText>
            <SfText :lines="2">Очень длинный текст который обрезается ровно после второй строки и не позволяет тексту занимать больше места чем нужно</SfText>
          </div>
        </div>
      </section>

      <!-- ─── Tabs ─────────────────────────────────────────────────────────── -->
      <section id="tabs" class="section-root">
        <h2 class="section-title">SfTabs</h2>

        <div class="demo-group">
          <p class="demo-label">Line variant (md)</p>
          <SfTabs v-model="tabLine" :tabs="tabItems">
            <template #menu><SfText color="muted">Содержимое вкладки Меню</SfText></template>
            <template #about><SfText color="muted">Содержимое вкладки О нас</SfText></template>
            <template #contacts><SfText color="muted">Содержимое вкладки Контакты</SfText></template>
          </SfTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Pill variant (md)</p>
          <SfTabs v-model="tabPill" :tabs="tabItems" variant="pill">
            <template #menu><SfText color="muted">Содержимое вкладки Меню</SfText></template>
            <template #about><SfText color="muted">Содержимое вкладки О нас</SfText></template>
            <template #contacts><SfText color="muted">Содержимое вкладки Контакты</SfText></template>
          </SfTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Small size</p>
          <SfTabs v-model="tabSm" :tabs="tabItems" size="sm">
            <template #menu><SfText color="muted">Меню</SfText></template>
            <template #about><SfText color="muted">О нас</SfText></template>
            <template #contacts><SfText color="muted">Контакты</SfText></template>
          </SfTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Full width</p>
          <SfTabs v-model="tabFull" :tabs="tabItemsBadge" :full-width="true" variant="pill">
            <template #new><SfText color="muted">Новые заказы</SfText></template>
            <template #active><SfText color="muted">Активные заказы</SfText></template>
            <template #done><SfText color="muted">Выполненные</SfText></template>
          </SfTabs>
        </div>
      </section>

      <!-- ─── Tooltip ──────────────────────────────────────────────────────── -->
      <section id="tooltip" class="section-root">
        <h2 class="section-title">SfTooltip</h2>

        <div class="demo-group">
          <p class="demo-label">Sides (hover over buttons)</p>
          <div class="row wrap">
            <SfTooltip content="Tooltip сверху" side="top">
              <SfButton variant="secondary" size="small">Top</SfButton>
            </SfTooltip>
            <SfTooltip content="Tooltip снизу" side="bottom">
              <SfButton variant="secondary" size="small">Bottom</SfButton>
            </SfTooltip>
            <SfTooltip content="Tooltip слева" side="left">
              <SfButton variant="secondary" size="small">Left</SfButton>
            </SfTooltip>
            <SfTooltip content="Tooltip справа" side="right">
              <SfButton variant="secondary" size="small">Right</SfButton>
            </SfTooltip>
          </div>
        </div>
      </section>

      <!-- ─── Dialog ───────────────────────────────────────────────────────── -->
      <section id="dialog" class="section-root">
        <h2 class="section-title">SfDialog</h2>

        <div class="demo-group">
          <div class="row wrap">
            <SfButton variant="secondary" @click="dialogSm = true">Open sm</SfButton>
            <SfButton variant="secondary" @click="dialogMd = true">Open md</SfButton>
            <SfButton variant="secondary" @click="dialogLg = true">Open lg</SfButton>
          </div>
        </div>

        <SfDialog v-model="dialogSm" title="Маленький диалог" description="sm — максимум 400px." size="sm">
          <SfText color="muted">Содержимое диалога sm.</SfText>
          <template #footer>
            <SfButton variant="secondary" size="small" @click="dialogSm = false">Отмена</SfButton>
            <SfButton size="small" @click="dialogSm = false">Ок</SfButton>
          </template>
        </SfDialog>

        <SfDialog v-model="dialogMd" title="Средний диалог" description="md — максимум 560px." size="md">
          <SfText color="muted">Содержимое диалога md. Подходит для большинства случаев.</SfText>
          <template #footer>
            <SfButton variant="secondary" @click="dialogMd = false">Отмена</SfButton>
            <SfButton @click="dialogMd = false">Сохранить</SfButton>
          </template>
        </SfDialog>

        <SfDialog v-model="dialogLg" title="Большой диалог" description="lg — максимум 720px. Для форм и сложного контента." size="lg">
          <div class="col">
            <SfField label="Имя" hint="Введите ваше имя">
              <SfInput v-model="inputVal" placeholder="Иван Иванов" />
            </SfField>
            <SfField label="Email">
              <SfInput v-model="inputVal" type="email" placeholder="ivan@mail.ru" />
            </SfField>
          </div>
          <template #footer>
            <SfButton variant="secondary" @click="dialogLg = false">Отмена</SfButton>
            <SfButton @click="dialogLg = false">Сохранить</SfButton>
          </template>
        </SfDialog>
      </section>

      <!-- ─── Drawer ───────────────────────────────────────────────────────── -->
      <section id="drawer" class="section-root">
        <h2 class="section-title">SfDrawer</h2>

        <div class="demo-group">
          <div class="row wrap">
            <SfButton variant="secondary" @click="drawerBottom = true">Bottom (default)</SfButton>
            <SfButton variant="secondary" @click="drawerRight = true">Right</SfButton>
          </div>
        </div>

        <SfDrawer v-model="drawerBottom" title="Bottom drawer" side="bottom" size="md">
          <SfText color="muted">Снизу выезжает на мобилке.</SfText>
          <template #footer>
            <SfButton @click="drawerBottom = false">Готово</SfButton>
          </template>
        </SfDrawer>

        <SfDrawer v-model="drawerRight" title="Right drawer" side="right" size="md">
          <div class="col">
            <SfText color="muted">Боковое меню или панель фильтров.</SfText>
            <SfDivider spacing="md" />
            <SfField label="Фильтр">
              <SfSelect v-model="selectVal" :options="selectOptions" />
            </SfField>
          </div>
          <template #footer>
            <SfButton variant="secondary" @click="drawerRight = false">Сбросить</SfButton>
            <SfButton @click="drawerRight = false">Применить</SfButton>
          </template>
        </SfDrawer>
      </section>

      <!-- ─── Toast ────────────────────────────────────────────────────────── -->
      <section id="toast" class="section-root">
        <h2 class="section-title">SfToast</h2>

        <div class="demo-group">
          <div class="row wrap">
            <SfButton variant="secondary" @click="toast.show({ title: 'Информация', description: 'Что-то произошло.' })">Default</SfButton>
            <SfButton variant="secondary" @click="toast.success('Сохранено', 'Данные успешно обновлены')">Success</SfButton>
            <SfButton variant="secondary" @click="toast.error('Ошибка', 'Не удалось сохранить данные')">Error</SfButton>
            <SfButton variant="secondary" @click="toast.warning('Внимание', 'Проверьте введённые данные')">Warning</SfButton>
          </div>
        </div>
      </section>

      <!-- ─── OrderStatus ──────────────────────────────────────────────────── -->
      <section id="order-status" class="section-root">
        <h2 class="section-title">SfOrderStatus</h2>

        <div class="demo-group">
          <p class="demo-label">All groups (md)</p>
          <div class="row wrap">
            <SfOrderStatus group="new" />
            <SfOrderStatus group="in_progress" />
            <SfOrderStatus group="completed" />
            <SfOrderStatus group="cancelled" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Small size</p>
          <div class="row wrap">
            <SfOrderStatus group="new" size="sm" />
            <SfOrderStatus group="in_progress" size="sm" />
            <SfOrderStatus group="completed" size="sm" />
            <SfOrderStatus group="cancelled" size="sm" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Custom label</p>
          <div class="row wrap">
            <SfOrderStatus group="new" label="Ожидает оплаты" />
            <SfOrderStatus group="in_progress" label="Готовится" />
            <SfOrderStatus group="completed" label="Доставлен" />
          </div>
        </div>
      </section>

      <!-- ─── PriceTag ─────────────────────────────────────────────────────── -->
      <section id="price-tag" class="section-root">
        <h2 class="section-title">SfPriceTag</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap">
            <SfPriceTag :price="299" size="small" />
            <SfPriceTag :price="299" size="medium" />
            <SfPriceTag :price="299" size="large" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">With old price</p>
          <div class="row wrap">
            <SfPriceTag :price="199" :old-price="299" size="small" />
            <SfPriceTag :price="199" :old-price="299" size="medium" />
            <SfPriceTag :price="199" :old-price="299" size="large" />
          </div>
        </div>
      </section>

      <!-- ─── Stepper ──────────────────────────────────────────────────────── -->
      <section id="stepper" class="section-root">
        <h2 class="section-title">SfStepper</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row">
            <SfStepper v-model="stepperSm" size="small" />
            <SfStepper v-model="stepperMd" size="medium" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">With min/max</p>
          <div class="row">
            <SfStepper v-model="stepperCapped" :min="1" :max="5" />
            <SfText variant="caption" color="muted">min=1 max=5, текущее: {{ stepperCapped }}</SfText>
          </div>
        </div>
      </section>

      <!-- ─── EmptyState ───────────────────────────────────────────────────── -->
      <section id="empty-state" class="section-root">
        <h2 class="section-title">SfEmptyState</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap" style="align-items: flex-start">
            <div class="demo-card">
              <SfEmptyState title="Пусто (sm)" description="Здесь пока ничего нет." size="sm">
                <ShoppingBag />
                <template #action>
                  <SfButton size="small">Действие</SfButton>
                </template>
              </SfEmptyState>
            </div>
            <div class="demo-card">
              <SfEmptyState title="Пусто (md)" description="Здесь пока ничего нет. Добавьте первый элемент." size="md">
                <ShoppingBag />
                <template #action>
                  <SfButton>Добавить</SfButton>
                </template>
              </SfEmptyState>
            </div>
          </div>
        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Heart, ShoppingBag } from 'lucide-vue-next'
import SfButton from '~/components/sf/base/SfButton.vue'
import SfIconButton from '~/components/sf/base/SfIconButton.vue'
import SfBadge from '~/components/sf/base/SfBadge.vue'
import SfTag from '~/components/sf/base/SfTag.vue'
import SfSpinner from '~/components/sf/base/SfSpinner.vue'
import SfSkeleton from '~/components/sf/base/SfSkeleton.vue'
import SfDivider from '~/components/sf/base/SfDivider.vue'
import SfInput from '~/components/sf/form/SfInput.vue'
import SfSelect from '~/components/sf/form/SfSelect.vue'
import SfTextarea from '~/components/sf/form/SfTextarea.vue'
import SfCheckbox from '~/components/sf/form/SfCheckbox.vue'
import SfSwitch from '~/components/sf/form/SfSwitch.vue'
import SfRadioGroup from '~/components/sf/form/SfRadioGroup.vue'
import SfField from '~/components/sf/form/SfField.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfText from '~/components/sf/typography/SfText.vue'
import SfTabs from '~/components/sf/nav/SfTabs.vue'
import SfTooltip from '~/components/sf/overlay/SfTooltip.vue'
import SfDialog from '~/components/sf/overlay/SfDialog.vue'
import SfDrawer from '~/components/sf/overlay/SfDrawer.vue'
import SfOrderStatus from '~/components/sf/domain/SfOrderStatus.vue'
import SfPriceTag from '~/components/sf/domain/SfPriceTag.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import { useToast } from '~/composables/useToast'

definePageMeta({ layout: false })

const toast = useToast()

// Nav sections
const sections = [
  { id: 'buttons', label: 'Button' },
  { id: 'icon-buttons', label: 'IconButton' },
  { id: 'inputs', label: 'Input' },
  { id: 'selects', label: 'Select' },
  { id: 'textarea', label: 'Textarea' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'switch', label: 'Switch' },
  { id: 'radio', label: 'RadioGroup' },
  { id: 'field', label: 'Field' },
  { id: 'badge', label: 'Badge' },
  { id: 'tag', label: 'Tag' },
  { id: 'spinner', label: 'Spinner' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'divider', label: 'Divider' },
  { id: 'headings', label: 'Heading' },
  { id: 'text', label: 'Text' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'tooltip', label: 'Tooltip' },
  { id: 'dialog', label: 'Dialog' },
  { id: 'drawer', label: 'Drawer' },
  { id: 'toast', label: 'Toast' },
  { id: 'order-status', label: 'OrderStatus' },
  { id: 'price-tag', label: 'PriceTag' },
  { id: 'stepper', label: 'Stepper' },
  { id: 'empty-state', label: 'EmptyState' },
]

// Form state
const inputVal = ref('')
const numA = ref(0)
const numB = ref(5)
const numC = ref(50)
const selectVal = ref<string | number>('')
const textareaVal = ref('')
const checkA = ref(false)
const checkB = ref(true)
const checkC = ref(false)
const checkD = ref(true)
const switchA = ref(false)
const switchB = ref(true)
const switchC = ref(false)
const switchD = ref(true)
const radioVal = ref('one')
const radioOptions = [
  { value: 'one', label: 'Первый вариант' },
  { value: 'two', label: 'Второй вариант' },
  { value: 'three', label: 'Третий вариант (disabled)', disabled: true },
]

// Select options
const selectOptions = [
  { value: 'pizza', label: 'Пицца' },
  { value: 'burger', label: 'Бургер' },
  { value: 'sushi', label: 'Суши', disabled: true },
  { value: 'pasta', label: 'Паста' },
]

// Tags
const tagOptions = ['Все', 'Пицца', 'Бургеры', 'Суши', 'Десерты']
const activeTag = ref('Все')

// Tabs
const tabLine = ref('menu')
const tabPill = ref('menu')
const tabSm = ref('menu')
const tabFull = ref('new')
const tabItems = [
  { value: 'menu', label: 'Меню' },
  { value: 'about', label: 'О нас' },
  { value: 'contacts', label: 'Контакты', disabled: true },
]
const tabItemsBadge = [
  { value: 'new', label: 'Новые', badge: 3 },
  { value: 'active', label: 'Активные', badge: 12 },
  { value: 'done', label: 'Выполнено' },
]

// Overlays
const dialogSm = ref(false)
const dialogMd = ref(false)
const dialogLg = ref(false)
const drawerBottom = ref(false)
const drawerRight = ref(false)

// Stepper
const stepperSm = ref(1)
const stepperMd = ref(2)
const stepperCapped = ref(1)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.ui-root {
  min-height: 100vh;
  background: var(--color-bg);
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

.ui-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 48px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.nav-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.nav-link {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--surface-hover);
    color: var(--color-text);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

.ui-main {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

.section-root {
  padding-bottom: 48px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 48px;

  &:last-child {
    border-bottom: none;
  }
}

.section-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary);
  display: inline-block;
}

.demo-group {
  margin-bottom: 24px;
}

.demo-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.demo-text {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.demo-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  flex: 1;
  min-width: 240px;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

.row {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: center;

  &.wrap {
    flex-wrap: wrap;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
}
</style>
