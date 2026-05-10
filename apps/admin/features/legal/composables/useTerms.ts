import { reactive } from 'vue'
import { vocabulary, selectVocabulary } from '@fastio/shared'
import type { ItemVocab, MenuVocab } from '@fastio/shared'
import type { BusinessType, MenuStyle } from '@fastio/shared'

type TermsState = {
  item: ItemVocab
  menu: MenuVocab
  firstItemAcc: string
  reservationsLabel: string
  categoryExamples: string
  menuStyle: MenuStyle
}

const food = structuredClone(vocabulary.food)

const _state = reactive<TermsState>({
  item: food.item,
  menu: food.menu,
  firstItemAcc: `${food.item.first} ${food.item.acc}`,
  reservationsLabel: food.reservations,
  categoryExamples: food.categoryExamples,
  menuStyle: 'food',
})

export const setVocab = (businessType: BusinessType | null, menuStyle: MenuStyle) => {
  const e = selectVocabulary(businessType, menuStyle)
  const { plural, pronoun, ...itemScalars } = e.item

  Object.assign(_state.item, itemScalars)
  Object.assign(_state.item.plural, plural)
  Object.assign(_state.item.pronoun, pronoun)
  Object.assign(_state.menu, e.menu)

  _state.firstItemAcc = `${e.item.first} ${e.item.acc}`
  _state.reservationsLabel = e.reservations
  _state.categoryExamples = e.categoryExamples
  _state.menuStyle = menuStyle
}

export const useTerms = () => _state
