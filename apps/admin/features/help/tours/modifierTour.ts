import type { TourStep } from '../composables/useTour'
import { waitForElement } from '../composables/useTour'
import { intro, formField, saveButton, clickAndWait, highlight, navigateToMenuStep, clickMenuTabStep } from './helpers'
import { useTerms } from '~/features/legal'

export const getModifierTourSteps = (): TourStep[] => {
  const { item } = useTerms()

  return [
    intro({
      title: 'Модификаторы',
      description: `Разберёмся с модификаторами — группами вариантов для ${item.plural.gen}: «Размер», «Тесто», «Прожарка». Сначала перейдём в нужный раздел.`,
    }),
    navigateToMenuStep('menu-tab-modifiers'),
    clickMenuTabStep({
      target: 'menu-tab-modifiers',
      title: 'Вкладка «Модификаторы»',
      description: 'Здесь создаются и хранятся все группы вариантов. Нажмите «Далее» чтобы открыть.',
      waitTarget: '.modifiers-root',
    }),
    highlight({
      target: '.modifiers-root',
      title: 'Список модификаторов',
      description: `Модификатор — это группа взаимоисключающих вариантов ${item.gen}, которую гость выбирает при заказе.<br><br>Примеры: <b>Размер</b> (Маленькая / Средняя / Большая), <b>Тесто</b> (Тонкое / Пышное), <b>Прожарка</b> (Слабая / Средняя / Сильная).<br><br>Каждая группа создаётся один раз и затем привязывается к нужным ${item.plural.dat}.`,
      side: 'bottom',
    }),
    clickAndWait({
      target: 'add-modifier',
      title: 'Создать группу',
      description: 'Нажмите «Далее» чтобы посмотреть форму создания группы модификаторов.',
      waitTarget: 'modifier-name',
    }),
    formField({
      target: 'modifier-name',
      title: 'Название группы',
      description: 'Называйте группу понятно — это увидит гость при выборе. Например: «Размер», «Бортик», «Степень остроты».',
    }),
    formField({
      target: 'modifier-active',
      title: 'Активна',
      description: 'Включает или выключает показ этой группы гостям. Неактивную группу можно держать про запас — она не будет отображаться в меню, но сохранится со всеми настройками.',
    }),
    {
      element: '[data-tour="modifier-affects-weight"]',
      popover: {
        title: 'Влияет на вес',
        description: `Включается, если разные варианты группы меняют итоговый вес ${item.gen}. Например, пицца 25 см и 35 см весят по-разному.<br><br>Нажмите «Далее» — включим этот режим и посмотрим как задать вес.`,
        side: 'right',
        align: 'start',
      },
      onNext: async () => {
        document.querySelector<HTMLElement>('[data-tour="modifier-affects-weight"]')?.click()
        document.querySelector<HTMLElement>('[data-tour="modifier-add-option"]')?.click()
        await waitForElement('[data-tour="modifier-weight-mode"]')
      },
    },
    formField({
      target: 'modifier-weight-mode',
      title: 'Где задавать вес',
      description: `<b>На уровне модификатора</b> — вес одинаковый для всех ${item.plural.gen}, которые используют эту группу. Задаётся прямо здесь, рядом с каждой опцией.<br><br><b>У каждого ${item.gen} своё</b> — вес задаётся отдельно для каждого ${item.gen} в форме его редактирования. Подходит, если у разных ${item.plural.gen} с одним размером разный вес.`,
    }),
    formField({
      target: 'modifier-options',
      title: 'Опции',
      description: `Это варианты внутри группы. Для «Размера» — «Маленькая», «Средняя», «Большая».<br><br>Рядом с каждой опцией — поле веса в граммах или миллилитрах. Доплату к цене можно задать позже, прямо в форме редактирования ${item.gen}.<br><br>Порядок опций меняется перетаскиванием за иконку.`,
    }),
    saveButton({
      target: 'modifier-save',
      title: 'Сохранить',
      description: `После сохранения группу можно привязать к любым ${item.plural.dat} — в форме редактирования ${item.gen} в разделе «Модификаторы».`,
    }),
  ]
}
