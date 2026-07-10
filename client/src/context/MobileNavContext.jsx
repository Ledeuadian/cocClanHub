/**
 * MobileNavContext
 *
 * Lets any component (e.g. chat input) temporarily hide the bottom
 * navigation bar so it doesn't block content like the chat input.
 *
 * The navbar has 3 states:
 * - 'auto'  : show the nav (default). If a child component calls
 *             requestHide(), the nav collapses. When focus is lost
 *             (e.g. user closes keyboard), it auto-restores.
 * - 'hidden' : force hide
 * - 'shown'  : force show (overrides any child request)
 *
 * A small floating button appears in the bottom-right when the nav
 * is hidden, so the user can always bring it back.
 */

import { createContext, useContext, useState, useCallback } from 'react'

const MobileNavContext = createContext({
  visible: true,
  show: () => {},
  hide: () => {},
  toggle: () => {},
  setForced: () => {}
})

export function MobileNavProvider({ children }) {
  // null = auto (default show), true/false = forced
  const [forced, setForced] = useState(null)
  const [visible, setVisible] = useState(true)

  const show = useCallback(() => setVisible(true), [])
  const hide = useCallback(() => setVisible(false), [])
  const toggle = useCallback(() => setVisible(v => !v), [])
  const setForcedFn = useCallback((state) => {
    setForced(state)
    setVisible(state === null ? true : state === 'shown' || state === true)
  }, [])

  return (
    <MobileNavContext.Provider
      value={{
        visible: forced === 'hidden' ? false : (forced === 'shown' ? true : visible),
        show,
        hide,
        toggle,
        setForced: setForcedFn
      }}
    >
      {children}
    </MobileNavContext.Provider>
  )
}

export const useMobileNav = () => useContext(MobileNavContext)
