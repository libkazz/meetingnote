import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAudioDevices } from '../../src/hooks/use-audio-devices'

describe('useAudioDevices', () => {
  it('enumerates devices and persists selection', async () => {
    const devices: MediaDeviceInfo[] = [
      { deviceId: 'x', kind: 'audioinput', label: 'X' } as MediaDeviceInfo,
      { deviceId: 'y', kind: 'audioinput', label: 'Y' } as MediaDeviceInfo,
    ]
    ;(navigator.mediaDevices.enumerateDevices as unknown as jest.Mock).mockResolvedValueOnce(devices)

    const { result } = renderHook(() => useAudioDevices())
    await waitFor(() => expect(result.current.devices.length).toBe(2))

    act(() => result.current.setDeviceId('y'))
    expect(localStorage.getItem('meetingnote.inputDeviceId')).toBe('y')
  })

  it('ensureDevicesLoaded requests permission and refreshes devices', async () => {
    const devices: MediaDeviceInfo[] = [
      { deviceId: 'a', kind: 'audioinput', label: 'A' } as MediaDeviceInfo,
    ]
    ;(navigator.mediaDevices.enumerateDevices as unknown as jest.Mock).mockResolvedValue(devices)

    const { result } = renderHook(() => useAudioDevices())
    await act(async () => {
      await result.current.ensureDevicesLoaded()
    })
    expect(result.current.devices.length).toBe(1)
  })
})
