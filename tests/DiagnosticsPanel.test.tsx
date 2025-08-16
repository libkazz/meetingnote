import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../src/lib/api/n8n-client', () => ({
  diagnoseConnection: vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', headers: {}, cfg: { apiUrl: '/api/n8n', hasApiKey: false, timeoutMs: 60000, fieldName: 'audio', useProxy: true } })),
  getRuntimeConfig: vi.fn(() => ({ apiUrl: '/api/n8n', hasApiKey: false, timeoutMs: 60000, fieldName: 'audio', useProxy: true })),
}))

import DiagnosticsPanel from '../src/components/DiagnosticsPanel'

describe('DiagnosticsPanel', () => {
  it('runs diagnostics and shows result JSON', async () => {
    render(<DiagnosticsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Run Diagnostics/i }))
    await waitFor(() => {
      const pre = screen.getByText((content) => content.includes('"ok": true'))
      expect(pre).toBeInTheDocument()
    })
  })
})

