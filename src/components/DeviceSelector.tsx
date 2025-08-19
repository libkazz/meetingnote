import React from "react";

type Props = {
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ensureDevicesLoaded?: () => void | Promise<void>;
};

export default function DeviceSelector({ devices, value, onChange, disabled, ensureDevicesLoaded }: Props) {
  return (
    <select
      id="inputDevice"
      className="btn btn-secondary"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onFocus={ensureDevicesLoaded}
      onMouseDown={ensureDevicesLoaded}
    >
      <option value="">Default</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `Device ${d.deviceId.slice(0, 6)}`}
        </option>
      ))}
    </select>
  );
}
