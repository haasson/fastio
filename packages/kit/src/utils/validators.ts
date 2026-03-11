import type { ValidationRule } from '../types/form'

export function validateRule(value: any, rule: ValidationRule): string | null {
  if (rule.required || rule.type === 'required') {
    if (value === null || value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      return rule.message
    }
    if (typeof value === 'boolean' && !value) {
      return rule.message
    }
  }

  if (!value || (typeof value === 'string' && !value.trim())) {
    return null
  }

  if (rule.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) return rule.message
  }

  if (rule.type === 'phone') {
    const digitsOnly = String(value).replace(/\D/g, '')
    if (!/^\d{11,}$/.test(digitsOnly)) return rule.message
  }

  if (rule.type === 'minLength' && rule.min !== undefined) {
    if (String(value).length < rule.min) return rule.message
  }

  if (rule.type === 'maxLength' && rule.max !== undefined) {
    if (String(value).length > rule.max) return rule.message
  }

  if (rule.type === 'pattern' && rule.pattern) {
    if (!rule.pattern.test(String(value))) return rule.message
  }

  if (rule.type === 'custom' && rule.validator) {
    if (!rule.validator(value)) return rule.message
  }

  return null
}

export function validateValue(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const error = validateRule(value, rule)
    if (error) return error
  }
  return null
}
