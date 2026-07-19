import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import MobileNav from './MobileNav.jsx'
import Topbar from './Topbar.jsx'
import InstallBanner from '../InstallBanner.jsx'
import GsapScrollScene from '../GsapScrollScene.jsx'
import { MobileNavProvider, useMobileNav } from '../../context/MobileNavContext.jsx'

export default function AppLayout() {
  return (
    <MobileNavProvider>
      <LayoutInner />
    </MobileNavProvider>
  )
}

/**
 * Pages where the mobile nav is hidden (chat-style pages that need
 * every pixel of vertical space and have their own back navigation).
 */
const HIDE_NAV_ON = ['/chat']

/**
 * Inner layout — has access to the MobileNav context.
 * Forces the mobile nav hidden on /chat (and any future full-screen page).
 * The nav is otherwise always visible (no collapse, no swipe).
 */
function LayoutInner() {
  const { setForced } = useMobileNav()
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    const shouldHide = HIDE_NAV_ON.some(p => path === p || path.startsWith(p + '/'))
    setForced(shouldHide ? 'hidden' : 'shown')
  }, [location.pathname, setForced])

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar />
        {/* min-h-0 here is critical: without it the GSAP wrapper's flex-1
            child keeps its content-based min-height and the Chat input form
            overflows below the viewport. */}
        <GsapScrollScene>
          <Outlet />
        </GsapScrollScene>
        <MobileNav />
      </div>
      <InstallBanner />
    </div>
  )
}
