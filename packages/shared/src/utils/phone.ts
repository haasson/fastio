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
