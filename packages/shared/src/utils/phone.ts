/** Нормализует телефон в строку из цифр: '8 999 123-45-67' → '79991234567' */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8')) return '7' + digits.slice(1)
  return digits
}

/** Форматирует нормализованный телефон для отображения: '79991234567' → '+7 (999) 123-45-67' */
export const formatPhone = (phone: string): string => {
  const digits = normalizePhone(phone)
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return phone
}

/**
 * Валидирует и нормализует RU-телефон в каноничную форму '79991234567'.
 * Принимает: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX, или 10-значный код+номер.
 * Возвращает строку из 11 цифр (начинается с '7') если валидно, иначе null.
 *
 * Сейчас RU-only — фронт-маска тоже жёсткая. Когда появится мульти-странная
 * валидация (см. tenant.country), функция расширяется по country-аргументу.
 */
export const validateAndNormalizeRussianPhone = (phone: string): string | null => {
  const digits = normalizePhone(phone)
  if (digits.length === 11 && digits.startsWith('7')) return digits
  // 10 цифр — это код+номер без страны. Не префиксуем '7' если первая цифра уже '7':
  // вход '8XXXXXXXXX' (10 цифр, начинается на 8) после normalize становится '7XXXXXXXXX'
  // и без этой защиты получает '77XXXXXXXXX' — невалидный номер.
  if (digits.length === 10 && !digits.startsWith('7')) return '7' + digits
  return null
}
