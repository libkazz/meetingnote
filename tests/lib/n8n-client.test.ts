import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as n8nClient from '../../src/lib/api/n8n-client'

const okJson = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('n8n-client', () => {
  let readEnvSpy: vi.SpiedFunction<typeof n8nClient.readEnv>;

  beforeEach(() => {
    readEnvSpy = vi.spyOn(n8nClient, 'readEnv').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch' as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the proxy URL when USE_PROXY is true', async () => {
    // Arrange
    readEnvSpy.mockImplementation((key: string) => {
      if (key === 'USE_PROXY') return 'true'
      return undefined
    })
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(okJson({ text: 'proxy_ok' }))
    
    // Act
    await n8nClient.transcribeAudio(new Blob(['x']))
    
    // Assert
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/n8n')
  })

  it('throws a formatted error on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    )
    await expect(n8nClient.transcribeAudio(new Blob(['x']))).rejects.toThrow(
      /n8n request failed: 500/
    )
  })

  it('maps a timeout DOMException to a friendly message', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
    await expect(n8nClient.transcribeAudio(new Blob(['x']), { timeoutMs: 5 })).rejects.toThrow(
      /The request timed out/
    )
  })
})

