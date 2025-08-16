import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Run cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup()
})

// requestAnimationFrame: avoid tight loops in tests
// Do not invoke callback to keep drawing inert during tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).requestAnimationFrame = vi.fn(() => 1)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).cancelAnimationFrame = vi.fn()

// Minimal MediaRecorder mock
class MockMediaRecorder {
  stream: MediaStream
  mimeType?: string
  state: 'inactive' | 'recording' = 'inactive'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ondataavailable: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onstop: any = null
  constructor(stream: MediaStream, opts?: { mimeType?: string }) {
    this.stream = stream
    this.mimeType = opts?.mimeType
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    // push one chunk then stop
    const blob = new Blob(['test'], { type: 'audio/webm' })
    this.ondataavailable?.({ data: blob, size: blob.size })
    this.onstop?.()
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).MediaRecorder = MockMediaRecorder

// getUserMedia mock
const fakeTrack = { stop: vi.fn() }
const fakeStream: MediaStream = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTracks: () => [fakeTrack as any],
  // Below are to satisfy type compatibility in some TS environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).navigator = (globalThis as any).navigator || {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).navigator.mediaDevices = {
  getUserMedia: vi.fn(async () => fakeStream),
}

// Minimal AudioContext mock
class MockAnalyser implements Partial<AnalyserNode> {
  fftSize = 1024
  getByteTimeDomainData(arr: Uint8Array) {
    for (let i = 0; i < arr.length; i++) arr[i] = 128
  }
}
class MockAudioContext {
  state: 'running' | 'suspended' = 'running'
  createMediaStreamSource() {
    return { connect: () => undefined }
  }
  createAnalyser() {
    return new MockAnalyser() as unknown as AnalyserNode
  }
  close() { return Promise.resolve() }
  resume() { this.state = 'running'; return Promise.resolve() }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).AudioContext = MockAudioContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).webkitAudioContext = MockAudioContext

// Clipboard + execCommand
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).isSecureContext = true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).navigator.clipboard = { writeText: vi.fn() }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).document.execCommand = vi.fn(() => true)