export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
export const formatDateShort = (iso: string): string => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

export const isoToTs = (iso: string | null): number | null => iso ? new Date(iso).getTime() : null
export const tsToIso = (ts: number | null): string | null => ts ? new Date(ts).toISOString() : null
