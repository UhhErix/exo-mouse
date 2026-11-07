import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './mouse.css'
import { DRIVER_VENDOR_IDS, installExoHid } from './exo-hid'
import { App } from './App'
import { followHostLook } from './host-look'

// The drivers' vendors; the host lists nothing else, and the drivers' own support checks pick the mice.
installExoHid(DRIVER_VENDOR_IDS)
followHostLook()

const root = createRoot(document.getElementById('root')!)
// Development only (see dev-mock.tsx): a build replaces DEV with false and drops the mock.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
  void import('./dev-mock').then(({ MockApp }) => root.render(<StrictMode><MockApp /></StrictMode>))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
