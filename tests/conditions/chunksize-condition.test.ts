import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('chunksize-condition env', () => {
  const originalEnv = (import.meta as any).env

  beforeEach(() => {
    ;(import.meta as any).env = { ...originalEnv }
  })
  afterEach(() => {
    ;(import.meta as any).env = originalEnv
    vi.resetModules()
  })

  it('reads VITE_ env overrides', async () => {
    ;(import.meta as any).env.VITE_CHUNK_MIN_SECONDS = '5'
    ;(import.meta as any).env.VITE_CHUNK_MAX_SECONDS = '20'
    ;(import.meta as any).env.VITE_CHUNK_REQUIRED_SILENCE_MS = '1500'
    ;(import.meta as any).env.VITE_CHUNK_MS = '500'
    // re-import module to pick up env
    const mod = await import('../../src/conditions/chunksize-condition')
    const c = (mod as any).chunsizeCondition
    expect(c.minSeconds).toBe(5)
    expect(c.maxSeconds).toBe(20)
    expect(c.requiredSilenceMs).toBe(1500)
    expect(c.chunkMs).toBe(500)
  })
})

