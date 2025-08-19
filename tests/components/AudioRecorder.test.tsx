import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('../../src/lib/api/transcribe-client', () => ({
  transcribeAudio: vi.fn(async () => ({ text: 'transcript', raw: {} })),
}))
vi.mock('../../src/lib/api/merge-client', () => ({
  mergeAudio: vi.fn(async () => ({ audio_link_url: 'https://example.com/merged.wav', raw: {} })),
}))

import AudioRecorder from '../../src/components/AudioRecorder'
import { transcribeAudio } from '../../src/lib/api/transcribe-client'
import { mergeAudio } from '../../src/lib/api/merge-client'

describe('AudioRecorder component', () => {
  it('toggles start/stop and shows result', async () => {
    render(<AudioRecorder />)
    expect(await screen.findByText(/Meeting ID:/)).toBeInTheDocument()
    const btn = await screen.findByRole('button', { name: /Start Recording/ })
    fireEvent.click(btn)
    expect(await screen.findByText(/Recording\.\.\./)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))
    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled())
    await waitFor(() => expect(mergeAudio).toHaveBeenCalled())
    expect(await screen.findByText('transcript')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Download merged audio/ })).toHaveAttribute('href', 'https://example.com/merged.wav')
  })

  it('renders waveform canvas element', async () => {
    render(<AudioRecorder />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('shows toast on upload failure', async () => {
    const mod = await import('../../src/lib/api/transcribe-client')
    ;(mod.transcribeAudio as unknown as jest.Mock).mockRejectedValueOnce(new Error('boom'))
    render(<AudioRecorder />)
    fireEvent.click(await screen.findByRole('button', { name: /Start Recording/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))
    await screen.findByText(/Error: boom/)
  })
})
