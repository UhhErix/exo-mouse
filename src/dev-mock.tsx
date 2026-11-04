import { useCallback, useRef, useState } from 'react'
import type { MouseStatus } from '@openmouse/protocol/drivers/mouse-types'
import type { SupportedClient } from '@openmouse/protocol/drivers/registry'
import { Room } from './App'
import type { Candidate, Step, useMouse } from './mouse'

/**
 * Development only: `npx vite` in mouse/, opened with ?mock, shows the room on a
 * Finalmouse Starlight X that is not there, so the whole room can be seen
 * without the mouse or Exo. main.tsx loads this behind import.meta.env.DEV,
 * so a build never contains it. Writes change the pretend mouse after a short
 * wait (the work band shows), the host's calls are answered here, and
 * ?scale=1.25, ?motion=reduce, ?battery=12, ?charging, ?asleep, ?apart, ?lod=1.4
 * and ?fail try the room at another text size, with reduce motion, low,
 * charging, unread for minutes, with the right switch mechanical, on a
 * custom lift-off, or with a write that does not take. ?firmware=1.0.9 is an
 * older Starlight X (no release points reported, no custom lift-off, no Late);
 * ?unread one whose mouse slept through the read (only the receiver answered). ?razer shows a Razer
 * Viper V3 Pro on its HyperSpeed receiver instead, as a friend's reads it
 * (Razer's button controls, asymmetric lift-off, low power mode), for the
 * room with many panels. ?lamzu is a Lamzu with X and Y stored per DPI stage.
 * ?logitech is a PRO X 3 Superstrike on its receiver running from this PC (Host mode: bunny hop as Exo last wrote
 * it, each connection's polling rate in a game profile's sheet); with ?onboard it runs from its memory (bunny hop
 * and button assignments with Keys in the profile), and ?blank is one G HUB never linked. ?hitscan is a Hitscan
 * on its 8K receiver; ?ajazz an AJAZZ set never to sleep. ?wlmouse is a WLMouse Beast X with a sensor angle Exo sets
 * (Sensor angle's Measure); ?atk an ATK F1 Ultimate, whose angle the driver reads but can't set (the measurement
 * alone, under Tests). The Starlight X has none (the measurement alone).
 * ?core=set shows the CPU core panel after Windows' restart, with its reads before and after.
 */

const params = new URLSearchParams(location.search)
const RAZER = params.has('razer')
const LAMZU = params.has('lamzu')
const LOGITECH = params.has('logitech')
const HITSCAN = params.has('hitscan')
const AJAZZ = params.has('ajazz')
const WLMOUSE = params.has('wlmouse')
const ATK = params.has('atk')
const DEVICE = RAZER ? '1532:c1' : LAMZU ? '3554:f5f7' : LOGITECH ? '46d:c54d' : HITSCAN ? '3770:300' : AJAZZ ? 'a8a5:2157'
  : WLMOUSE ? '36a7:a887' : ATK ? '373b:1083' : '361d:200'
const FIRMWARE = params.get('firmware') ?? '1.1.1'
const OLD = FIRMWARE !== '1.1.1'
const UNREAD = params.has('unread')

const START = {
  brand: 'Finalmouse',
  name: 'Finalmouse Starlight X',
  ui: { family: 'finalmouse-slx', defaultDisplayName: 'Finalmouse Starlight X', hideUnsupportedPollingRates: true, forceShowBattery: true, pollingReadOnly: true, hideMotionSync: true },
  batteryPercent: params.has('battery') ? Number(params.get('battery')) : 76,
  batteryVoltageMv: 3940,
  batteryState: params.has('charging') ? 'Charging' : 'Discharging',
  dpi: 800,
  pollingRateHz: 8000,
  supportedPollingRates: [],
  activeProfile: null,
  unitId: null,
  connectionType: 'Wireless',
  connectionDetail: '2.4 GHz receiver · -42 dBm',
  motionSync: null,
  signalStrength: 4,
  liftOffDistance: 'Medium',
  supportedLiftOffDistances: ['Medium', 'High'],
  liftOffScale: null,
  finalmouseIsSlx: true,
  finalmouseDongleLedMode: 2,
  finalmouseIndicatorColor: { r: 61, g: 214, b: 140 },
  finalmouseTournamentScrollMode: 1,
  finalmouseTournamentScrollTimeoutMs: 500,
  finalmouseClickModeL: UNREAD ? null : 1,
  finalmouseClickModeR: UNREAD ? null : params.has('apart') ? 0 : 1,
  finalmouseClickReleaseL: OLD || UNREAD ? null : 0,
  finalmouseClickReleaseR: OLD || UNREAD ? null : 0,
  finalmouseTmrThrL: 25,
  finalmouseTmrThrR: 25,
  finalmouseTmrHystL: 220,
  finalmouseTmrHystR: 220,
  finalmouseTmrMspL: null,
  finalmouseTmrMspR: null,
  finalmousePawLodMm: UNREAD ? null : params.has('lod') ? Number(params.get('lod')) : 1,
  finalmousePawLodCustom: params.has('lod'),
  finalmouseProfileCount: 3,
  finalmouseProfileActive: 0,
  finalmouseProfileEnabledMask: 0b111,
  finalmouseProfileNames: { 0: 'Profile 1', 1: 'Profile 2', 2: 'Profile 3' },
  firmware: UNREAD ? ['Dongle RF 1.1.1'] : [`Mouse ${FIRMWARE}-5289564`, 'Dongle RF 1.1.1'],
} as unknown as MouseStatus

const RAZER_START = {
  brand: 'Razer',
  name: 'Razer Viper V3 Pro',
  ui: {},
  batteryPercent: 56,
  batteryState: 'Discharging',
  dpi: 1600,
  dpiStages: [1600],
  activeDpiStage: 0,
  pollingRateHz: 1000,
  supportedPollingRates: [125, 500, 1000, 2000, 4000, 8000],
  activeProfile: null,
  unitId: null,
  connectionType: 'Wireless',
  connectionDetail: 'HyperSpeed receiver',
  motionSync: null,
  sleepTimeout: 300,
  lowBatteryWarning: 30,
  liftOffDistance: 'Low',
  supportedLiftOffDistances: ['Low', 'Medium', 'High'],
  asymmetricLiftOff: { enabled: null, liftOff: 2, landing: 26, liftOffRange: { min: 2, max: 26 }, landingRange: { min: 1, max: 25 } },
  razerButtonMappings: {
    leftClick: 'Left Click', rightClick: 'Right Click', mouse4: 'Mouse Button 4', mouse5: 'Mouse Button 5',
    scrollUp: 'Scroll Up', scrollDown: 'Scroll Down', sensitivityButton: 'Disabled',
  },
  firmware: ['Mouse 1.14'],
} as unknown as MouseStatus

const LAMZU_START = {
  brand: 'LunaFury',
  name: 'Lamzu Maya X',
  ui: { dpiStageEditor: { minDpi: 50, maxDpi: 30_000, stepDpi: 10, maxStages: 4, countEditable: true } },
  batteryPercent: 64,
  batteryState: 'Discharging',
  dpi: 800,
  dpiStages: [400, 800, 1600],
  dpiStagesY: [400, 720, 1600],
  activeDpiStage: 1,
  pollingRateHz: 1000,
  supportedPollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
  activeProfile: null,
  unitId: null,
  connectionType: 'Wireless',
  connectionDetail: '2.4 GHz receiver',
  motionSync: null,
  liftOffDistance: 'Low',
  lunafury: { separateDpiAxes: true },
  firmware: ['Mouse 1.0.6'],
} as unknown as MouseStatus

/** A PRO X 3 Superstrike: profile format 8, whose cable carries the full rates (USB id C0A9). */
const LOGITECH_START = {
  brand: 'Logitech',
  name: 'PRO X 3 SUPERSTRIKE',
  ui: { family: 'logitech-hidpp' },
  batteryPercent: 81,
  batteryState: 'Discharging',
  dpi: 800,
  pollingRateHz: 2000,
  supportedPollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
  activeProfile: 1,
  unitId: null,
  connectionType: 'Wireless',
  connectionDetail: 'LIGHTSPEED receiver',
  transportIds: { USB: 'C0A9' },
  deviceMode: params.has('onboard') ? 'Onboard' : 'Host',
  onboardProfileFormat: { id: 8, name: 'v8', base: 'v6', supported: true, verified: true, writable: true },
  // mouse.ts fills this in on a mouse running from this PC; off until Exo writes it.
  ...(params.has('onboard') ? {} : { hostBunnyHopMs: 0 }),
  motionSync: null,
  liftOffDistance: null,
  firmware: ['MPM 25.01', 'Receiver 4.2.9'],
} as unknown as MouseStatus

/** The onboard profile the PRO X 3 runs from: bunny hop off, the side buttons as they come. */
const action = (button: number, name: string) => ({ button, action: name, raw: [0x80, 0x01, 0x00, button + 1] })
const LOGITECH_PROFILES = params.has('blank') ? [] : [{
  sector: 1, name: 'Profile 1', enabled: true, bunnyHoppingMs: 0,
  buttonAssignments: [action(0, 'Left click'), action(1, 'Right click'), action(2, 'Middle click'), action(3, 'Back'), action(4, 'Forward')],
  gShiftAssignments: [0, 1, 2, 3, 4].map(b => action(b, 'Disabled')),
}]

function writeLogitechProfile(values: { bunnyHoppingMs?: number; buttonAssignments?: { layer: string; button: number; binding: string | { kind: string; key: number; modifiers: number } }[] }) {
  const profile = LOGITECH_PROFILES[0]
  if (!profile) return
  if (values.bunnyHoppingMs !== undefined) profile.bunnyHoppingMs = values.bunnyHoppingMs
  for (const { layer, button, binding } of values.buttonAssignments ?? []) {
    const list = layer === 'primary' ? profile.buttonAssignments : profile.gShiftAssignments
    list[button] = typeof binding === 'string' ? action(button, binding)
      : { button, action: 'Custom', raw: [0x80, 0x02, binding.modifiers, binding.key] }
  }
}

/** A Hitscan on its 8K receiver, as its driver reads one (not yet run on hardware). */
const HITSCAN_START = {
  brand: 'Hitscan',
  name: 'Hitscan Hyperlight',
  ui: {
    family: 'hitscan', hideUnsupportedPollingRates: true, hideSignalCard: true, hideSleepCard: true, showAdvancedSection: true, forceShowBattery: true,
    dpiStageEditor: { maxStages: 4, countEditable: true, minDpi: 50, maxDpi: 26_000, stepDpi: 50 },
  },
  batteryPercent: 64,
  batteryState: 'Discharging',
  dpi: 800,
  dpiStages: [400, 800, 1600, 3200],
  dpiStageColors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
  activeDpiStage: 1,
  pollingRateHz: 4000,
  supportedPollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
  activeProfile: null,
  unitId: null,
  connectionType: 'Wireless',
  connectionDetail: '8K receiver',
  debounceMs: 4,
  liftOffDistance: 'Low',
  supportedLiftOffDistances: ['Low', 'High'],
  motionSync: true,
  angleSnapping: false,
  rippleControl: false,
  buttonMappings: { Left: 'Left Click', Right: 'Right Click', Middle: 'Middle Click', Back: 'Backward', Forward: 'Forward', DPI: 'DPI Loop' },
  fixedButtons: ['Left'],
  buttonOptions: ['Left Click', 'Right Click', 'Middle Click', 'Backward', 'Forward', 'DPI Loop', 'DPI+', 'DPI-', 'Polling Rate Switch', 'Disable'],
  firmware: ['Mouse 1.0.2'],
} as unknown as MouseStatus

/** An AJAZZ NJ07 set never to sleep, which 0.48 reads as 0 (it read as unknown before). */
const AJAZZ_START = {
  brand: 'AJAZZ',
  name: 'AJAZZ NJ07',
  ui: { family: 'ajazz', hideUnsupportedPollingRates: true, hideProcessingCard: true, hideSignalCard: true,
    dpiStageEditor: { maxStages: 6, countEditable: false, minDpi: 50, maxDpi: 12_800, stepDpi: 50 } },
  batteryPercent: 90,
  batteryState: 'Discharging',
  dpi: 800,
  dpiStages: [400, 800, 1600, 3200, 6400, 12_800],
  activeDpiStage: 1,
  pollingRateHz: 1000,
  supportedPollingRates: [125, 250, 500, 1000],
  activeProfile: null,
  connectionType: 'Wireless',
  connectionDetail: '2.4 GHz receiver',
  liftOffDistance: null,
  sleepTimeout: 0,
  firmware: ['NJ07 1.0.4'],
} as unknown as MouseStatus

/** A WLMouse Beast X on its receiver: a sensor angle in whole degrees, -30 to 30, that its driver sets. */
const WLMOUSE_START = {
  brand: 'WLMouse',
  name: 'WLMouse Beast X',
  ui: {},
  batteryPercent: 71,
  batteryState: 'Discharging',
  dpi: 800,
  pollingRateHz: 1000,
  supportedPollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
  activeProfile: null,
  connectionType: 'Wireless',
  connectionDetail: '2.4 GHz receiver',
  motionSync: true,
  angleSnapping: false,
  angleTuning: 0,
  liftOffDistance: 'Low',
  supportedLiftOffDistances: ['Low', 'Medium', 'High'],
  firmware: ['Mouse 1.2.3'],
} as unknown as MouseStatus

/** An ATK F1 Ultimate: OpenMouse reads its sensor angle (register 0x00bd) but has no write for it. */
const ATK_START = {
  brand: 'ATK',
  name: 'ATK F1 Ultimate',
  ui: { family: 'atk', hideUnsupportedPollingRates: true },
  batteryPercent: 88,
  batteryState: 'Discharging',
  dpi: 1600,
  dpiStages: [800, 1600, 3200],
  activeDpiStage: 1,
  pollingRateHz: 1000,
  supportedPollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
  activeProfile: null,
  connectionType: 'Wireless',
  connectionDetail: '2.4 GHz receiver',
  motionSync: false,
  angleSnapping: false,
  angleTuning: -3,
  atkSensorMode: 1,
  liftOffDistance: 'Low',
  firmware: ['Mouse 1.0.8'],
} as unknown as MouseStatus

type Fields = Record<string, unknown>
const SETTERS: Record<string, (s: Fields, ...a: number[]) => Fields> = {
  setDpi: (s, dpi) => ({ ...s, dpi }),
  setPawLodMm: (s, mm) => ({ ...s, finalmousePawLodMm: mm, finalmousePawLodCustom: false }),
  setLiftOffScale: (s, raw) => ({ ...s, finalmousePawLodMm: raw / 10, finalmousePawLodCustom: true }),
  setClickMode: (s, l, r, rl, rr) => ({ ...s, finalmouseClickModeL: l, finalmouseClickModeR: r, ...(rl == null ? {} : { finalmouseClickReleaseL: rl, finalmouseClickReleaseR: rr }) }),
  setTmrActuation: (s, l, r, hl, hr) => ({ ...s, finalmouseTmrThrL: Math.round(l * 100), finalmouseTmrThrR: Math.round(r * 100), finalmouseTmrHystL: hl, finalmouseTmrHystR: hr }),
  setActiveProfile: (s, i) => ({ ...s, finalmouseProfileActive: i }),
  setDongleLedMode: (s, m) => ({ ...s, finalmouseDongleLedMode: m }),
  setIndicatorColor: (s, r, g, b) => ({ ...s, finalmouseIndicatorColor: { r, g, b } }),
  setTournamentScrollMode: (s, m) => ({ ...s, finalmouseTournamentScrollMode: m }),
  setTournamentScrollTimeout: (s, ms) => ({ ...s, finalmouseTournamentScrollTimeoutMs: ms }),
  setPollingRate: (s, hz) => ({ ...s, pollingRateHz: hz }),
  setSleepTimeout: (s, sec) => ({ ...s, sleepTimeout: sec }),
  setLowPowerThreshold: (s, pct) => ({ ...s, lowBatteryWarning: pct }),
  setLiftOffDistance: (s, d) => ({ ...s, liftOffDistance: d, asymmetricLiftOff: { ...(s.asymmetricLiftOff as object), enabled: false } }),
  setLiftOff: (s, liftOff, landing) => ({ ...s, asymmetricLiftOff: { ...(s.asymmetricLiftOff as object), enabled: true, liftOff, landing } }),
  setActiveDpiStage: (s, i) => ({ ...s, activeDpiStage: i, dpi: (s.dpiStages as number[])[i] }),
  setDpiStageValue: (s, i, x) => ({ ...s, dpiStages: (s.dpiStages as number[]).map((v, j) => j === i ? x : v) }),
  setLunaFuryDpiStageAxes: (s, i, x, y) => ({ ...s, dpiStages: (s.dpiStages as number[]).map((v, j) => j === i ? x : v), dpiStagesY: (s.dpiStagesY as number[]).map((v, j) => j === i ? y : v) }),
  setLunaFurySeparateDpiAxes: (s, on) => ({ ...s, lunafury: { separateDpiAxes: !!on } }),
  setDpiStageCount: (s, n) => ({ ...s, dpiStages: [...(s.dpiStages as number[]), 6400, 12_800, 25_600].slice(0, n) }),
  setDebounceTime: (s, ms) => ({ ...s, debounceMs: ms }),
  setCurrentProfile: (s, sector) => ({ ...s, activeProfile: sector }),
  setHostBunnyHopMs: (s, ms) => { hostBunnyHop = ms; return { ...s, hostBunnyHopMs: ms } },
  setAngleTuning: (s, deg) => ({ ...s, angleTuning: deg }),
}

/** The Logitech's Host bunny hop as mouse.ts keeps it: what was last written. */
let hostBunnyHop = 0

/** Setters whose first argument is a name, flag or object, not a number. */
const NAMED: Record<string, (s: Fields, ...a: unknown[]) => Fields> = {
  setButtonMapping: (s, control, mapping) => s.buttonMappings
    ? { ...s, buttonMappings: { ...(s.buttonMappings as object), [control as string]: mapping } }
    : { ...s, razerButtonMappings: { ...(s.razerButtonMappings as object), [control as string]: mapping } },
  setToggleControl: (s, control, value) => ({ ...s, razerButtonMappings: { ...(s.razerButtonMappings as object), [control as string]: value } }),
  setMotionSync: (s, on) => ({ ...s, motionSync: on }),
  setAngleSnapping: (s, on) => ({ ...s, angleSnapping: on }),
  setRippleControl: (s, on) => ({ ...s, rippleControl: on }),
  setDpiStageColor: (s, i, color) => ({ ...s, dpiStageColors: (s.dpiStageColors as string[]).map((c, j) => j === i ? color : c) }),
  setOnboardMode: (s, mode) => {
    const { hostBunnyHopMs: _, ...rest } = s
    return mode === 'Host' ? { ...rest, deviceMode: mode, hostBunnyHopMs: hostBunnyHop } : { ...rest, deviceMode: mode }
  },
  writeActiveProfile: (s, values) => { writeLogitechProfile(values as Parameters<typeof writeLogitechProfile>[0]); return { ...s } },
}

/** A driver client as far as `can` looks: every setter above, doing nothing itself. */
const CLIENT = {
  ...Object.fromEntries([...Object.keys(SETTERS), ...Object.keys(NAMED)].map(name => [name, async () => undefined])),
  getLowPowerOptions: () => [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
  readOnboardProfiles: async () => structuredClone(LOGITECH_PROFILES),
  ...(HITSCAN ? { getDebounceMaxMs: () => 8 } : {}),
  // ATK's driver reads the angle but has no setter.
  ...(ATK ? { setAngleTuning: undefined } : {}),
  ...(AJAZZ ? { getSleepOptions: () => [0, 60, 180, 300, 600, 1200, 1800, 3600] } : {}),
} as unknown as SupportedClient

const CANDIDATE = {
  id: DEVICE, device: {} as HIDDevice, others: [],
  name: RAZER ? 'Viper V3 Pro' : LAMZU ? 'Maya X' : LOGITECH ? 'PRO X 3 SUPERSTRIKE' : HITSCAN ? 'Hyperlight' : AJAZZ ? 'NJ07'
    : WLMOUSE ? 'Beast X' : ATK ? 'F1 Ultimate' : 'Starlight X',
} satisfies Candidate

const GAMES = [
  { id: 'steam:730', title: 'Counter-Strike 2' },
  { id: 'riot:valorant', title: 'VALORANT' },
  { id: 'steam:1172470', title: 'Apex Legends' },
  { id: 'steam:2357570', title: 'Overwatch 2' },
]

const PROFILES = {
  [DEVICE]: LOGITECH ? [
    { id: 'desktop', name: 'Desktop', isDefault: true, games: [], savedAt: '2026-10-01T12:00:00Z', polling: { Wireless: 2000 },
      steps: [['setDpi', [800]], ['setPollingRate', [2000]], ['setHostBunnyHopMs', [0]]] },
    { id: 'tac', name: 'Tactical', games: ['steam:730', 'riot:valorant'], savedAt: '2026-10-02T12:00:00Z', polling: { Wireless: 4000, Wired: 8000 },
      steps: [['setDpi', [400]], ['setPollingRate', [4000]], ['setHostBunnyHopMs', [150]]] },
    { id: 'arena', name: 'Arena', games: ['steam:1172470'], savedAt: '2026-10-03T12:00:00Z', steps: [['setDpi', [1600]], ['setPollingRate', [1000]]] },
  ] : [
    { id: 'desktop', name: 'Desktop', isDefault: true, games: [], savedAt: '2026-10-01T12:00:00Z', steps: [['setDpi', [800]]] },
    { id: 'tac', name: 'Tactical', games: ['steam:730', 'riot:valorant'], savedAt: '2026-10-02T12:00:00Z', steps: [['setDpi', [400]]] },
    { id: 'arena', name: 'Arena', games: ['steam:1172470'], savedAt: '2026-10-03T12:00:00Z', steps: [['setDpi', [1600]]] },
  ],
}

/**
 * Exo's CPU core (exo.mouseCore): Measure takes its 10 s and finds the mouse late on busy CPU 0 with CPU 6 quiet;
 * Give it its own core then waits on Windows' restart. ?core=set is after the restart, measured before and after.
 */
const CORE_BEFORE = { rate: 1000, checked: 9951, missed: 40, longest: 2.1, p999: 2, refresh: true, cpu: 0, flow: { median: 1, spread: 0.03, batched: 0.4, batch: 2, filled: 99.6, madeUp: 31, stretch: false } }
const CORE_AFTER = { rate: 1000, checked: 9963, missed: 2, longest: 1.6, p999: 1.1, refresh: false, cpu: 6, flow: { median: 1, spread: 0.02, batched: 0, batch: 1, filled: 99.9, madeUp: 2, stretch: false } }
let coreStage: 'none' | 'restart' | 'set' = params.get('core') === 'set' ? 'set' : 'none'
let coreMeasured = false
let coreRecorded = false
let coreSpread = false

function mockCore(action: unknown) {
  if (action === 'measure') coreMeasured = true
  if (action === 'drivers') coreMeasured = coreRecorded = true
  if (action === 'spread') coreSpread = true
  if (action === 'unspread') coreSpread = false
  if (action === 'apply') coreStage = 'restart'
  if (action === 'undo') coreStage = 'none'
  const set = coreStage === 'set'
  return {
    ok: true,
    stage: coreStage,
    detail: coreStage === 'restart' ? "CPU 6 takes your mouse's input after you restart Windows."
      : set ? "Fewer late reports since CPU 6 took your mouse's input." : null,
    cpu: coreStage === 'none' ? null : 6,
    better: set ? true : null,
    canUndo: coreStage !== 'none',
    canName: coreMeasured && coreStage !== 'restart' && !set,
    wireless: !coreMeasured ? null : { dropouts: 12, empty: 1.8, before: null, lines: ['12 dropouts across the test, 1.8% of slots empty.', 'Your Wi-Fi is on 2.4 GHz, channel 6, the band your mouse uses.', 'Try the receiver on a short USB extension, close to the mouse.', 'Exo reads the gaps between reports, not the radio.'] },
    layout: coreSpread ? { offer: [], applied: 3, restart: true, canUndo: true } : {
      offer: coreMeasured && !set ? [{ name: 'Intel Ethernet', kind: 'network adapter', cpu: 8 }, { name: 'HD Audio', kind: 'audio controller', cpu: 10 }, { name: 'xHCI', kind: 'USB controller', cpu: 12 }] : [],
      applied: 0, restart: false, canUndo: false,
    },
    drivers: !coreRecorded ? null : { late: 38, explained: 31, cpu: 0, problem: null, names: [
      { file: 'nvlddmkm.sys', gaps: 26, own: 1.8, gap: 2.1, product: 'NVIDIA Windows Kernel Mode Driver', version: '581.42', origin: 'Interrupts as Windows set them', path: false },
      { file: 'ndis.sys', gaps: 5, own: 0.6, gap: 1.2, product: null, version: null, origin: null, path: false },
    ] },
    before: coreStage === 'none' ? null : CORE_BEFORE,
    after: set ? CORE_AFTER : null,
    test: !coreMeasured ? null : set
      ? { verdict: 'fine', detail: '1000 Hz, 2 of 9,963 reports late, the longest 1.6 ms. Too few to matter, so nothing to change.', offer: null, result: CORE_AFTER }
      : { verdict: 'fix', detail: "1000 Hz, 40 of 9,951 reports late, the longest 2.1 ms. They come with your screen's refresh. Its input lands on CPU 0, where Windows and most drivers go first. CPU 6 is quiet.", offer: 6, result: CORE_BEFORE },
  }
}

/** Exo's side of the frame's messages, answered in the page itself (standalone, the frame's parent is itself). */
function answerHost() {
  const post = window.postMessage.bind(window)
  window.postMessage = ((message: unknown, ...rest: unknown[]) => {
    const m = message as { exo?: string; id?: number; method?: string; params?: { action?: unknown } } | null
    if (m?.exo !== 'mouse') return (post as (...a: unknown[]) => void)(message, ...rest)
    if (typeof m.id !== 'number') return
    const action = m.method === 'exo.mouseCore' ? m.params?.action : undefined
    const result = m.method === 'exo.profiles.read' ? { ok: true, data: PROFILES }
      : m.method === 'exo.games' ? { ok: true, games: GAMES }
        : m.method === 'exo.mouseCore' ? mockCore(action)
          : { ok: true }
    // The core's measure takes the host's 10 s; Windows' prompt behind its change, a moment.
    const wait = action === 'measure' || action === 'drivers' ? 10_000 : action ? 900 : 40
    window.setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: { exo: 'mouse', id: m.id, result }, source: window })), wait)
  }) as typeof window.postMessage
}

function look() {
  const scale = Number(params.get('scale'))
  if (scale > 0.5 && scale < 2) document.documentElement.style.setProperty('--exo-scale', String(scale))
  if (params.get('motion') === 'reduce') document.documentElement.dataset.exoMotion = 'reduce'
}

function useMockMouse(): ReturnType<typeof useMouse> {
  const [status, setStatus] = useState(RAZER ? RAZER_START : LAMZU ? LAMZU_START : LOGITECH ? LOGITECH_START : HITSCAN ? HITSCAN_START
    : AJAZZ ? AJAZZ_START : WLMOUSE ? WLMOUSE_START : ATK ? ATK_START : START)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readAt, setReadAt] = useState(() => Date.now() - (params.has('asleep') ? 4 * 60_000 : 0))
  const now = useRef(status)
  const applyAll = useCallback(async (steps: Step[]) => {
    setBusy(true)
    setError(null)
    await new Promise(resolve => window.setTimeout(resolve, 900))
    if (params.has('fail')) {
      setError('The mouse did not answer. Make sure it is on and close xpanel.')
      setBusy(false)
      return null
    }
    let next = now.current as unknown as Fields
    for (const [method, args] of steps) next = NAMED[method]?.(next, ...args) ?? SETTERS[method]?.(next, ...(args as number[])) ?? next
    now.current = next as unknown as MouseStatus
    setStatus(now.current)
    setReadAt(Date.now())
    setBusy(false)
    return now.current
  }, [])
  const apply = useCallback((method: string, ...args: unknown[]) => applyAll([[method, args]]), [applyAll])
  return {
    phase: 'ready', candidates: [CANDIDATE], current: CANDIDATE, brand: status.brand, status, error, busy,
    client: CLIENT, readAt, apply, applyAll, choose: () => undefined, retry: () => undefined,
  }
}

export function MockApp() {
  return <Room mouse={useMockMouse()} />
}

answerHost()
look()
