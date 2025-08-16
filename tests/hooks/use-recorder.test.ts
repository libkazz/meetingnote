import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecorder } from '../../src/hooks/use-recorder'

describe('useRecorder', () => {
  it('starts recording and produces a blob on stop', async () => {
    const { result } = renderHook(() => useRecorder())
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.recording).toBe(true)
    expect(result.current.status).toMatch(/Recording/)
    let blob: Blob | null = null
    await act(async () => {
      blob = await result.current.stop()
    })
    expect(result.current.recording).toBe(false)
    expect(blob).toBeInstanceOf(Blob)
  })
})

