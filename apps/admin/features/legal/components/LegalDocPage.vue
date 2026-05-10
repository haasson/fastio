<template>
  <div class="doc-root">
    <div class="doc-content">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.doc-root {
  min-height: 100vh;
  background: var(--color-white);
  padding: var(--space-32) var(--space-16);
}

.doc-content {
  max-width: 760px;
  margin: 0 auto;
  font-family: var(--main-font);
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
  color: var(--color-title);

  h1 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    margin: 0 0 var(--space-8);
  }

  h2 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: var(--space-32) 0 var(--space-12);
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--color-border);
  }

  p {
    margin: 0 0 var(--space-8);
  }

  ul {
    margin: var(--space-8) 0 var(--space-12);
    padding-left: var(--space-20);
    list-style-type: disc;

    li { margin-bottom: var(--space-4); }
  }

  ol {
    margin: var(--space-8) 0 var(--space-12);
    padding-left: var(--space-20);
    list-style-type: decimal;

    li { margin-bottom: var(--space-4); }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: var(--space-12) 0 var(--space-16);
    font-size: var(--font-size-md);

    th {
      background: var(--color-bg-subtle);
      text-align: left;
      padding: var(--space-8) var(--space-12);
      font-weight: var(--font-weight-semibold);
      border: 1px solid var(--color-border);
    }

    td {
      padding: var(--space-8) var(--space-12);
      border: 1px solid var(--color-border);
      vertical-align: top;
    }
  }

  a {
    color: var(--color-primary);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
}

.doc-content :deep(.subtitle) {
  color: var(--color-text-hint);
  font-size: var(--font-size-base);
  margin-bottom: var(--space-24);
}

.doc-content :deep(.requisites) {
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
  padding: var(--space-16) var(--space-20);
  margin-bottom: var(--space-16);

  p { margin: 0 0 var(--space-4); }
}

.doc-content :deep(.muted) {
  color: var(--color-text-hint);
  font-size: var(--font-size-base);
}
</style>
