export type ValidationRuleType = 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'pattern' | 'custom'

export type ValidationRule = {
  type?: ValidationRuleType
  required?: boolean
  message: string
  min?: number
  max?: number
  pattern?: RegExp
  validator?: (value: any) => boolean
}

export type FormValues = {
  [fieldName: string]: any
}

export type FormContext = {
  registerField: (name: string, validateFn: () => boolean) => void
  unregisterField: (name: string) => void
}
