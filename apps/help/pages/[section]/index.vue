<script setup lang="ts">
import { useRoute, navigateTo, createError } from '#imports'
import { KB_SECTIONS } from '~/config/kb'

const route = useRoute()
const section = KB_SECTIONS.find((s) => s.id === route.params.section)
const firstArticle = section?.articles[0]?.id

if (!firstArticle) {
  throw createError({ statusCode: 404, statusMessage: 'Раздел не найден' })
}

await navigateTo(`/${section!.id}/${firstArticle}`, { redirectCode: 302 })
</script>
