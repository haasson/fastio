const alignMap: Record<number, string> = {
  1: 'flex-start', 2: 'flex-start', 3: 'flex-start',
  4: 'center',     5: 'center',     6: 'center',
  7: 'flex-end',   8: 'flex-end',   9: 'flex-end',
}

const justifyMap: Record<number, string> = {
  1: 'flex-start', 2: 'center', 3: 'flex-end',
  4: 'flex-start', 5: 'center', 6: 'flex-end',
  7: 'flex-start', 8: 'center', 9: 'flex-end',
}

export const heroContentPositionStyle = (position: number): { alignItems: string; justifyContent: string } => ({
  alignItems: alignMap[position] ?? 'center',
  justifyContent: justifyMap[position] ?? 'center',
})
