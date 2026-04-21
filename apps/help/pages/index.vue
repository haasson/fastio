<script setup lang="ts">
import { navigateTo, createError } from '#imports'
import { KB_SECTIONS } from '~/config/kb'

const firstSection = KB_SECTIONS[0]

if (!firstSection?.articles[0]) {
  throw createError({ statusCode: 404, statusMessage: 'База знаний пуста' })
}

await navigateTo(`/${firstSection.id}/${firstSection.articles[0].id}`, { redirectCode: 302 })
</script>
