import { describe, expect, it } from '@jest/globals'

import { configuratorArchiveSchema, MAX_ARCHIVE_HEX_LENGTH } from '../protocol'

describe('configurator archive bounds', () => {
  it('accepts non-empty pairs of uppercase and lowercase hex digits', () => {
    for (const archive of ['00', 'aF', '0123456789abcdefABCDEF']) {
      expect(configuratorArchiveSchema.safeParse(archive).success).toBe(true)
    }
  })

  it('rejects empty, odd-length, non-ASCII and whitespace-containing archives', () => {
    for (const archive of ['', '0', 'abc', 'gg', '0x12', 'AA\n', '\nAA', 'ＡＡ', 42, null]) {
      expect(configuratorArchiveSchema.safeParse(archive).success).toBe(false)
    }
  })

  it('accepts valid hex at the maximum supported archive size without a regexp stack overflow', () => {
    expect(configuratorArchiveSchema.safeParse('a'.repeat(MAX_ARCHIVE_HEX_LENGTH)).success).toBe(true)
  })

  it('reports oversized hex as a bounded validation error', () => {
    const result = configuratorArchiveSchema.safeParse('a'.repeat(MAX_ARCHIVE_HEX_LENGTH + 2))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big'])
  })

  it('rejects an invalid character after a maximum-size hex prefix without throwing', () => {
    const archive = 'a'.repeat(MAX_ARCHIVE_HEX_LENGTH - 1) + 'g'
    expect(configuratorArchiveSchema.safeParse(archive).success).toBe(false)
  })
})
