import type { ValidationRule } from '../types/form'

/**
 * Стандартные правила валидации для переиспользования в формах
 *
 * @example
 * ```vue
 * <!-- Телефон обязательный -->
 * <UiInput
 *   v-model="phone"
 *   :rules="[validationRules.phone.required, validationRules.phone.format]"
 * />
 *
 * <!-- Email необязательный, но если заполнен — должен быть корректным -->
 * <UiInput
 *   v-model="email"
 *   :rules="[validationRules.email.format]"
 * />
 * ```
 */
export const validationRules = {
  phone: {
    required: {
      type: 'required',
      message: 'Укажите номер телефона',
    } as ValidationRule,

    format: {
      type: 'phone',
      message: 'Некорректный номер телефона',
    } as ValidationRule,
  },

  email: {
    required: {
      type: 'required',
      message: 'Укажите email',
    } as ValidationRule,

    format: {
      type: 'email',
      message: 'Некорректный email',
    } as ValidationRule,
  },

  name: {
    required: {
      type: 'required',
      message: 'Укажите имя',
    } as ValidationRule,
  },

  address: {
    required: {
      type: 'required',
      message: 'Укажите адрес',
    } as ValidationRule,
  },
}
