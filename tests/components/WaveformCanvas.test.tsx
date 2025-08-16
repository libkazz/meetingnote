import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import WaveformCanvas from '../../src/components/WaveformCanvas'

class FakeAnalyser {
  fftSize = 1024
  getByteTimeDomainData(arr: Uint8Array) {
    for (let i = 0; i < arr.length; i++) arr[i] = 128
  }
}

describe('WaveformCanvas', () => {
  it('renders canvas and accepts analyser', () => {
    const a = new (FakeAnalyser as any)() as AnalyserNode
    render(<WaveformCanvas analyser={a} height={80} />)
    const canvas = document.querySelector('canvas.wave')
    expect(canvas).toBeInTheDocument()
  })
})

