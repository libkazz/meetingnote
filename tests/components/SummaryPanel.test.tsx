import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../src/lib/api/summary-client', () => ({
  summarizeText: vi.fn(async (text: string) => ({
    text: `ignored:${text}`,
    raw: { message: { content: `summary:${text}` } },
  })),
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

  it('renders escaped newlines as line breaks', async () => {
    const mod = await import('../../src/lib/api/summary-client')
    ;(mod.summarizeText as unknown as jest.Mock).mockResolvedValueOnce({ text: 'ignored', raw: { message: { content: 'line1\\nline2' } } })
    render(<SummaryPanel />)
    fireEvent.change(screen.getByLabelText(/Text to summarize/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }))
    const ta = await screen.findByLabelText(/Summary result/i)
    expect((ta as HTMLTextAreaElement).value).toBe('line1\nline2')
  })

  it('copies summary result to previous on button click', async () => {
    render(<SummaryPanel />)
    fireEvent.change(screen.getByLabelText(/Text to summarize/i), { target: { value: 'hello world' } })
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }))
    const resultTa = await screen.findByLabelText(/Summary result/i)
    const resultVal = (resultTa as HTMLTextAreaElement).value
    fireEvent.click(screen.getByRole('button', { name: /Copy result to previous/i }))
    const prevTa = screen.getByLabelText(/Previous content/i) as HTMLTextAreaElement
    expect(prevTa.value).toBe(resultVal)
  })
})
