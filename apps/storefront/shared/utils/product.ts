import type { LucideIcon } from 'lucide-vue-next'
import type { DishTagDefinition, TagColorPreset } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'
import { resolveTagIcon } from '~/shared/utils/tag-icons'

export type ProductTag = {
  id: string
  name: string
  preset: TagColorPreset | undefined
  iconComponent: LucideIcon
}

export type ProductSource = {
  id: string
  name: string
  description?: string | null
  photos: string[]
  price: number
  tags: string[]
}

export type ProductData = {
  id: string
  name: string
  description?: string | null
  photos: string[]
  price: number
  tags: ProductTag[]
}

export function resolveTags(
  tagIds: readonly string[],
  tagDefs: readonly DishTagDefinition[],
): ProductTag[] {
  return tagIds
    .map<ProductTag | null>((tagId) => {
      const def = tagDefs.find((t) => t.id === tagId)
      if (!def) return null
      return {
        id: def.id,
        name: def.name,
        preset: getTagColorPreset(def.color),
        iconComponent: resolveTagIcon(def.icon),
      }
    })
    .filter((t): t is ProductTag => t !== null)
}

export function buildProduct(
  item: ProductSource,
  tagDefs: readonly DishTagDefinition[],
): ProductData {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    photos: item.photos,
    price: item.price,
    tags: resolveTags(item.tags, tagDefs),
  }
}
