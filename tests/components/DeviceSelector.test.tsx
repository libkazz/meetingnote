import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeviceSelector from '../../src/components/DeviceSelector'

describe('DeviceSelector', () => {
  const devices: MediaDeviceInfo[] = [
    { deviceId: 'a', kind: 'audioinput', label: 'Mic A' } as MediaDeviceInfo,
    { deviceId: 'b', kind: 'audioinput', label: 'Mic B' } as MediaDeviceInfo,
  ]

  it('renders options and handles selection', () => {
    const onChange = vi.fn()
    render(
      <DeviceSelector
        devices={devices}
        value=""
        onChange={onChange}
        disabled={false}
      />
    )
    expect(screen.getByRole('combobox', { name: /Input device/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Default' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mic A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mic B' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: /Input device/i }), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('triggers ensureDevicesLoaded on focus/click', () => {
    const ensure = vi.fn()
    render(
      <DeviceSelector
        devices={[]}
        value=""
        onChange={() => undefined}
        ensureDevicesLoaded={ensure}
      />
    )
    const select = screen.getByRole('combobox', { name: /Input device/i })
    fireEvent.focus(select)
    fireEvent.mouseDown(select)
    expect(ensure).toHaveBeenCalled()
  })
})

