import { call, onHostEvent } from './exo-hid'

/**
 * Exo's text size, motion setting, Appearance and glass, followed live.
 *
 * Text size (Settings > General > Text size) is a factor on --exo-scale, which
 * every font size in mouse.css multiplies. Motion is Exo's `data-exo-motion`
 * ('reduce' when Exo's Reduce motion or Windows' is on), set on this frame's
 * root the same way, so mouse.css stops the same moves Exo stops. Standalone,
 * or with a host that does not answer, type stays at 1 and motion follows the
 * system's reduced-motion setting.
 */
const scale = (value: unknown) => {
  const n = Number(value)
  if (Number.isFinite(n) && n > 0.5 && n < 2) document.documentElement.style.setProperty('--exo-scale', String(n))
}

const motion = (value: unknown) => {
  if (value === 'reduce' || value === 'full') document.documentElement.dataset.exoMotion = value
}

/**
 * The values mouse.css draws Exo's glass with (its page and words, a pane, a control, large glass, the hero): Exo
 * sends its own, read off its own surfaces, as plain CSS values, and they replace mouse.css's copies for the
 * Appearance, so the frame is Exo's current glass in every Appearance and Material. Anything else is ignored.
 */
const LOOK = new Set([
  '--bg', '--ink', '--muted', '--faint', '--good', '--bad', '--primary-ink', '--primary-hover', '--track', '--hair',
  '--pane-fill', '--pane-glass', '--pane-edge', '--line-soft', '--hover-fill', '--selected', '--pressed',
  '--fill', '--control-glass', '--rim', '--rim-pressed', '--field-rim', '--panel-fill', '--panel-glass', '--panel-edge',
  '--panel-ink', '--panel-muted', '--panel-hover', '--panel-selected', '--panel-pressed', '--hero-fill', '--hero-edge',
])

/** A colour, a shadow, a filter or a number: nothing that loads or ends the declaration. */
const plain = (value: unknown): value is string => typeof value === 'string' && value.length <= 400 && !/url\(|image-set\(|[;{}\\]/i.test(value)

/** Exo's Appearance (Settings > General) and its glass: mouse.css draws light, dark or void from data-exo-theme, and
    Exo's own values for it land in the same task, so no frame shows one Appearance's glass on the other's page. */
const theme = (value: unknown, look?: unknown) => {
  if (value !== 'light' && value !== 'dark' && value !== 'void') return
  const root = document.documentElement
  root.dataset.exoTheme = value
  if (!look || typeof look !== 'object') return
  for (const [name, css] of Object.entries(look)) {
    if (!LOOK.has(name)) continue
    if (plain(css) && css) root.style.setProperty(name, css)
    else root.style.removeProperty(name)
  }
}

/**
 * The hero's width as Exo draws its other devices' (room.rail, px): one measure for every device's page in Exo. Standalone
 * nothing sends it, and the mouse takes what the columns leave.
 */
const rail = (value: unknown) => {
  const px = Number(value)
  if (!Number.isFinite(px) || px < 200 || px > 1200) return
  document.documentElement.style.setProperty('--exo-rail', `${px}px`)
  window.dispatchEvent(new Event('exo-rail'))
}

export function followHostLook() {
  if (window.parent === window) return
  call('exo.textScale').then(reply => scale(reply.data), () => { })
  call('exo.motion').then(reply => motion(reply.data), () => { })
  call('exo.theme').then(reply => theme(reply.data, reply.look), () => { })
  onHostEvent('room.rail', rail)
  onHostEvent('exo.textScale', data => scale((data as { scale?: unknown } | null)?.scale))
  onHostEvent('exo.motion', data => motion((data as { motion?: unknown } | null)?.motion))
  onHostEvent('exo.theme', data => {
    const sent = data as { theme?: unknown; look?: unknown } | null
    theme(sent?.theme, sent?.look)
  })
}
