/**
 * Юнит-тесты на ESLint-барьер вертикалей services↔retail.
 *
 * Каждый кейс прогоняет короткий синтетический файл через ESLint API
 * и проверяет что нужное `no-restricted-imports`-сообщение появляется.
 *
 * Конвенция: docs/vertical-isolation.md.
 */
import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const eslint = new ESLint({
  cwd: ADMIN_ROOT,
  overrideConfigFile: path.join(ADMIN_ROOT, 'eslint.config.mjs'),
})

const cases = [
  {
    name: 'services не может импортировать retail',
    file: 'composables/services/__synthetic__.ts',
    code: 'import { x } from \'~/features/menu\'\nexport const y = x\n',
    expectMessage: /Services не может импортировать retail/,
  },
  {
    name: 'retail не может импортировать services',
    file: 'composables/retail/__synthetic__.ts',
    code: 'import { x } from \'~/features/services-catalog\'\nexport const y = x\n',
    expectMessage: /Retail не может импортировать services/,
  },
  {
    name: 'shared не может импортировать вертикали (services)',
    file: 'composables/data/__synthetic__.ts',
    code: 'import { x } from \'~/features/services-catalog\'\nexport const y = x\n',
    expectMessage: /Shared-код НЕ ДОЛЖЕН знать о вертикалях/,
  },
  {
    name: 'shared не может импортировать вертикали (retail)',
    file: 'composables/data/__synthetic__.ts',
    code: 'import { x } from \'~/features/menu\'\nexport const y = x\n',
    expectMessage: /Shared-код НЕ ДОЛЖЕН знать о вертикалях/,
  },
  {
    name: 'shared не может импортировать вертикали через относительный путь (retail)',
    file: 'utils/__tests__/__synthetic__.test.ts',
    code: 'import { x } from \'../retail/promoStatus\'\nexport const y = x\n',
    expectMessage: /Shared-код НЕ ДОЛЖЕН знать о вертикалях/,
  },
  {
    name: 'shared не может импортировать вертикали через относительный путь (services)',
    file: 'composables/__tests__/__synthetic__.test.ts',
    code: 'import { x } from \'../services/useAppointmentViewScope\'\nexport const y = x\n',
    expectMessage: /Shared-код НЕ ДОЛЖЕН знать о вертикалях/,
  },
  {
    name: 'retail не может импортировать services через относительный путь',
    file: 'composables/retail/__synthetic__.ts',
    code: 'import { x } from \'../services/useServices\'\nexport const y = x\n',
    expectMessage: /Retail не может импортировать services/,
  },
] as const

describe('vertical isolation eslint barrier', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const [result] = await eslint.lintText(c.code, { filePath: path.join(ADMIN_ROOT, c.file) })
      const messages = result.messages.map((m) => m.message).join('\n')

      expect(messages).toMatch(c.expectMessage)
    })
  }

  it('agregator (useDatabase) может импортировать обе вертикали', async () => {
    const code = 'import { x } from \'~/features/services-catalog\'\nimport { y } from \'~/features/menu\'\nexport const z = [x, y]\n'
    const [result] = await eslint.lintText(code, { filePath: path.join(ADMIN_ROOT, 'composables/data/useDatabase.ts') })
    const restricted = result.messages.filter((m) => m.ruleId === 'no-restricted-imports')

    expect(restricted).toEqual([])
  })
})
