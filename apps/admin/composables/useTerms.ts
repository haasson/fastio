import { reactive } from 'vue'
import { vocabulary } from '~/config/vocabulary'
import type { ItemVocab, MenuVocab } from '~/config/vocabulary'
import type { BusinessType, MenuStyle } from '@fastio/shared'

type TermsState = {
  item: ItemVocab
  menu: MenuVocab
  firstItemAcc: string
  reservationsLabel: string
  categoryExamples: string
  isServices: boolean
  isRetail: boolean
  menuStyle: MenuStyle
}

const food = vocabulary.food

const _state = reactive<TermsState>({
  item: {
    ...food.item,
    plural: { ...food.item.plural },
    pronoun: { ...food.item.pronoun },
  },
  menu: { ...food.menu },
  firstItemAcc: `${food.item.first} ${food.item.acc}`,
  reservationsLabel: food.reservations,
  categoryExamples: food.categoryExamples,
  isServices: false,
  isRetail: false,
  menuStyle: 'food',
})

export const setVocab = (businessType: BusinessType | null, menuStyle: MenuStyle) => {
  const key = businessType === 'services'
    ? 'services'
    : menuStyle === 'catalog'
      ? 'catalog'
      : 'food'
  const e = vocabulary[key]
  const { plural, pronoun, ...itemScalars } = e.item

  Object.assign(_state.item, itemScalars)
  Object.assign(_state.item.plural, plural)
  Object.assign(_state.item.pronoun, pronoun)
  Object.assign(_state.menu, e.menu)

  _state.firstItemAcc = `${e.item.first} ${e.item.acc}`
  _state.reservationsLabel = e.reservations
  _state.categoryExamples = e.categoryExamples
  _state.isServices = businessType === 'services'
  _state.isRetail = businessType === 'retail'
  _state.menuStyle = menuStyle
}

export const useTerms = () => _state
