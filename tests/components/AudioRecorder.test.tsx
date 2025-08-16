import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('../../src/lib/api/n8n-client', () => ({
  transcribeAudio: vi.fn(async () => ({ text: 'transcript', raw: {} })),
  diagnoseConnection: vi.fn(async () => ({ ok: true })),
  getRuntimeConfig: vi.fn(() => ({ apiUrl: '/api/n8n', hasApiKey: false, timeoutMs: 60000, fieldName: 'audio', useProxy: true })),
}))

import AudioRecorder from '../../src/components/AudioRecorder'
import { transcribeAudio } from '../../src/lib/api/n8n-client'

describe('AudioRecorder component', () => {
  it('toggles start/stop and shows result', async () => {
    render(<AudioRecorder />)
    const btn = await screen.findByRole('button', { name: /Start Recording/ })
    fireEvent.click(btn)
    expect(await screen.findByText(/Recording/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))
    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled())
    expect(await screen.findByText('transcript')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument()
  })

  it('renders waveform canvas element', async () => {
    render(<AudioRecorder />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('shows toast on upload failure', async () => {
    const mod = await import('../../src/lib/api/n8n-client')
    ;(mod.transcribeAudio as unknown as jest.Mock).mockRejectedValueOnce(new Error('boom'))
    render(<AudioRecorder />)
    fireEvent.click(await screen.findByRole('button', { name: /Start Recording/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))
    await screen.findByText(/Error: boom/)
  })
})

