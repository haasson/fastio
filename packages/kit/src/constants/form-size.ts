import type { InjectionKey, Ref } from 'vue'
import type { ResponsiveSizeMap } from '../types/responsive'

export const FORM_SIZE_KEY: InjectionKey<Ref<ResponsiveSizeMap>> = Symbol('formSize')
