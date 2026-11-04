import { useEffect, useState, type ReactNode } from 'react'
import { call } from './exo-hid'
import { Panel, Progress, Spinner } from './ui'

/**
 * One read of the moving mouse, as Exo reports it: its polling rate (Hz), the gaps between reports Exo judged, how
 * many came a slot late or more, the longest and the 99.9th percentile gap (ms), whether the late ones come with the
 * screen's refresh, and the CPU that took its input (null when Exo couldn't tell).
 */
/** A driver Windows' recording names: its file, what its file says it is, the late reports it explains, its own time in the worst one and that gap (ms), who aimed its interrupts; path: on the mouse's own way in. */
type Named = { file: string; gaps: number; own: number; gap: number; product?: string | null; version?: string | null; origin?: string | null; path: boolean }

/** What the recording says: of the late reports, how many a driver's own time explains, on which CPU; problem says why it names nobody. */
type Drivers = { late: number; explained: number; names: Named[]; cpu?: number | null; problem?: string | null }

type Reading = { rate: number; checked: number; missed: number; longest: number; p999: number; refresh: boolean; cpu: number | null; flow?: Flow | null }

/**
 * How the reports came while it moved, as Windows handed them to Exo: the median gap and the spread of the middle half (ms); batched, the % of gaps
 * under a quarter of a slot, and batch, how many came together; filled, the % of slots with a report; madeUp, late reports whose skipped slots
 * came right after; stretch, most late ones fell in one second.
 */
type Flow = { median: number; spread: number; batched: number; batch: number; filled: number; madeUp: number; stretch: boolean }

/**
 * Where the mouse's CPU stands, as Exo's `exo.mouseCore` answers: stage none (Exo set nothing), restart (set or put
 * back, waiting on Windows' restart) or set (in place since). detail says where it stands or what cleared it; before
 * and after are the reads either side of the restart; test is this session's last read, whose verdict fix offers a
 * quiet CPU, fine needs nothing, cannot says why, and retry didn't see enough.
 */
type Core = {
  stage: 'none' | 'restart' | 'set'
  detail?: string | null
  cpu?: number | null
  better?: boolean | null
  canUndo: boolean
  canName?: boolean
  wireless?: { dropouts: number; empty: number; before?: number | null; lines: string[] } | null
  layout?: Layout | null
  drivers?: Drivers | null
  before?: Reading | null
  after?: Reading | null
  test?: { verdict: 'fix' | 'fine' | 'cannot' | 'retry'; detail: string; offer?: number | null; result: Reading } | null
}

type Action = 'measure' | 'drivers' | 'apply' | 'undo' | 'spread' | 'unspread'

/** What else takes its interrupts on the mouse's CPU and where each could go, or Exo's layout in place: how many devices, waiting on a restart. */
type Layout = { offer: { name: string; kind: string; cpu: number }[]; applied: number; restart: boolean; canUndo: boolean }

/** Exo reads the mouse this long. */
const MEASURE_MS = 10_000

/** A read answers at once; an action waits on the 10 s read or on Windows' permission prompt. */
async function ask(action?: Action): Promise<Core> {
  const reply = await call('exo.mouseCore', action ? { action } : {}, action ? 120_000 : 15_000) as unknown as Partial<Core>
  if (reply.stage !== 'none' && reply.stage !== 'restart' && reply.stage !== 'set') throw new Error('Exo did not say where the CPU stands.')
  return reply as Core
}

/**
 * CPU core, in Performance: whether the mouse's input waits behind other work on a busy CPU, and if it does, a quiet
 * CPU of its own. Measure reads the mouse for 10 seconds while you move it in circles (the bar counts it down); the
 * verdict is one line. When the mouse's input lands on a busy CPU, Give it its own core moves its USB controller's
 * interrupts to a quiet one: Exo asks Windows once, and it takes hold when Windows restarts. Measured again after
 * that, the reads before and after stand side by side; Undo puts it back. Exo itself does the reading and the
 * change (`exo.mouseCore`); with no Exo to answer, the panel isn't there.
 */
export function CpuCore() {
  const [core, setCore] = useState<Core | null>(null)
  const [absent, setAbsent] = useState(false)
  const [busy, setBusy] = useState<Action | null>(null)
  const [failed, setFailed] = useState<{ action: Action; text: string } | null>(null)
  const [left, setLeft] = useState(MEASURE_MS)

  useEffect(() => {
    let live = true
    ask().then(next => { if (live) setCore(next) }, () => { if (live) setAbsent(true) })
    return () => { live = false }
  }, [])

  const act = async (action: Action) => {
    if (busy) return
    setBusy(action)
    setFailed(null)
    let timer = 0
    if (action === 'measure') {
      const end = performance.now() + MEASURE_MS
      setLeft(MEASURE_MS)
      timer = window.setInterval(() => setLeft(Math.max(0, end - performance.now())), 200)
    }
    try {
      setCore(await ask(action))
    } catch (e) {
      setFailed({ action, text: e instanceof Error ? e.message : 'Exo could not do that.' })
      // What Exo refused leaves the state as it was, or changed part of it: read where it stands now.
      await ask().then(setCore, () => undefined)
    } finally {
      window.clearInterval(timer)
      setBusy(null)
    }
  }

  if (absent) return null
  const test = core?.test ?? null
  const stage = core?.stage ?? 'none'
  const offer = test?.verdict === 'fix' && stage !== 'restart' ? test.offer ?? null : null
  const measuring = busy === 'measure'
  const seconds = Math.ceil(left / 1000)
  const late = failed?.action === 'measure' ? failed.text
    : measuring ? (seconds > 0 ? `Move your mouse in circles · ${seconds} s` : 'Checking its reports')
      : verdict(core)
  const own = failed && (failed.action === 'apply' || failed.action === 'undo') ? failed.text
    : stage !== 'none' ? core?.detail ?? null
      : offer !== null ? `CPU ${offer} is quiet. Windows asks once; restart to finish.` : null
  const layout = core?.layout ?? null
  const spreadFailed = failed?.action === 'spread' || failed?.action === 'unspread' ? failed.text : null
  const compare = core?.before && core.after ? { before: core.before, after: core.after } : null
  return (
    <Panel title="CPU core">
      <Line label="Late reports" line={late} bad={failed?.action === 'measure'}>
        {measuring ? (
          <span className="m-core-bar">
            <Progress value={1 - left / MEASURE_MS} label={`Measuring your mouse · ${seconds} of ${MEASURE_MS / 1000} s left`} />
          </span>
        ) : stage === 'restart' ? null : (
          <button type="button" className="m-button" disabled={!!busy} onClick={() => void act('measure')}>
            {test || compare ? 'Measure again' : 'Measure'}
          </button>
        )}
      </Line>
      {test?.result.flow && test.verdict !== 'retry' && !measuring ? (
        <Line label="How they arrive" line={arrival(test.result, test.result.flow)}><span className="m-state">{pace(test.result, test.result.flow)}</span></Line>
      ) : null}
      {core?.wireless && !measuring && busy !== 'drivers' ? (
        <Line label="Wireless" line={core.wireless.lines.join(' ')}>
          <span className={`m-state${core.wireless.dropouts === 0 ? ' is-good' : ''}`}>{core.wireless.dropouts === 0 ? 'No dropouts' : `${n(core.wireless.dropouts)} dropouts`}</span>
        </Line>
      ) : null}
      {core?.canName || core?.drivers || busy === 'drivers' ? (
        <Line label="Driver in its worst gaps" line={busy === 'drivers' ? 'After Windows asks, move your mouse in circles' : failed?.action === 'drivers' ? failed.text : driverLine(core?.drivers ?? null)} bad={failed?.action === 'drivers'}>
          {core?.canName || busy === 'drivers' ? (
            <button type="button" className="m-button" disabled={!!busy} aria-busy={busy === 'drivers'} onClick={() => void act('drivers')}>
              {busy === 'drivers' ? <Spinner label="Recording your drivers while you move your mouse" /> : null}{core?.drivers ? 'Record again' : 'Record'}
            </button>
          ) : null}
        </Line>
      ) : null}
      {offer !== null || stage !== 'none' || core?.canUndo ? (
        <Line label="Own core" line={own} bad={failed?.action === 'apply' || failed?.action === 'undo'}>
          <span className="m-inline">
            {offer !== null ? (
              <button type="button" className="m-button is-primary" disabled={!!busy} aria-busy={busy === 'apply'} onClick={() => void act('apply')}>
                {busy === 'apply' ? <Spinner label={`Giving your mouse CPU ${offer}`} /> : null}Give it its own core
              </button>
            ) : null}
            {core?.canUndo ? (
              <button type="button" className="m-button" disabled={!!busy} aria-busy={busy === 'undo'} onClick={() => void act('undo')}>
                {busy === 'undo' ? <Spinner label="Putting your mouse's CPU back" /> : null}Undo
              </button>
            ) : null}
          </span>
        </Line>
      ) : null}
      {layout && (layout.offer.length > 0 || layout.canUndo || layout.restart) ? (
        <Line label="Other devices on its CPU" line={spreadFailed ?? layoutLine(layout)} bad={!!spreadFailed}>
          <span className="m-inline">
            {layout.offer.length > 0 ? (
              <button type="button" className="m-button" disabled={!!busy} aria-busy={busy === 'spread'} onClick={() => void act('spread')}>
                {busy === 'spread' ? <Spinner label="Moving your other devices" /> : null}Spread them
              </button>
            ) : null}
            {layout.canUndo ? (
              <button type="button" className="m-button" disabled={!!busy} aria-busy={busy === 'unspread'} onClick={() => void act('unspread')}>
                {busy === 'unspread' ? <Spinner label="Putting your other devices back" /> : null}Undo
              </button>
            ) : null}
          </span>
        </Line>
      ) : null}
      {compare ? (
        <>
          <Line label="Before" line={where(compare.before)}><span className="m-state">{count(compare.before)}</span></Line>
          <Line label="After" line={where(compare.after)}>
            <span className={`m-state${core?.better ? ' is-good' : ''}`}>{count(compare.after)}</span>
          </Line>
        </>
      ) : null}
    </Panel>
  )
}

/** A row whose one line under its label may wrap, so a long verdict never pushes its control off the panel. */
function Line({ label, line, bad = false, children }: { label: string; line?: string | null; bad?: boolean; children?: ReactNode }) {
  return (
    <div className="m-row m-core-row">
      <span className="m-row-label">
        {label}
        {line ? <span className={`m-row-value${bad ? ' is-bad' : ''}`} role={bad ? 'alert' : undefined}>{line}</span> : null}
      </span>
      {children ? <span className="m-row-control">{children}</span> : null}
    </div>
  )
}

/** Exo's own words open with the figures; the line says them its own way and keeps only the why. */
const FIGURES = /^\d+ Hz, (?:every report on time|[\d,]+ of [\d,]+ reports late, the longest [\d.]+ ms)\.(?: They come with your screen's refresh\.)?\s*/

const n = (v: number) => v.toLocaleString('en-US')
const count = (r: Reading) => `${n(r.missed)} of ${n(r.checked)} late`
const where = (r: Reading) => `${r.cpu === null ? 'CPU not found' : `CPU ${r.cpu}`} · longest ${r.longest.toFixed(1)} ms`

/** The offer, each kind once with its CPU, or Exo's layout where it stands. Rules of thumb, so it says to measure again. */
function layoutLine(layout: Layout): string {
  if (layout.applied > 0) return `${layout.applied} ${layout.applied === 1 ? 'device' : 'devices'} moved${layout.restart ? ', after you restart Windows' : ''}. Measure again to see if it helped.`
  if (layout.restart) return 'They go back after you restart Windows.'
  const kinds = new Map<string, Set<number>>()
  for (const move of layout.offer) kinds.set(move.kind, (kinds.get(move.kind) ?? new Set()).add(move.cpu))
  const words = [...kinds].map(([kind, cpus]) => `${kind} to CPU ${[...cpus].join(', ')}`).join(' · ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}. A rule of thumb, so measure again after. Windows asks once; restart to finish.`
}

/** Who the recording names, in Exo's words, and what it can't say: a driver is named only when its own time explains the gap, and this is how Windows handled the reports, not input lag. */
function driverLine(drivers: Drivers | null): string {
  if (!drivers) return 'Windows asks once, then records its drivers while you move your mouse'
  if (drivers.problem) return drivers.problem
  const [top, ...rest] = drivers.names
  if (!top) return `No driver's own time on CPU ${drivers.cpu ?? '?'} explains the ${n(drivers.late)} late reports. Not input lag; the recording adds work of its own.`
  const who = [top.product, top.version].filter(Boolean).join(' ')
  const lead = top.path
    ? `${top.file}, on your mouse's own USB path, ran ${top.own} ms on CPU ${drivers.cpu ?? '?'} in a ${top.gap} ms gap`
    : `${top.file} ran ${top.own} ms on CPU ${drivers.cpu ?? '?'} in a ${top.gap} ms gap`
  const parts = [`${lead}, and explains ${n(top.gaps)} of ${n(drivers.late)} late reports`, who, top.origin, rest.length ? `also ${rest.map(d => d.file).join(', ')}` : '']
  return `${parts.filter(Boolean).join(' · ')}. Not input lag; the recording adds work of its own.`
}

/** Exo's own thresholds, provisional: half of them together is batches; a middle half wider than a tenth of a slot (and past Exo's own reading jitter) is uneven. */
function pace(r: Reading, flow: Flow): string {
  if (flow.batched >= 50 && flow.batch > 1) return `In batches of ${flow.batch}`
  return flow.spread > Math.max(1000 / r.rate / 10, 0.05) ? 'Uneven' : 'Steady'
}

/** The facts behind the word, and what they are: when Windows handed each report over, never input lag. */
function arrival(r: Reading, flow: Flow): string {
  const parts = [`${flow.median.toFixed(2)} ms apart, give or take ${flow.spread.toFixed(2)}`, `${Math.floor(flow.filled)}% of slots filled`]
  if (r.missed > 0) parts.push(`${n(flow.madeUp)} of ${n(r.missed)} late ones made up right after`)
  if (flow.stretch) parts.push('most in one stretch')
  return `${parts.join(' · ')}. As Windows handed them over, not input lag.`
}

/** The last read's verdict in one line. */
function verdict(core: Core | null): string | null {
  const test = core?.test
  if (!test) return core?.stage === 'none' ? core.detail ?? null : null
  const r = test.result
  if (test.verdict === 'fix') return `${count(r)} on CPU ${r.cpu ?? '?'}, a busy one`
  const why = test.detail.replace(FIGURES, '') || test.detail
  if (test.verdict === 'retry') return why
  return `${r.missed === 0 ? 'Every report on time' : count(r)}. ${why}`
}
