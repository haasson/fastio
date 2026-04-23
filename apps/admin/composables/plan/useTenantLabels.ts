import { computed } from 'vue'
import { useTenantStore } from '~/stores/tenant'

export const useTenantLabels = () => {
  const tenantStore = useTenantStore()

  const businessType = computed(() => tenantStore.tenant?.businessType)
  const menuStyle = computed(() => tenantStore.tenant?.menuStyle ?? 'food')
  const isServices = computed(() => businessType.value === 'services')
  const isRetail = computed(() => businessType.value === 'retail')

  const menuLabel = computed(() => {
    if (isServices.value) return 'Услуги'

    return menuStyle.value === 'catalog' ? 'Каталог' : 'Меню'
  })

  const itemLabel = computed(() => {
    if (isServices.value) return 'услуга'

    return menuStyle.value === 'catalog' ? 'товар' : 'блюдо'
  })

  // Винительный падеж единственного числа (добавить что? — блюдо/товар/услугу)
  const itemAccLabel = computed(() => {
    if (isServices.value) return 'услугу'

    return menuStyle.value === 'catalog' ? 'товар' : 'блюдо'
  })

  // «первое блюдо» / «первый товар» / «первую услугу» — числительное согласовано с родом
  const firstItemAccLabel = computed(() => {
    if (isServices.value) return 'первую услугу'

    return menuStyle.value === 'catalog' ? 'первый товар' : 'первое блюдо'
  })

  const itemsLabel = computed(() => {
    if (isServices.value) return 'Услуги'

    return menuStyle.value === 'catalog' ? 'Товары' : 'Блюда'
  })

  const itemsLabelLower = computed(() => {
    if (isServices.value) return 'услуги'

    return menuStyle.value === 'catalog' ? 'товары' : 'блюда'
  })

  const itemsLabelGen = computed(() => {
    if (isServices.value) return 'услуг'

    return menuStyle.value === 'catalog' ? 'товаров' : 'блюд'
  })

  // Творительный падеж мн. ч.: «управляйте {itemsIns}» → «блюдами/товарами/услугами»
  const itemsIns = computed(() => {
    if (isServices.value) return 'услугами'

    return menuStyle.value === 'catalog' ? 'товарами' : 'блюдами'
  })

  // Родительный падеж единственного числа: «фото блюда» / «фото товара» / «карточка услуги»
  const itemGen = computed(() => {
    if (isServices.value) return 'услуги'

    return menuStyle.value === 'catalog' ? 'товара' : 'блюда'
  })

  // Дательный падеж единственного числа: «добавки к блюду» / «к товару» / «к услуге»
  const itemDat = computed(() => {
    if (isServices.value) return 'услуге'

    return menuStyle.value === 'catalog' ? 'товару' : 'блюду'
  })

  // Именительный падеж единственного числа с большой буквы: «Блюдо», «Товар», «Услуга»
  const itemLabelCap = computed(() => {
    if (isServices.value) return 'Услуга'

    return menuStyle.value === 'catalog' ? 'Товар' : 'Блюдо'
  })

  // Нижний регистр для вставки в текст: «нужно заполнить {menuPurpose}»
  const menuPurpose = computed(() => {
    if (isServices.value) return 'список услуг'

    return menuStyle.value === 'catalog' ? 'каталог' : 'меню'
  })

  // Родительный падеж: «разделы вашего {menuPurposeGen}» → «меню / каталога / списка услуг»
  const menuPurposeGen = computed(() => {
    if (isServices.value) return 'списка услуг'

    return menuStyle.value === 'catalog' ? 'каталога' : 'меню'
  })

  // Предложный падеж: «в {menuPurposeLoc}» → «в меню / в каталоге / в списке услуг»
  const menuPurposeLoc = computed(() => {
    if (isServices.value) return 'списке услуг'

    return menuStyle.value === 'catalog' ? 'каталоге' : 'меню'
  })

  // Примеры категорий для онбординга и подсказок
  const categoryExamples = computed(() => {
    if (isServices.value) return '«Стрижка», «Окрашивание», «Маникюр»'

    return menuStyle.value === 'catalog'
      ? '«Одежда», «Обувь», «Аксессуары»'
      : '«Пицца», «Напитки», «Десерты»'
  })

  const reservationsLabel = computed(() => isServices.value ? 'Запись' : 'Бронирование')

  return {
    menuLabel,
    isServices,
    isRetail,
    menuStyle,
    itemLabel,
    itemLabelCap,
    itemAccLabel,
    itemGen,
    itemDat,
    firstItemAccLabel,
    itemsLabel,
    itemsLabelLower,
    itemsLabelGen,
    itemsIns,
    menuPurpose,
    menuPurposeGen,
    menuPurposeLoc,
    categoryExamples,
    reservationsLabel,
  }
}
