import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as summary from '../../src/lib/api/summary-client'
import * as common from '../../src/lib/api/n8n-common'

const okJson = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('summary-client', () => {
  let readEnvSpy: vi.SpiedFunction<typeof common.readEnv>;

  beforeEach(() => {
    readEnvSpy = vi.spyOn(common, 'readEnv').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch' as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the proxy URL when USE_PROXY is true', async () => {
    readEnvSpy.mockImplementation((key: string) => {
      if (key === 'USE_PROXY') return 'true'
      if (key === 'N8N_SUMMARY_URL') return undefined
      return undefined
    })
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(okJson({ text: 'proxy_ok' }))

    await summary.summarizeText('hello world')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/n8n/summary')
  })

  it('throws a formatted error on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    )
    await expect(summary.summarizeText('x')).rejects.toThrow(/n8n request failed: 500/)
  })

  it('maps a timeout DOMException to a friendly message', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
    await expect(summary.summarizeText('x', { timeoutMs: 5 })).rejects.toThrow(/The request timed out/)
  })
})
