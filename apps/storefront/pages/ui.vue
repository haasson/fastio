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
        <h2 class="section-title">FsButton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row">
            <FsButton variant="primary">Primary</FsButton>
            <FsButton variant="secondary">Secondary</FsButton>
            <FsButton variant="ghost">Ghost</FsButton>
            <FsButton variant="outline">Outline</FsButton>
            <FsButton variant="destructive">Destructive</FsButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap">
            <FsButton size="small">Small</FsButton>
            <FsButton size="medium">Medium</FsButton>
            <FsButton size="large">Large</FsButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="row wrap">
            <FsButton :loading="true">Loading</FsButton>
            <FsButton :disabled="true">Disabled</FsButton>
            <FsButton variant="secondary" :loading="true">Loading</FsButton>
            <FsButton variant="outline" :disabled="true">Disabled</FsButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">As link</p>
          <div class="row">
            <FsButton as="a" href="#buttons">Link button</FsButton>
          </div>
        </div>
      </section>

      <!-- ─── Icon Buttons ────────────────────────────────────────────────── -->
      <section id="icon-buttons" class="section-root">
        <h2 class="section-title">FsIconButton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row">
            <FsIconButton variant="primary" aria-label="primary"><Heart /></FsIconButton>
            <FsIconButton variant="secondary" aria-label="secondary"><Heart /></FsIconButton>
            <FsIconButton variant="ghost" aria-label="ghost"><Heart /></FsIconButton>
            <FsIconButton variant="outline" aria-label="outline"><Heart /></FsIconButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row">
            <FsIconButton size="small" aria-label="small"><Heart /></FsIconButton>
            <FsIconButton size="medium" aria-label="medium"><Heart /></FsIconButton>
            <FsIconButton size="large" aria-label="large"><Heart /></FsIconButton>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="row">
            <FsIconButton :loading="true" aria-label="loading"><Heart /></FsIconButton>
            <FsIconButton :disabled="true" aria-label="disabled"><Heart /></FsIconButton>
          </div>
        </div>
      </section>

      <!-- ─── Input ───────────────────────────────────────────────────────── -->
      <section id="inputs" class="section-root">
        <h2 class="section-title">FsInput</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <FsInput v-model="inputVal" size="small" placeholder="Small input" />
            <FsInput v-model="inputVal" size="medium" placeholder="Medium input" />
            <FsInput v-model="inputVal" size="large" placeholder="Large input" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <FsInput v-model="inputVal" placeholder="Normal" />
            <FsInput v-model="inputVal" :error="true" placeholder="Error state" />
            <FsInput v-model="inputVal" :disabled="true" placeholder="Disabled" />
            <FsInput :readonly="true" model-value="Readonly value" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">With prefix</p>
          <div class="col">
            <FsInput v-model="inputVal" prefix="https://" placeholder="domain.ru" />
            <FsInput v-model="inputVal" size="small" prefix="₽" placeholder="Сумма" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Number — кастомные кнопки ±</p>
          <div class="col">
            <FsInput v-model="numA" type="number" size="small" />
            <FsInput v-model="numA" type="number" size="medium" />
            <FsInput v-model="numA" type="number" size="large" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Number — min / max / step</p>
          <div class="col">
            <FsInput v-model="numB" type="number" :min="0" :max="10" />
            <FsInput v-model="numC" type="number" :min="0" :max="100" :step="5" />
            <FsInput v-model="numA" type="number" :error="true" />
            <FsInput v-model="numA" type="number" :disabled="true" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Other types</p>
          <div class="col">
            <FsInput v-model="inputVal" type="email" placeholder="Email" />
            <FsInput v-model="inputVal" type="password" placeholder="Password" />
          </div>
        </div>
      </section>

      <!-- ─── Select ──────────────────────────────────────────────────────── -->
      <section id="selects" class="section-root">
        <h2 class="section-title">FsSelect</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <FsSelect v-model="selectVal" size="small" :options="selectOptions" placeholder="Small select" />
            <FsSelect v-model="selectVal" size="medium" :options="selectOptions" placeholder="Medium select" />
            <FsSelect v-model="selectVal" size="large" :options="selectOptions" placeholder="Large select" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <FsSelect v-model="selectVal" :options="selectOptions" placeholder="Normal" />
            <FsSelect v-model="selectVal" :options="selectOptions" :error="true" placeholder="Error state" />
            <FsSelect v-model="selectVal" :options="selectOptions" :disabled="true" placeholder="Disabled" />
          </div>
        </div>
      </section>

      <!-- ─── Textarea ────────────────────────────────────────────────────── -->
      <section id="textarea" class="section-root">
        <h2 class="section-title">FsTextarea</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="col">
            <FsTextarea v-model="textareaVal" size="small" placeholder="Small textarea" />
            <FsTextarea v-model="textareaVal" size="medium" placeholder="Medium textarea" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">States</p>
          <div class="col">
            <FsTextarea v-model="textareaVal" placeholder="Normal" />
            <FsTextarea v-model="textareaVal" :error="true" placeholder="Error state" />
            <FsTextarea v-model="textareaVal" :disabled="true" placeholder="Disabled" />
            <FsTextarea v-model="textareaVal" resize="none" placeholder="No resize" />
          </div>
        </div>
      </section>

      <!-- ─── Checkbox ────────────────────────────────────────────────────── -->
      <section id="checkbox" class="section-root">
        <h2 class="section-title">FsCheckbox</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="col">
            <FsCheckbox v-model="checkA" size="sm" label="Small unchecked" />
            <FsCheckbox v-model="checkB" size="sm" label="Small checked" />
            <FsCheckbox v-model="checkC" size="md" label="Medium unchecked" />
            <FsCheckbox v-model="checkD" size="md" label="Medium checked" />
            <FsCheckbox v-model="checkC" size="md" label="Disabled" :disabled="true" />
            <FsCheckbox v-model="checkD" size="md" label="Disabled checked" :disabled="true" />
          </div>
        </div>
      </section>

      <!-- ─── Switch ──────────────────────────────────────────────────────── -->
      <section id="switch" class="section-root">
        <h2 class="section-title">FsSwitch</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="col">
            <FsSwitch v-model="switchA" size="sm" label="Small off" />
            <FsSwitch v-model="switchB" size="sm" label="Small on" />
            <FsSwitch v-model="switchC" size="md" label="Medium off" />
            <FsSwitch v-model="switchD" size="md" label="Medium on" />
            <FsSwitch v-model="switchC" size="md" label="Disabled" :disabled="true" />
            <FsSwitch v-model="switchD" size="md" label="Disabled on" :disabled="true" />
          </div>
        </div>
      </section>

      <!-- ─── RadioGroup ──────────────────────────────────────────────────── -->
      <section id="radio" class="section-root">
        <h2 class="section-title">FsRadioGroup</h2>

        <div class="demo-group">
          <p class="demo-label">Vertical (default)</p>
          <FsRadioGroup v-model="radioVal" :options="radioOptions" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Horizontal</p>
          <FsRadioGroup v-model="radioVal" :options="radioOptions" orientation="horizontal" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Small size</p>
          <FsRadioGroup v-model="radioVal" :options="radioOptions" size="sm" />
        </div>

        <div class="demo-group">
          <p class="demo-label">Disabled</p>
          <FsRadioGroup v-model="radioVal" :options="radioOptions" :disabled="true" />
        </div>
      </section>

      <!-- ─── Field ───────────────────────────────────────────────────────── -->
      <section id="field" class="section-root">
        <h2 class="section-title">FsField</h2>

        <div class="demo-group">
          <div class="col">
            <FsField label="Нормальное поле">
              <FsInput v-model="inputVal" placeholder="Введите значение" />
            </FsField>
            <FsField label="С подсказкой" hint="Это вспомогательный текст">
              <FsInput v-model="inputVal" placeholder="Введите значение" />
            </FsField>
            <FsField label="С ошибкой" error="Это поле обязательно для заполнения">
              <FsInput v-model="inputVal" :error="true" placeholder="Введите значение" />
            </FsField>
            <FsField label="Обязательное" :required="true" hint="Помечено звёздочкой">
              <FsSelect v-model="selectVal" :options="selectOptions" />
            </FsField>
          </div>
        </div>
      </section>

      <!-- ─── Badge ───────────────────────────────────────────────────────── -->
      <section id="badge" class="section-root">
        <h2 class="section-title">FsBadge</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="row wrap">
            <FsBadge variant="default">Default</FsBadge>
            <FsBadge variant="primary">Primary</FsBadge>
            <FsBadge variant="success">Success</FsBadge>
            <FsBadge variant="warning">Warning</FsBadge>
            <FsBadge variant="error">Error</FsBadge>
            <FsBadge variant="info">Info</FsBadge>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row wrap">
            <FsBadge size="small" variant="primary">Small</FsBadge>
            <FsBadge size="medium" variant="primary">Medium</FsBadge>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Dot mode</p>
          <div class="row wrap">
            <FsBadge :dot="true" variant="primary" />
            <FsBadge :dot="true" variant="success" />
            <FsBadge :dot="true" variant="warning" />
            <FsBadge :dot="true" variant="error" />
          </div>
        </div>
      </section>

      <!-- ─── Tag ─────────────────────────────────────────────────────────── -->
      <section id="tag" class="section-root">
        <h2 class="section-title">FsTag</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes & states</p>
          <div class="row wrap">
            <FsTag size="small">Small</FsTag>
            <FsTag size="medium">Medium</FsTag>
            <FsTag size="medium" :active="true">Active</FsTag>
            <FsTag size="medium" :disabled="true">Disabled</FsTag>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Toggleable group</p>
          <div class="row wrap">
            <FsTag
              v-for="t in tagOptions"
              :key="t"
              :active="activeTag === t"
              @click="activeTag = t"
            >{{ t }}</FsTag>
          </div>
        </div>
      </section>

      <!-- ─── Spinner ─────────────────────────────────────────────────────── -->
      <section id="spinner" class="section-root">
        <h2 class="section-title">FsSpinner</h2>

        <div class="demo-group">
          <p class="demo-label">Sizes</p>
          <div class="row">
            <FsSpinner size="small" />
            <FsSpinner size="medium" />
            <FsSpinner size="large" />
          </div>
        </div>
      </section>

      <!-- ─── Skeleton ────────────────────────────────────────────────────── -->
      <section id="skeleton" class="section-root">
        <h2 class="section-title">FsSkeleton</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="col">
            <FsSkeleton variant="line" width="80%" />
            <FsSkeleton variant="line" width="60%" />
            <FsSkeleton variant="line" width="90%" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Circle</p>
          <div class="row">
            <FsSkeleton variant="circle" width="40px" />
            <FsSkeleton variant="circle" width="56px" />
            <FsSkeleton variant="circle" width="72px" />
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Rect (card-like)</p>
          <div class="row">
            <FsSkeleton variant="rect" width="160px" height="120px" :rounded="true" />
            <FsSkeleton variant="rect" width="160px" height="120px" :rounded="true" />
          </div>
        </div>
      </section>

      <!-- ─── Divider ─────────────────────────────────────────────────────── -->
      <section id="divider" class="section-root">
        <h2 class="section-title">FsDivider</h2>

        <div class="demo-group">
          <p class="demo-label">Horizontal / spacings</p>
          <div class="col" style="max-width: 400px">
            <span class="demo-text">Выше</span>
            <FsDivider spacing="none" />
            <span class="demo-text">spacing: none</span>
            <FsDivider spacing="sm" />
            <span class="demo-text">spacing: sm</span>
            <FsDivider spacing="md" />
            <span class="demo-text">spacing: md</span>
            <FsDivider spacing="lg" />
            <span class="demo-text">spacing: lg</span>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Vertical</p>
          <div class="row" style="height: 48px; align-items: stretch">
            <span class="demo-text">Left</span>
            <FsDivider orientation="vertical" spacing="md" />
            <span class="demo-text">Middle</span>
            <FsDivider orientation="vertical" spacing="md" />
            <span class="demo-text">Right</span>
          </div>
        </div>
      </section>

      <!-- ─── Typography Headings ─────────────────────────────────────────── -->
      <section id="headings" class="section-root">
        <h2 class="section-title">FsHeading</h2>

        <div class="demo-group">
          <div class="col">
            <FsHeading as="h1">H1 — Заголовок страницы</FsHeading>
            <FsHeading as="h2">H2 — Заголовок секции</FsHeading>
            <FsHeading as="h3">H3 — Подзаголовок</FsHeading>
            <FsHeading as="h4">H4 — Небольшой заголовок</FsHeading>
            <FsHeading as="h5">H5 — Мелкий заголовок</FsHeading>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Colors</p>
          <div class="col">
            <FsHeading color="default">Default color</FsHeading>
            <FsHeading color="primary">Primary color</FsHeading>
            <FsHeading color="muted">Muted color</FsHeading>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Align</p>
          <div class="col">
            <FsHeading align="left">Left align</FsHeading>
            <FsHeading align="center">Center align</FsHeading>
            <FsHeading align="right">Right align</FsHeading>
          </div>
        </div>
      </section>

      <!-- ─── Typography Text ─────────────────────────────────────────────── -->
      <section id="text" class="section-root">
        <h2 class="section-title">FsText</h2>

        <div class="demo-group">
          <p class="demo-label">Variants</p>
          <div class="col">
            <FsText variant="body">body — Основной текст страницы, 16px. Используется для длинных описаний.</FsText>
            <FsText variant="body-sm">body-sm — Вторичный текст, 14px. Подписи, описания.</FsText>
            <FsText variant="caption">caption — Мелкий текст, 12px. Метки, дата/время.</FsText>
            <FsText variant="label">label — Текст для меток, 14px/500. Кнопки, теги.</FsText>
            <FsText variant="overline">overline — ЗАГОЛОВОК СЕКЦИИ, 11px uppercase</FsText>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Colors</p>
          <div class="col">
            <FsText color="default">default color</FsText>
            <FsText color="secondary">secondary color</FsText>
            <FsText color="muted">muted color</FsText>
            <FsText color="primary">primary color</FsText>
            <FsText color="error">error color</FsText>
            <FsText color="success">success color</FsText>
          </div>
        </div>

        <div class="demo-group">
          <p class="demo-label">Truncate & clamp</p>
          <div class="col" style="max-width: 300px">
            <FsText :truncate="true">Очень длинный текст который обрезается в одну строку без переноса</FsText>
            <FsText :lines="2">Очень длинный текст который обрезается ровно после второй строки и не позволяет тексту занимать больше места чем нужно</FsText>
          </div>
        </div>
      </section>

      <!-- ─── Tabs ─────────────────────────────────────────────────────────── -->
      <section id="tabs" class="section-root">
        <h2 class="section-title">FsTabs</h2>

        <div class="demo-group">
          <p class="demo-label">Line variant (md)</p>
          <FsTabs v-model="tabLine" :tabs="tabItems">
            <template #menu><FsText color="muted">Содержимое вкладки Меню</FsText></template>
            <template #about><FsText color="muted">Содержимое вкладки О нас</FsText></template>
            <template #contacts><FsText color="muted">Содержимое вкладки Контакты</FsText></template>
          </FsTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Pill variant (md)</p>
          <FsTabs v-model="tabPill" :tabs="tabItems" variant="pill">
            <template #menu><FsText color="muted">Содержимое вкладки Меню</FsText></template>
            <template #about><FsText color="muted">Содержимое вкладки О нас</FsText></template>
            <template #contacts><FsText color="muted">Содержимое вкладки Контакты</FsText></template>
          </FsTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Small size</p>
          <FsTabs v-model="tabSm" :tabs="tabItems" size="sm">
            <template #menu><FsText color="muted">Меню</FsText></template>
            <template #about><FsText color="muted">О нас</FsText></template>
            <template #contacts><FsText color="muted">Контакты</FsText></template>
          </FsTabs>
        </div>

        <div class="demo-group">
          <p class="demo-label">Full width</p>
          <FsTabs v-model="tabFull" :tabs="tabItemsBadge" :full-width="true" variant="pill">
            <template #new><FsText color="muted">Новые заказы</FsText></template>
            <template #active><FsText color="muted">Активные заказы</FsText></template>
            <template #done><FsText color="muted">Выполненные</FsText></template>
          </FsTabs>
        </div>
      </section>

      <!-- ─── Tooltip ──────────────────────────────────────────────────────── -->
      <section id="tooltip" class="section-root">
        <h2 class="section-title">FsTooltip</h2>

        <div class="demo-group">
          <p class="demo-label">Sides (hover over buttons)</p>
          <div class="row wrap">
            <FsTooltip content="Tooltip сверху" side="top">
              <FsButton variant="secondary" size="small">Top</FsButton>
            </FsTooltip>
            <FsTooltip content="Tooltip снизу" side="bottom">
              <FsButton variant="secondary" size="small">Bottom</FsButton>
            </FsTooltip>
            <FsTooltip content="Tooltip слева" side="left">
              <FsButton variant="secondary" size="small">Left</FsButton>
            </FsTooltip>
            <FsTooltip content="Tooltip справа" side="right">
              <FsButton variant="secondary" size="small">Right</FsButton>
            </FsTooltip>
          </div>
        </div>
      </section>

      <!-- ─── Dialog ───────────────────────────────────────────────────────── -->
      <section id="dialog" class="section-root">
        <h2 class="section-title">FsDialog</h2>

        <div class="demo-group">
          <div class="row wrap">
            <FsButton variant="secondary" @click="dialogSm = true">Open sm</FsButton>
            <FsButton variant="secondary" @click="dialogMd = true">Open md</FsButton>
            <FsButton variant="secondary" @click="dialogLg = true">Open lg</FsButton>
          </div>
        </div>

        <FsDialog v-model="dialogSm" title="Маленький диалог" description="sm — максимум 400px." size="sm">
          <FsText color="muted">Содержимое диалога sm.</FsText>
          <template #footer>
            <FsButton variant="secondary" size="small" @click="dialogSm = false">Отмена</FsButton>
            <FsButton size="small" @click="dialogSm = false">Ок</FsButton>
          </template>
        </FsDialog>

        <FsDialog v-model="dialogMd" title="Средний диалог" description="md — максимум 560px." size="md">
          <FsText color="muted">Содержимое диалога md. Подходит для большинства случаев.</FsText>
          <template #footer>
            <FsButton variant="secondary" @click="dialogMd = false">Отмена</FsButton>
            <FsButton @click="dialogMd = false">Сохранить</FsButton>
          </template>
        </FsDialog>

        <FsDialog v-model="dialogLg" title="Большой диалог" description="lg — максимум 720px. Для форм и сложного контента." size="lg">
          <div class="col">
            <FsField label="Имя" hint="Введите ваше имя">
              <FsInput v-model="inputVal" placeholder="Иван Иванов" />
            </FsField>
            <FsField label="Email">
              <FsInput v-model="inputVal" type="email" placeholder="ivan@mail.ru" />
            </FsField>
          </div>
          <template #footer>
            <FsButton variant="secondary" @click="dialogLg = false">Отмена</FsButton>
            <FsButton @click="dialogLg = false">Сохранить</FsButton>
          </template>
        </FsDialog>
      </section>

      <!-- ─── Drawer ───────────────────────────────────────────────────────── -->
      <section id="drawer" class="section-root">
        <h2 class="section-title">FsDrawer</h2>

        <div class="demo-group">
          <div class="row wrap">
            <FsButton variant="secondary" @click="drawerBottom = true">Bottom (default)</FsButton>
            <FsButton variant="secondary" @click="drawerRight = true">Right</FsButton>
          </div>
        </div>

        <FsDrawer v-model="drawerBottom" title="Bottom drawer" side="bottom" size="md">
          <FsText color="muted">Снизу выезжает на мобилке.</FsText>
          <template #footer>
            <FsButton @click="drawerBottom = false">Готово</FsButton>
          </template>
        </FsDrawer>

        <FsDrawer v-model="drawerRight" title="Right drawer" side="right" size="md">
          <div class="col">
            <FsText color="muted">Боковое меню или панель фильтров.</FsText>
            <FsDivider spacing="md" />
            <FsField label="Фильтр">
              <FsSelect v-model="selectVal" :options="selectOptions" />
            </FsField>
          </div>
          <template #footer>
            <FsButton variant="secondary" @click="drawerRight = false">Сбросить</FsButton>
            <FsButton @click="drawerRight = false">Применить</FsButton>
          </template>
        </FsDrawer>
      </section>

      <!-- ─── Toast ────────────────────────────────────────────────────────── -->
      <section id="toast" class="section-root">
        <h2 class="section-title">SfToast</h2>

        <div class="demo-group">
          <div class="row wrap">
            <FsButton variant="secondary" @click="toast.show({ title: 'Информация', description: 'Что-то произошло.' })">Default</FsButton>
            <FsButton variant="secondary" @click="toast.success('Сохранено', 'Данные успешно обновлены')">Success</FsButton>
            <FsButton variant="secondary" @click="toast.error('Ошибка', 'Не удалось сохранить данные')">Error</FsButton>
            <FsButton variant="secondary" @click="toast.warning('Внимание', 'Проверьте введённые данные')">Warning</FsButton>
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
            <FsText variant="caption" color="muted">min=1 max=5, текущее: {{ stepperCapped }}</FsText>
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
                  <FsButton size="small">Действие</FsButton>
                </template>
              </SfEmptyState>
            </div>
            <div class="demo-card">
              <SfEmptyState title="Пусто (md)" description="Здесь пока ничего нет. Добавьте первый элемент." size="md">
                <ShoppingBag />
                <template #action>
                  <FsButton>Добавить</FsButton>
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
import {
  FsButton, FsIconButton, FsBadge, FsTag, FsSpinner, FsSkeleton, FsDivider,
  FsInput, FsSelect, FsTextarea, FsCheckbox, FsSwitch, FsRadioGroup, FsField,
  FsHeading, FsText, FsTabs, FsTooltip, FsDialog, FsDrawer,
} from '@fastio/public-ui'
import SfOrderStatus from '~/shared/ui/sf/domain/SfOrderStatus.vue'
import SfPriceTag from '~/shared/ui/sf/domain/SfPriceTag.vue'
import SfStepper from '~/shared/ui/sf/domain/SfStepper.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import { useToast } from '~/shared/composables/useToast'

definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
}

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
  z-index: var(--z-sticky);
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
