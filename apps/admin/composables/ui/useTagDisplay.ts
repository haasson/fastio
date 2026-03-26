import type { Ref } from 'vue'
import type { DishTagDefinition } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'

export function useTagDisplay(tags: Ref<DishTagDefinition[]>) {
  const tagName = (id: string) => tags.value.find((t) => t.id === id)?.name ?? ''

  const tagStyle = (id: string) => {
    const tag = tags.value.find((t) => t.id === id)

    if (!tag) return {}
    const preset = getTagColorPreset(tag.color)

    return preset ? { color: preset.color, backgroundColor: preset.background, borderColor: preset.color } : {}
  }

  const tagStyleString = (id: string) => {
    const tag = tags.value.find((t) => t.id === id)

    if (!tag) return ''
    const preset = getTagColorPreset(tag.color)

    return preset ? `color:${preset.color};background:${preset.background};border-color:${preset.color}` : ''
  }

  return { tagName, tagStyle, tagStyleString }
}
