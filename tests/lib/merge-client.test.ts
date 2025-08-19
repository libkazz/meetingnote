import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as merge from '../../src/lib/api/merge-client'
import * as common from '../../src/lib/api/n8n-common'

const okJson = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('merge-client', () => {
  let readEnvSpy: vi.SpiedFunction<typeof common.readEnv>;

  beforeEach(() => {
    readEnvSpy = vi.spyOn(common, 'readEnv').mockImplementation(() => undefined)
    vi.spyOn(globalThis, 'fetch' as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the proxy URL when USE_PROXY is true', async () => {
    readEnvSpy.mockImplementation((key: string) => {
      if (key === 'USE_PROXY') return 'true'
      if (key === 'N8N_MERGE_AUDIO_URL') return undefined
      return undefined
    })
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(okJson({ audio_link_url: 'http://x/y' }))

    await merge.mergeAudio('meeting-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/n8n/merge-audio')
    expect((init as RequestInit).method).toBe('PUT')
  })

  it('throws a formatted error on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    )
    await expect(merge.mergeAudio('meeting-2')).rejects.toThrow(/n8n merge-audio failed: 500/)
  })
})

