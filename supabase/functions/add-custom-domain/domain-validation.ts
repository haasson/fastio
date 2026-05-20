// Hostname: label = LDH (letter/digit/hyphen, не в начале/конце), 1-63 символа;
// общее имя 1-253 символа; минимум 2 label'а. TLD разрешает digits, чтобы пройти
// punycode-IDN типа `.xn--p1ai` (.рф). Юзер сам конвертит IDN в punycode перед отправкой.
//
// PREPROD-207: regex использует только bounded quantifiers ({0,61}, {1,253}) и
// detached lookahead — это линейная сложность по длине, без катастрофического
// backtracking. Юнит-тест в __tests__/domain-validation.test.ts проверяет что на
// 100K-символьных malicious inputs matching < 100ms.
export const DOMAIN_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export type NormalizeResult =
  | { ok: true; domain: string }
  | { ok: false; error: string }

export function normalizeDomain(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'Некорректный домен' }
  // Срезаем протокол / путь / query — юзер часто вставляет полный URL.
  // `www.` НЕ режем: apex и www — разные записи в DNS, silent rewrite сюрпризит.
  const stripped = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
  if (!stripped) return { ok: false, error: 'Некорректный домен' }
  if (stripped.startsWith('www.')) {
    return { ok: false, error: 'Введите apex-домен без префикса www (например, example.com)' }
  }
  // localhost/IP/internal hostnames отсекаем явно.
  if (stripped === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(stripped) || stripped.endsWith('.localhost')) {
    return { ok: false, error: 'Некорректный домен' }
  }
  if (!DOMAIN_REGEX.test(stripped)) return { ok: false, error: 'Некорректный домен' }
  return { ok: true, domain: stripped }
}
