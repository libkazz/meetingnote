import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/api/n8n-client', () => ({
  transcribeAudio: vi.fn(async (blob: Blob) => ({ text: `ok:${blob.type}`, raw: {} })),
  diagnoseConnection: vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', headers: {}, cfg: { apiUrl: '/api/n8n', hasApiKey: false, timeoutMs: 60000, fieldName: 'audio', useProxy: true } })),
  getRuntimeConfig: vi.fn(() => ({ apiUrl: '/api/n8n', hasApiKey: false, timeoutMs: 60000, fieldName: 'audio', useProxy: true })),
}))

import AudioRecorder from '../../src/components/AudioRecorder'
import { transcribeAudio } from '../../src/lib/api/n8n-client'

describe('integration: AudioRecorder end-to-end', () => {
  it('records, sends blob to n8n-client, and renders transcript', async () => {
    render(<AudioRecorder />)
    fireEvent.click(await screen.findByRole('button', { name: /Start Recording/ }))
    expect(await screen.findByText(/Recording/)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))

    await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1))
    const [blobArg] = vi.mocked(transcribeAudio).mock.calls[0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect((blobArg as Blob).type).toMatch(/audio\//)

    // The mocked transcribe returns `ok:<type>`
    await screen.findByText(/ok:audio\//)
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument()
  })

  it('shows an error toast when upload fails', async () => {
    const mod = await import('../../src/lib/api/n8n-client')
    ;(mod.transcribeAudio as unknown as jest.Mock).mockRejectedValueOnce(new Error('boom'))
    render(<AudioRecorder />)
    fireEvent.click(await screen.findByRole('button', { name: /Start Recording/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Stop and Send/ }))
    await screen.findByText(/Error: boom/)
  })

  it('runs diagnostics via embedded panel', async () => {
    render(<AudioRecorder />)
    fireEvent.click(screen.getByRole('button', { name: /Run Diagnostics/i }))
    await waitFor(() => {
      const pre = screen.getByText((content) => content.includes('"ok": true'))
      expect(pre).toBeInTheDocument()
    })
  })
})

