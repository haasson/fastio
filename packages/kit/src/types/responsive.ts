export type Size = 'tiny' | 'small' | 'medium' | 'large'

export type Breakpoint = 's' | 'm' | 'l' | 'xl'

export const BREAKPOINTS_ORDER = ['s', 'm', 'l', 'xl'] as const satisfies readonly Breakpoint[]

export type ResponsiveSizeMap = Partial<Record<Breakpoint, Size>>
