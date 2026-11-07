# Exo Mouse

The mouse software in [Exo Launcher](https://github.com/UhhErix/ExoLauncher)'s
Devices room. It talks to your mouse directly over USB, with no vendor app,
driver or account, for every mouse
[OpenMouse](https://github.com/OpenMouse-Project)'s protocol library supports.

- **Status:** battery, charging, wireless signal and firmware, and the mouse's
  battery and profile in Exo's top bar.
- **Settings:** DPI, polling rate, lift-off, motion sync, buttons, lighting,
  sleep and more, showing only what your mouse has.
- **Sensor angle:** swipe side to side with your own grip and it measures the
  angle your swipes run at, then sets the mouse's own sensor angle to flatten
  them and checks that they come out level.
- **CPU core:** measures whether the mouse's input waits on a busy CPU and,
  through Exo, gives it a quiet one of its own.
- **Profiles:** each one linked to games and switched on by itself when one of
  them starts.
- **Wired or wireless:** on its cable or its receiver, the same mouse with the
  same profiles.

## Credits

Exo Mouse is built on [OpenMouse](https://github.com/OpenMouse-Project/openmouse),
made by [snekxs](https://github.com/snekxs) ♥ and its contributors, and is in
Exo with snekxs's permission. OpenMouse's protocol library does the talking to
every mouse; Exo Mouse is the room around it.

## License

Exo Mouse is a separate program from Exo Launcher. It is licensed under the
GNU Affero General Public License v3.0 or later (see `LICENSE`), because it is
built on [`@openmouse/protocol`](https://github.com/OpenMouse-Project/mouse-protocol),
which is. Exo Launcher itself is not covered by this license.

## How it fits

Exo Mouse runs in a frame inside Exo. It has no access to the system of its
own; it reaches devices only through a small message protocol with its host:

| Message | Meaning |
| --- | --- |
| `hid.list { vendorIds }` | Present HID devices: an opaque key, ids, product name, collections |
| `hid.open` / `hid.close { device }` | Open or close every collection of a device (shared, never exclusive); input reports flow while it is open |
| `hid.sendReport` / `hid.sendFeatureReport { device, reportId, data }` | Write a report (base64) |
| `hid.receiveFeatureReport` / `hid.receiveInputReport { device, reportId }` | Read a report (base64) |
| event `hid.input { device, reportId, data }` | An input report |
| event `hid.changed` | A device arrived or left |
| `exo.games` | Installed games (id, title and Exo's own cached cover thumbnail), to link a profile to games |
| `exo.profiles.read` / `exo.profiles.write { data }` | Exo Mouse's saved profiles, kept in Exo's data folder |
| `exo.mouseCore { action? }` | The CPU core panel: no action reads where the mouse's CPU stands; `measure` (10 s of the mouse moving), `apply` or `undo` asks the host to act. The host does the reading and the change |
| one-way `{ notice }` / `{ state }` / `{ profile }` | A one-line notice for Exo to show; the mouse's name, battery and charging, and the name of the profile on it, for Exo's top bar |
| event `game.runState { id, isRunning }` | A game started or stopped |
| event `room.visible` | Whether the Devices room is on screen |
| `exo.textScale`, event `exo.textScale { scale }` | The host's text size, as a factor on every font size |
| `exo.motion`, event `exo.motion { motion }` | `reduce` or `full`: the host's reduce-motion setting, which stops every move here too |
| `exo.theme` (reply `{ data: theme, look }`), event `exo.theme { theme, look }` | `light`, `dark` or `void`: the host's Appearance, which Exo Mouse is drawn in; `look` is the host's glass for it as CSS values by the names in `src/host-look.ts` (page and words, a pane, a control, large glass, the hero), which replace `mouse.css`'s own |

`src/exo-hid.ts` turns that into the browser's WebHID interface, so the
protocol library's drivers run unchanged.

## Changes to OpenMouse

`scripts/patch-protocol.mjs` runs before every build and applies fixes to
`@openmouse/protocol` 0.58.0 until upstream ships them. It stops the build when
the library version changes, so a fixed release is noticed and its patch removed.

Audit of the move from 0.49.0 to 0.58.0 (2026-11-07): no Finalmouse file changed. `dist/drivers/finalmouse` and
`dist/finalmouse` are byte-identical in both; the shared files that changed (driver registry, vendor list, brand
type, index) changed their other makers' lines; no line that names Finalmouse changed, except that the brand type gained other makers too. All three patch targets applied unchanged to 0.58.0, and the
module builds and checks green on it.

## Build

```sh
npm ci
npm run build
```

Inside Exo Launcher's source tree it builds into Exo's web root
(`ExoLauncher/wwwroot/mouse`); on its own, into `dist/`. Exo Launcher's build
runs it with its own UI.
