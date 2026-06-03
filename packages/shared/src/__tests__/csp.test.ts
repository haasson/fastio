import { describe, it, expect } from 'vitest'
import { buildCsp, buildNonceInjector, BASE_SECURITY_HEADERS } from '../utils/csp'

describe('buildCsp', () => {
  describe('без nonce (legacy fallback)', () => {
    const csp = buildCsp({ imgSrc: `'self' data:` })

    it('содержит unsafe-inline для script-src', () => {
      expect(csp).toMatch(/script-src [^;]*'unsafe-inline'/)
    })

    it('перечисляет доверенные host-источники для script-src', () => {
      expect(csp).toContain('https://oauth.telegram.org')
      expect(csp).toContain('https://api-maps.yandex.ru')
    })

    it('не содержит nonce-источник', () => {
      expect(csp).not.toMatch(/'nonce-/)
    })

    it('не содержит strict-dynamic', () => {
      expect(csp).not.toContain('strict-dynamic')
    })
  })

  describe('с nonce (CSP3)', () => {
    const csp = buildCsp({ imgSrc: `'self'`, nonce: 'ABC123==' })

    it('содержит nonce-источник', () => {
      expect(csp).toContain(`'nonce-ABC123=='`)
    })

    it('содержит strict-dynamic', () => {
      expect(csp).toContain(`'strict-dynamic'`)
    })

    it('сохраняет unsafe-inline как CSP2-fallback', () => {
      expect(csp).toMatch(/script-src [^;]*'unsafe-inline'/)
    })

    it('содержит https: для CSP2 host-allowlist fallback', () => {
      expect(csp).toMatch(/script-src [^;]*https:/)
    })

    it('не содержит http: (бесполезно на HTTPS)', () => {
      expect(csp).not.toMatch(/script-src [^;]*http:[^/]/)
    })

    it('не дублирует доверенные хосты для script-src (их заменяет strict-dynamic)', () => {
      expect(csp).not.toContain('script-src \'self\' \'unsafe-inline\' \'nonce-ABC123==\' \'strict-dynamic\' https: https://oauth.telegram.org')
    })
  })

  describe('connect-src + supabaseUrl', () => {
    it('всегда содержит прод-дефолт db.fastio.ru', () => {
      const csp = buildCsp({ imgSrc: `'self'` })

      expect(csp).toMatch(/connect-src [^;]*https:\/\/db\.fastio\.ru/)
      expect(csp).toMatch(/connect-src [^;]*wss:\/\/db\.fastio\.ru/)
    })

    it('добавляет локальный http-Supabase + ws-вариант в connect-src', () => {
      const csp = buildCsp({ imgSrc: `'self'`, supabaseUrl: 'http://127.0.0.1:54321' })

      expect(csp).toMatch(/connect-src [^;]*http:\/\/127\.0\.0\.1:54321(\s|;)/)
      expect(csp).toMatch(/connect-src [^;]*ws:\/\/127\.0\.0\.1:54321(\s|;)/)
    })

    it('https-Supabase даёт wss-вариант', () => {
      const csp = buildCsp({ imgSrc: `'self'`, supabaseUrl: 'https://staging.example.com' })

      expect(csp).toMatch(/connect-src [^;]*https:\/\/staging\.example\.com(\s|;)/)
      expect(csp).toMatch(/connect-src [^;]*wss:\/\/staging\.example\.com(\s|;)/)
    })

    it('игнорирует пустой / невалидный supabaseUrl без падения', () => {
      expect(() => buildCsp({ imgSrc: `'self'`, supabaseUrl: '' })).not.toThrow()
      expect(() => buildCsp({ imgSrc: `'self'`, supabaseUrl: 'not a url' })).not.toThrow()
      // прод-дефолт остаётся на месте
      expect(buildCsp({ imgSrc: `'self'`, supabaseUrl: 'not a url' })).toMatch(/connect-src [^;]*https:\/\/db\.fastio\.ru/)
    })
  })

  it('добавляет report-uri если задан', () => {
    const csp = buildCsp({ imgSrc: `'self'`, reportUri: 'https://sentry.example/report' })

    expect(csp).toContain('report-uri https://sentry.example/report')
  })

  it('не добавляет report-uri если не задан', () => {
    const csp = buildCsp({ imgSrc: `'self'` })

    expect(csp).not.toContain('report-uri')
  })

  it('всегда содержит базовые директивы', () => {
    const csp = buildCsp({ imgSrc: `'self'` })

    expect(csp).toContain(`default-src 'self'`)
    expect(csp).toContain(`object-src 'none'`)
    expect(csp).toContain(`frame-ancestors 'self'`)
    expect(csp).toContain('upgrade-insecure-requests')
  })
})

describe('BASE_SECURITY_HEADERS', () => {
  it('содержит обязательные защитные заголовки', () => {
    expect(BASE_SECURITY_HEADERS['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(BASE_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    expect(BASE_SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=')
  })
})

describe('buildNonceInjector', () => {
  const inject = buildNonceInjector('TESTNONCE')

  it('добавляет nonce к простому inline-script', () => {
    expect(inject('<script>x()</script>')).toBe('<script nonce="TESTNONCE">x()</script>')
  })

  it('добавляет nonce к скрипту с src', () => {
    expect(inject('<script src="/a.js"></script>'))
      .toBe('<script nonce="TESTNONCE" src="/a.js"></script>')
  })

  it('добавляет nonce к module-скрипту', () => {
    expect(inject('<script type="module" src="/x.mjs"></script>'))
      .toBe('<script nonce="TESTNONCE" type="module" src="/x.mjs"></script>')
  })

  it('не перезаписывает существующий nonce', () => {
    expect(inject('<script nonce="EXISTING">y</script>'))
      .toBe('<script nonce="EXISTING">y</script>')
  })

  it('обрабатывает несколько скриптов в одном чанке', () => {
    const input = '<script>a</script><div>x</div><script src="b.js"></script>'
    expect(inject(input)).toBe('<script nonce="TESTNONCE">a</script><div>x</div><script nonce="TESTNONCE" src="b.js"></script>')
  })

  it('не трогает закрывающий </script>', () => {
    const out = inject('<script>x</script>')

    expect(out).not.toContain('</script nonce=')
  })

  it('case-insensitive: обрабатывает <SCRIPT>', () => {
    expect(inject('<SCRIPT>z</SCRIPT>'))
      .toBe('<script nonce="TESTNONCE">z</SCRIPT>')
  })

  it('не трогает не-script теги', () => {
    expect(inject('<div>nope</div>')).toBe('<div>nope</div>')
  })

  it('обрабатывает script с атрибутом до nonce', () => {
    // negative lookahead должен проверить всю последовательность до >
    expect(inject('<script defer>x</script>'))
      .toBe('<script nonce="TESTNONCE" defer>x</script>')
  })
})
