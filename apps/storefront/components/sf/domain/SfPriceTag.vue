<template>
  <span
    class="price-tag-root"
    :class="[`size-${size}`, { 'is-responsive': responsive }]"
  >
    <span v-if="prefix" class="price-prefix">{{ prefix }}</span>
    <span class="price-main">{{ price }} {{ currency }}</span>
    <span v-if="oldPrice" class="price-old">{{ oldPrice }} {{ currency }}</span>
  </span>
</template>
<script setup lang="ts">
type Props = {
  price: number
  oldPrice?: number
  prefix?: string
  currency?: string
  size?: 'small' | 'medium' | 'large'
  responsive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currency: '₽',
  size: 'medium',
  responsive: false,
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.price-tag-root {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.price-prefix {
  font-weight: 400;
  color: var(--color-text-muted);
}

.price-main {
  font-weight: 700;
  color: var(--color-text);
}

.price-old {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

// Sizes
.size-small {
  .price-main {
    font-size: 14px;
    font-weight: 600;
  }
  .price-old {
    font-size: 12px;
  }
}

.size-medium {
  .price-main {
    font-size: 18px;
  }
  .price-old {
    font-size: 16px;
  }
}

.size-large {
  .price-main {
    font-size: 24px;
  }
  .price-old {
    font-size: 22px;
  }
}

// Responsive: small→medium, medium→large
.size-small.is-responsive {
  @include lg {
    .price-main {
      font-size: 18px;
      font-weight: 700;
    }
    .price-old {
      font-size: 16px;
    }
  }
}

.size-medium.is-responsive {
  @include lg {
    .price-main {
      font-size: 24px;
    }
    .price-old {
      font-size: 22px;
    }
  }
}
</style>
