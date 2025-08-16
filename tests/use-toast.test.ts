import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../src/hooks/use-toast'

describe('useToast', () => {
  it('shows and auto-hides toast message', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.showToast('hello', 10)
    })
    expect(result.current.toast).toBe('hello')
    act(() => {
      vi.advanceTimersByTime(11)
    })
    expect(result.current.toast).toBe('')
    vi.useRealTimers()
  })
})

