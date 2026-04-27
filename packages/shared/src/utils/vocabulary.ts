import type { BusinessType, MenuStyle } from '../types/tenant'

type Forms = {
  nom: string
  gen: string
  dat: string
  acc: string
  ins: string
  pre: string
}

type ItemVocab = Forms & {
  label: string // 'Блюдо' / 'Товар' / 'Услуга' — с заглавной, для заголовков
  new: string // 'Новое' / 'Новый' / 'Новая' — согласованное прилагательное
  first: string // 'первое' / 'первый' / 'первую' — для составных фраз
  plural: Forms & {
    label: string // 'Блюда' / 'Товары' / 'Услуги' — с заглавной, для вкладок/навигации
  }
  pronoun: Forms
}

type MenuVocab = {
  label: string // 'Меню' / 'Каталог' / 'Услуги' — с заглавной, для навигации
  nom: string
  gen: string
  acc: string
  pre: string
  /** Согласованный заголовок пустого состояния: «Меню пусто» / «Каталог пуст» / «Услуги пусты». */
  emptyTitle: string
  /** «{Блюда} появятся здесь после добавления в меню» — описание пустого состояния. */
  emptyDescription: string
}

type VocabEntry = {
  item: ItemVocab
  menu: MenuVocab
  reservations: string
  categoryExamples: string
}

const food: VocabEntry = {
  item: {
    label: 'Блюдо',
    new: 'Новое',
    first: 'первое',
    nom: 'блюдо', gen: 'блюда', dat: 'блюду', acc: 'блюдо', ins: 'блюдом', pre: 'блюде',
    plural: {
      label: 'Блюда',
      nom: 'блюда', gen: 'блюд', dat: 'блюдам', acc: 'блюда', ins: 'блюдами', pre: 'блюдах',
    },
    pronoun: { nom: 'оно', gen: 'его', dat: 'ему', acc: 'его', ins: 'им', pre: 'нём' },
  },
  menu: {
    label: 'Меню',
    nom: 'меню', gen: 'меню', acc: 'меню', pre: 'меню',
    emptyTitle: 'Меню пусто',
    emptyDescription: 'Блюда появятся здесь после добавления в меню',
  },
  reservations: 'Бронирование',
  categoryExamples: '«Пицца», «Напитки», «Десерты»',
}

const catalog: VocabEntry = {
  item: {
    label: 'Товар',
    new: 'Новый',
    first: 'первый',
    nom: 'товар', gen: 'товара', dat: 'товару', acc: 'товар', ins: 'товаром', pre: 'товаре',
    plural: {
      label: 'Товары',
      nom: 'товары', gen: 'товаров', dat: 'товарам', acc: 'товары', ins: 'товарами', pre: 'товарах',
    },
    pronoun: { nom: 'он', gen: 'его', dat: 'ему', acc: 'его', ins: 'им', pre: 'нём' },
  },
  menu: {
    label: 'Каталог',
    nom: 'каталог', gen: 'каталога', acc: 'каталог', pre: 'каталоге',
    emptyTitle: 'Каталог пуст',
    emptyDescription: 'Товары появятся здесь после добавления в каталог',
  },
  reservations: 'Бронирование',
  categoryExamples: '«Одежда», «Обувь», «Аксессуары»',
}

const services: VocabEntry = {
  item: {
    label: 'Услуга',
    new: 'Новая',
    first: 'первую',
    nom: 'услуга', gen: 'услуги', dat: 'услуге', acc: 'услугу', ins: 'услугой', pre: 'услуге',
    plural: {
      label: 'Услуги',
      nom: 'услуги', gen: 'услуг', dat: 'услугам', acc: 'услуги', ins: 'услугами', pre: 'услугах',
    },
    pronoun: { nom: 'она', gen: 'её', dat: 'ей', acc: 'её', ins: 'ею', pre: 'ней' },
  },
  menu: {
    label: 'Услуги',
    nom: 'список услуг', gen: 'списка услуг', acc: 'услуги', pre: 'списке услуг',
    emptyTitle: 'Услуги пусты',
    emptyDescription: 'Услуги появятся здесь после добавления в список',
  },
  reservations: 'Запись',
  categoryExamples: '«Стрижка», «Окрашивание», «Маникюр»',
}

export type ItemVariant = 'food' | 'catalog' | 'services'

export const vocabulary: Record<ItemVariant, VocabEntry> = { food, catalog, services }

export const selectItemVariant = (
  businessType: BusinessType | null,
  menuStyle: MenuStyle,
): ItemVariant => {
  if (businessType === 'services') return 'services'
  if (menuStyle === 'catalog') return 'catalog'
  return 'food'
}

export const selectVocabulary = (
  businessType: BusinessType | null,
  menuStyle: MenuStyle,
): VocabEntry => vocabulary[selectItemVariant(businessType, menuStyle)]

export type { ItemVocab, MenuVocab, VocabEntry }
