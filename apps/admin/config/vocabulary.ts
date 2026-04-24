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
  pre: string
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
  menu: { label: 'Меню', nom: 'меню', gen: 'меню', pre: 'меню' },
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
  menu: { label: 'Каталог', nom: 'каталог', gen: 'каталога', pre: 'каталоге' },
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
  menu: { label: 'Услуги', nom: 'список услуг', gen: 'списка услуг', pre: 'списке услуг' },
  reservations: 'Запись',
  categoryExamples: '«Стрижка», «Окрашивание», «Маникюр»',
}

export const vocabulary: Record<string, VocabEntry> = { food, catalog, services }

export type { ItemVocab, MenuVocab, VocabEntry }
