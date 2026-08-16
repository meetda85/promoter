import { useEffect, type ReactNode } from 'react'

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      className="switch"
      data-on={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="row between" style={{ padding: '9px 0' }}>
      <div className="grow">
        <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
        {hint && <div className="muted">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div className="field">
      <div className="row between">
        <label>{label}</label>
        <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {format ? format(value) : `${Math.round(value * 100) / 100}${suffix}`}
        </span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} data-on={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({
  title,
  onClose,
  children,
  actions,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="grabber" />
        <header>
          <h2>{title}</h2>
          {actions}
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </>
  )
}

export function Swatches({
  colors,
  value,
  onChange,
  allowNone,
}: {
  colors: string[]
  value?: string
  onChange: (color: string | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="swatches">
      {allowNone && (
        <button
          className="swatch"
          data-on={!value}
          onClick={() => onChange(null)}
          aria-label="Sin color"
          style={{
            background:
              'linear-gradient(135deg, transparent 46%, var(--danger) 46%, var(--danger) 54%, transparent 54%)',
          }}
        />
      )}
      {colors.map((c) => (
        <button
          key={c}
          className="swatch"
          data-on={value?.toLowerCase() === c.toLowerCase()}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

export function StatusChip({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'idle'
  children: ReactNode
}) {
  return (
    <span className="chip" data-tone={tone === 'idle' ? undefined : tone}>
      <span className="dot" />
      {children}
    </span>
  )
}
