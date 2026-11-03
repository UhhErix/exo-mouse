import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useGlide } from './glide'
import { groupOf } from './section'

/** A polling rate as a choice reads it: 500, 1K, 8K. */
export const hz = (v: number): string => (v >= 1000 ? `${v / 1000}K` : String(v))

/** A section: its name is the only bold type, its rows ruled by hairlines; it rises in when it appears. */
export function Panel({ title, actions, children }: { title: string; children?: ReactNode; /** Buttons on the title's own line, for a panel that is only a few actions. */ actions?: ReactNode }) {
  const id = useId()
  return (
    <section className={`m-panel m-arrive${actions ? ' has-actions' : ''}`} aria-labelledby={id} data-group={groupOf(title)}>
      {actions ? (
        <div className="m-panel-head">
          <h2 id={id} className="m-panel-title">{title}</h2>
          <span className="m-actions">{actions}</span>
        </div>
      ) : <h2 id={id} className="m-panel-title">{title}</h2>}
      {children}
    </section>
  )
}

/** Label left, control on the shared right edge, a hairline above. */
export function Row({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="m-row">
      <span className="m-row-label">{label}{value ? <span className="m-row-value">{value}</span> : null}</span>
      <span className="m-row-control">{children}</span>
    </div>
  )
}

/** One pill; the current option filled, the fill gliding to a new choice. */
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled = false }: {
  label: string
  /** color: a dot before the label (a DPI stage's LED color). */
  options: readonly { value: T; label: string; disabled?: boolean; color?: string }[]
  value: T | null | undefined
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const glide = useGlide<HTMLSpanElement>()
  return (
    <span ref={glide} className="m-seg m-glide" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`m-seg-item${o.value === value ? ' is-on' : ''}`}
          disabled={disabled || o.disabled}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.color ? <span className="m-seg-dot" style={{ background: o.color }} /> : null}
          {o.label}
        </button>
      ))}
    </span>
  )
}

/** Exo's switch: a dark track, white when on. */
export function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="m-switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="m-switch-knob" />
    </button>
  )
}

/**
 * Exo's bar (Exo's components/ui/Progress.tsx: the same props and markup; mouse.css › Progress), only for work with a
 * measure (a timed test): a glass track holding the ink's fill with a sheen and a lit head at its end; with no number,
 * a lit segment glides along the track. A wait without a measure is the ring (Spinner) or the shine (mouse.css › Waits).
 */
export function Progress({ value, label, size, edge, tone, className }: {
  /** How far along, 0 to 1; null or undefined while that isn't known. */
  value?: number | null
  /** What is happening, for screen readers. */
  label: string
  /** small: on a card or art; large: a window's one bar. */
  size?: 'small' | 'large'
  /** Along the inside foot of what holds it (a button, the mouse's picture). */
  edge?: boolean
  /** done: it finished (green); bad: it stopped short (red). */
  tone?: 'done' | 'bad'
  className?: string
}) {
  const known = typeof value === 'number' && Number.isFinite(value)
  const fraction = known ? Math.min(1, Math.max(0, value)) : 0
  const classes = ['m-progress', !known && 'is-unknown', size && `is-${size}`, edge && 'is-edge', tone && `is-${tone}`, className]
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? 100 : undefined}
      aria-valuenow={known ? Math.round(fraction * 100) : undefined}
      className={classes.filter(Boolean).join(' ')}
      style={{ '--m-progress': fraction } as CSSProperties}
    >
      <span className="m-progress-track"><span className="m-progress-fill" /></span>
      <span className="m-progress-head" aria-hidden="true" />
    </span>
  )
}

/**
 * Exo's ring (Exo's components/ui/Spinner.tsx; mouse.css › Waits): a short wait inside a control of words, before
 * them, in their color; a status with its label for screen readers.
 */
export function Spinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <svg className="m-spinner" width={size} height={size} viewBox="0 0 16 16" fill="none"
      role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ in place
 * Nothing pops up over the room to ask (Exo's DESIGN.md › Confirm): the control pressed asks where it is, and what
 * takes more room hangs from that control as large glass. */

/** How long an asking control waits with nothing pressed before it goes back. */
const ASKING_MS = 4000

const reduced = () => document.documentElement.dataset.exoMotion === 'reduce'
  || (!document.documentElement.dataset.exoMotion && matchMedia('(prefers-reduced-motion: reduce)').matches)

const token = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

/**
 * Asks before it runs: the first press arms the control and its words become the question, its width springing to
 * them on the move time; a second press (Enter or Space too) runs it. Escape, a press anywhere else, focus leaving or
 * 4 s with nothing pressed put it back. `arm` asks without a press: a choice that costs, asked beside itself.
 */
export function useAsk(run: () => void) {
  const [armed, setArmed] = useState(false)
  const [asked, setAsked] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const was = useRef<number | null>(null)
  const go = useRef(run)
  useEffect(() => { go.current = run })
  const set = (next: boolean) => {
    was.current = ref.current?.getBoundingClientRect().width ?? null
    setArmed(next)
    setAsked(true)
  }
  useLayoutEffect(() => {
    const button = ref.current
    const from = was.current
    was.current = null
    if (!button || from === null || reduced()) return
    const to = button.getBoundingClientRect().width
    if (Math.abs(to - from) >= 1) button.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: parseFloat(token('--dur-move', '220')), easing: token('--ease-spring', 'ease-out') })
  }, [armed])
  useEffect(() => {
    const button = ref.current
    if (!armed || !button) return
    const back = () => setArmed(false)
    const timer = window.setTimeout(back, ASKING_MS)
    const away = (e: PointerEvent) => { if (!button.contains(e.target as Node)) back() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back() } }
    document.addEventListener('pointerdown', away, true)
    button.addEventListener('keydown', key)
    button.addEventListener('focusout', back)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', away, true)
      button.removeEventListener('keydown', key)
      button.removeEventListener('focusout', back)
    }
  }, [armed])
  return {
    armed,
    ref,
    /** The control's words: the question while armed, fading in as they change. */
    words: (question: string, rest: ReactNode) => <span key={armed ? 'ask' : 'rest'} className={`m-ask-words${asked ? ' is-in' : ''}`}>{armed ? question : rest}</span>,
    press: () => { if (!armed) { set(true); return } set(false); go.current() },
    arm: () => { ref.current?.focus({ preventScroll: true }); set(true) },
  }
}

/** A button that asks in place before it runs (useAsk), its question in Bad when it deletes. */
export function AskButton({ question, danger = false, onConfirm, className, children, disabled }: {
  question: string
  danger?: boolean
  onConfirm: () => void
  className: string
  children: ReactNode
  disabled?: boolean
}) {
  const ask = useAsk(onConfirm)
  return (
    <button ref={ask.ref} type="button" className={`${className} m-ask${ask.armed ? ' is-armed' : ''}${ask.armed && danger ? ' is-danger' : ''}`}
      disabled={disabled} onClick={ask.press}>
      {ask.words(question, children)}
    </button>
  )
}

/** The last press in the frame, so a popover knows the control it hangs from even when that control takes no focus. */
let lastPress: { target: Element; time: number } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => { if (e.target instanceof Element) lastPress = { target: e.target, time: performance.now() } }, true)
}

const HANG_GAP = 6
const HANG_EDGE = 12

/** Under its control from the control's left edge, or its right edge where the frame runs out; above it when there is
 * no room below; never past the frame's edge. With no control it hangs from the frame's top, centered. */
function hang(box: HTMLElement, from: DOMRect | null) {
  const width = box.offsetWidth
  const height = box.offsetHeight
  const at = from ?? new DOMRect((window.innerWidth - width) / 2, HANG_EDGE, width, 0)
  const above = at.top - HANG_GAP - height
  const up = at.bottom + HANG_GAP + height > window.innerHeight - HANG_EDGE && above >= HANG_EDGE
  const right = at.left + width > window.innerWidth - HANG_EDGE
  const top = up ? above : Math.max(HANG_EDGE, Math.min(at.bottom + HANG_GAP, window.innerHeight - HANG_EDGE - height))
  const left = Math.max(HANG_EDGE, Math.min(right ? at.right - width : at.left, window.innerWidth - HANG_EDGE - width))
  box.style.top = `${Math.round(top)}px`
  box.style.left = `${Math.round(left)}px`
  box.style.transformOrigin = `${right ? 'right' : 'left'} ${up ? 'bottom' : 'top'}`
}

/** Glass leaves by fading on the quick time: a still copy holds its place while it fades, since React has already taken
 * the popover away. Under Reduce motion it is simply gone. */
function fadeOut(box: HTMLElement) {
  if (reduced()) return
  const copy = box.cloneNode(true) as HTMLElement
  copy.inert = true
  copy.setAttribute('aria-hidden', 'true')
  copy.removeAttribute('role')
  for (const named of copy.querySelectorAll('[id]')) named.removeAttribute('id')
  queueMicrotask(() => {
    if (box.isConnected) return
    copy.style.transition = 'none'
    document.body.append(copy)
    copy.showPopover()
    const quick = parseFloat(token('--dur-quick', '120'))
    const gone = () => copy.remove()
    window.setTimeout(gone, quick + 100)
    copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quick, easing: token('--ease', 'ease-out'), fill: 'forwards' }).finished.then(gone, gone)
  })
}

/**
 * Large glass hung from the control that opened it, in the top layer, never in the room's middle over a scrim: a
 * profile's games, a test's pad. It grows from its control's side and fades away; Escape or a press outside closes it
 * (that press goes no further), Tab stays inside, focus starts on what asks for it (`autoFocus`), else the popover, and
 * goes back where it was when it closes.
 */
export function Popover({ label, labelledBy, className, onClose, children }: {
  label?: string
  labelledBy?: string
  className: string
  onClose: () => void
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  // What it holds mounts once it shows, so a field's autoFocus lands: nothing takes focus in a popover not yet shown.
  const [shown, setShown] = useState(false)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const pressed = lastPress && performance.now() - lastPress.time < 1500 ? lastPress.target.closest('button, a, input, [tabindex]') ?? lastPress.target : null
    const focused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    const control = pressed?.isConnected ? pressed : focused
    const kept = control?.getBoundingClientRect() ?? null
    if (!el.matches(':popover-open')) el.showPopover()
    setShown(true)
    const fit = () => hang(el, control?.isConnected ? control.getBoundingClientRect() : kept)
    fit()
    // A field that asks for focus takes it as it mounts; else the popover holds it, so Tab goes on from there.
    requestAnimationFrame(() => { if (!el.contains(document.activeElement)) el.focus({ preventScroll: true }) })
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const stops = [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (stops.length === 0) { e.preventDefault(); return }
      const at = stops.indexOf(document.activeElement as HTMLElement)
      if (at === -1 || (e.shiftKey ? at === 0 : at === stops.length - 1)) {
        e.preventDefault()
        stops[e.shiftKey ? stops.length - 1 : 0].focus()
      }
    }
    const away = (e: PointerEvent) => {
      const target = e.target as Element
      if (el.contains(target) || target.closest?.('.m-menu')) return
      e.preventDefault()
      e.stopPropagation()
      const swallow = (next: Event) => { next.preventDefault(); next.stopPropagation() }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 500)
      close.current()
    }
    const sizes = new ResizeObserver(fit)
    sizes.observe(el)
    window.addEventListener('resize', fit)
    window.addEventListener('keydown', key)
    document.addEventListener('pointerdown', away, true)
    return () => {
      sizes.disconnect()
      window.removeEventListener('resize', fit)
      window.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', away, true)
      fadeOut(el)
      if (focused?.isConnected) focused.focus({ preventScroll: true })
    }
  }, [])
  return (
    <div ref={box} popover="manual" className={`m-pop ${className}`} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} tabIndex={-1}>
      {shown ? children : null}
    </div>
  )
}

/**
 * A color well that writes once, when the picker closes, so dragging through
 * colors does not send the mouse a command for each one.
 */
export function ColorField({ label, value, onCommit, disabled = false }: { label: string; value: string; onCommit: (hex: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const committed = useRef(value)
  const commit = useRef(onCommit)
  commit.current = onCommit
  useEffect(() => { setDraft(value); committed.current = value }, [value])
  useEffect(() => {
    const input = ref.current
    if (!input) return
    const done = () => {
      const next = input.value.toLowerCase()
      if (next !== committed.current.toLowerCase()) commit.current(next)
    }
    input.addEventListener('change', done)
    return () => input.removeEventListener('change', done)
  }, [])
  return <input ref={ref} type="color" className="m-color" aria-label={label} value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} />
}

/**
 * A slider that follows the pointer and writes once, on release (or on the
 * last arrow key), so dragging does not send the mouse a command per pixel.
 */
export function Slider({ label, min, max, step, value, format, onCommit, disabled = false }: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format?: (v: number) => string
  onCommit: (v: number) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [held, setHeld] = useState(false)
  useEffect(() => { if (!held) setDraft(value) }, [value, held])
  const commit = () => {
    setHeld(false)
    if (draft !== value) onCommit(draft)
  }
  return (
    <span className="m-slider">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        style={{ '--fill': `${((draft - min) / (max - min || 1)) * 100}%` } as CSSProperties}
        onPointerDown={() => setHeld(true)}
        onChange={e => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={() => held && commit()}
      />
      {format ? <span className="m-slider-value">{format(draft)}</span> : null}
    </span>
  )
}

/** A number typed in: written on Enter or when the field loses focus, clamped and snapped to the step. */
export function NumberField({ label, min, max, step, value, suffix, onCommit, disabled = false }: {
  label: string
  min: number
  max: number
  step: number
  value: number
  suffix?: string
  onCommit: (v: number) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = Number(text)
    if (!Number.isFinite(n)) { setText(String(value)); return }
    const snapped = Math.min(max, Math.max(min, Math.round(n / step) * step))
    setText(String(snapped))
    if (snapped !== value) onCommit(snapped)
  }
  return (
    <span className="m-number">
      <input
        aria-label={label}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={e => setText(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      {suffix ? <span className="m-number-suffix">{suffix}</span> : null}
    </span>
  )
}

export function Select({ label, options, value, onChange, disabled = false }: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return <Dropdown label={label} options={options.map(o => ({ value: o, label: o }))} value={value} onChange={onChange} disabled={disabled} placeholder={value} />
}

/** One choice in a Dropdown: what is sent, what is shown, and the heading it sits under. */
export type DropOption<T> = { value: T; label: string; group?: string; disabled?: boolean }

/**
 * Exo's dropdown: a pill like the room's other controls that opens Exo's own
 * menu (never Windows' list), below it or above when the room ends first.
 * Arrow keys move, Enter picks, Escape or a click elsewhere closes. A current
 * value that is not one of the options shows as `placeholder`.
 */
export function Dropdown<T extends string | number>({ label, options, value, onChange, disabled = false, placeholder }: {
  label: string
  options: readonly DropOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
}) {
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<CSSProperties>({})
  const current = options.find(o => o.value === value)
  const shown = current?.label ?? placeholder ?? (value == null ? '' : String(value))
  const pickable = options.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0)

  const show = () => {
    const box = button.current?.getBoundingClientRect()
    if (!box) return
    const below = window.innerHeight - box.bottom - 8
    const above = box.top - 8
    const height = Math.min(320, Math.max(below, above))
    setPlace({
      left: Math.max(8, Math.min(box.right - Math.max(box.width, 180), window.innerWidth - 8 - Math.max(box.width, 180))),
      minWidth: Math.max(box.width, 180),
      maxHeight: height,
      ...(below >= Math.min(320, options.length * 36 + 8) || below >= above ? { top: box.bottom + 4 } : { bottom: window.innerHeight - box.top + 4 }),
    })
    const at = options.findIndex(o => o.value === value)
    setActive(at >= 0 ? at : pickable[0] ?? 0)
    setOpen(true)
  }
  const close = (focus = true) => { setOpen(false); if (focus) button.current?.focus() }
  const pick = (i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    close()
    if (o.value !== value) onChange(o.value)
  }
  const step = (by: number) => {
    const at = pickable.indexOf(active)
    const next = pickable[Math.max(0, Math.min(pickable.length - 1, (at < 0 ? 0 : at) + by))]
    if (next !== undefined) setActive(next)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close(false)
    }
    const shut = () => close(false)
    document.addEventListener('mousedown', away)
    window.addEventListener('resize', shut)
    window.addEventListener('blur', shut)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('resize', shut)
      window.removeEventListener('blur', shut)
    }
  }, [open])
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(pickable[0] ?? 0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(pickable[pickable.length - 1] ?? 0) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }

  return (
    <>
      <button ref={button} type="button" className="m-select" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled} onClick={() => (open ? close() : show())} onKeyDown={onKey}>
        <span className="m-select-value">{shown}</span>
        <svg className="m-select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? createPortal(
        <ul ref={menu} id={listId} className="m-menu" role="listbox" aria-label={label} style={place}>
          {options.map((o, i) => (
            <Fragment key={`${String(o.value)}-${i}`}>
              {o.group && o.group !== options[i - 1]?.group ? <li className="m-menu-group" role="presentation">{o.group}</li> : null}
              <li id={`${listId}-${i}`} data-i={i} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined}
                className={`m-menu-item${i === active ? ' is-active' : ''}${o.value === value ? ' is-on' : ''}`}
                onMouseEnter={() => { if (!o.disabled) setActive(i) }} onMouseDown={e => e.preventDefault()} onClick={() => pick(i)}>
                {o.label}
              </li>
            </Fragment>
          ))}
        </ul>,
        document.body,
      ) : null}
    </>
  )
}
