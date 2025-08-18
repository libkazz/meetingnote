import { describe, it, expect } from 'vitest'
import { chunsizeCondition } from '../../src/conditions/chunksize-condition'

describe('chunksize-condition: chunsizeCondition.shouldSend', () => {
  it('returns false before min seconds even with long silence', () => {
    expect(chunsizeCondition.shouldSend(0, 0)).toBe(false)
    expect(chunsizeCondition.shouldSend(9, chunsizeCondition.requiredSilenceMs + 1000)).toBe(false)
  })

  it('requires both min seconds and required silence to trigger', () => {
    // at minSeconds but not enough silence
    expect(chunsizeCondition.shouldSend(chunsizeCondition.minSeconds, chunsizeCondition.requiredSilenceMs - 1)).toBe(false)
    // enough silence but not enough seconds
    expect(chunsizeCondition.shouldSend(chunsizeCondition.minSeconds - 1, chunsizeCondition.requiredSilenceMs)).toBe(false)
  })

  it('returns true when both conditions met', () => {
    expect(chunsizeCondition.shouldSend(chunsizeCondition.minSeconds, chunsizeCondition.requiredSilenceMs)).toBe(true)
    // also when above both thresholds
    expect(chunsizeCondition.shouldSend(chunsizeCondition.minSeconds + 5, chunsizeCondition.requiredSilenceMs + 500)).toBe(true)
  })

  it('returns true when max reached regardless of silence', () => {
    expect(chunsizeCondition.shouldSend(chunsizeCondition.maxSeconds, 0)).toBe(true)
    expect(chunsizeCondition.shouldSend(chunsizeCondition.maxSeconds, chunsizeCondition.requiredSilenceMs + 1000)).toBe(true)
  })
})
