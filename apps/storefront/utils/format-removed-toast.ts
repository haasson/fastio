export function formatRemovedToast(names: string[]): string | null {
  if (names.length === 0) return null
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} и ещё ${names.length - 3}`
}
