import type { TenantTheme } from '../types/tenant'

export const defaultTheme = (): TenantTheme => ({
  primaryColor: '#ff6b35',
  fontFamily: 'inter',
  preset: 'fresh',
  palette: null,
  buttonRadius: 'rounded',
  cardRadius: 14,
  cardShadow: 'subtle',
  customThemes: [],
  activeCustomId: null,
})
