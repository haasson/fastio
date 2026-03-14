export const isGoogleFontValue = (value: string): boolean =>
  !!value && value !== 'system' && !value.includes(',') && !value.startsWith('-') && !value.startsWith('"')

export const fontFamilyCSS = (value: string): string => {
  if (!value || !isGoogleFontValue(value)) {
    return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
  return `"${value}", sans-serif`
}

export const googleFontUrl = (family: string, weights = '400;500;600;700'): string =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}&display=swap`
