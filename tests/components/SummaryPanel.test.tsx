import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/api/summary-client', () => ({
  summarizeText: vi.fn(async (text: string) => ({ text: `summary:${text}`, raw: {} })),
}))

import SummaryPanel from '../../src/components/SummaryPanel'
import { summarizeText } from '../../src/lib/api/summary-client'

describe('SummaryPanel', () => {
  it('runs summarize and shows result text', async () => {
    render(<SummaryPanel />)
    fireEvent.change(screen.getByLabelText(/Text to summarize/i), { target: { value: 'hello world' } })
    fireEvent.change(screen.getByLabelText(/Previous content/i), { target: { value: 'context' } })
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }))
    await waitFor(() => expect(summarizeText).toHaveBeenCalled())
    await screen.findByDisplayValue(/summary:hello world/)
  })

  it('shows toast on failure', async () => {
    const mod = await import('../../src/lib/api/summary-client')
    ;(mod.summarizeText as unknown as jest.Mock).mockRejectedValueOnce(new Error('boom'))
    render(<SummaryPanel />)
    fireEvent.change(screen.getByLabelText(/Text to summarize/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }))
    await screen.findByText(/Error: boom/)
  })
})

