import { useState, useEffect, lazy, Suspense } from 'react'
import { Sidebar }   from './components/layout/Sidebar'
import { Topbar }    from './components/layout/Topbar'
import { MobileNav } from './components/layout/MobileNav'
import { Inicio }    from './screens/Inicio'
import { Registro }  from './screens/Registro'
import { Vision }    from './screens/Vision'
import { Plan }      from './screens/Plan'
const Insights = lazy(() => import('./screens/Insights').then(m => ({ default: m.Insights })))
import { Mas }       from './screens/Mas'
import { USERS }     from './lib/constants'
import './styles/globals.css'

const SCREENS = { inicio: Inicio, registro: Registro, vision: Vision, plan: Plan, insights: Insights, mas: Mas }

function userFromPath() {
  const slug = window.location.pathname.replace(/^\//, '').toLowerCase()
  return USERS.find((u) => u.slug === slug)?.id ?? USERS[0].id
}

export default function App() {
  const [screen, setScreen] = useState('inicio')
  const [user,   setUser]   = useState(userFromPath)
  const [masTab, setMasTab] = useState('retos')

  useEffect(() => {
    const u = USERS.find((u) => u.id === user)
    if (u) history.replaceState(null, '', `/${u.slug}`)
  }, [user])

  function switchUser(id) {
    document.documentElement.classList.add('no-transitions')
    setUser(id)
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.documentElement.classList.remove('no-transitions')
      )
    )
  }

  function navigate(s, tab) {
    setScreen(s)
    if (s === 'mas') setMasTab(tab || 'retos')
  }

  const Screen = SCREENS[screen] || Inicio

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onScreen={navigate} user={user} onUser={switchUser} />

      <main className="main-content">
        <Topbar screen={screen} user={user} onUser={switchUser} />
        <div className="main-body">
          <Suspense fallback={<div style={{ padding: '40px', color: 'var(--text-3)' }}>Cargando…</div>}>
            {screen === 'mas'
              ? <Mas key={masTab} user={user} onScreen={navigate} defaultTab={masTab} />
              : <Screen user={user} onScreen={navigate} />
            }
          </Suspense>
        </div>
      </main>

      <MobileNav screen={screen} onScreen={navigate} />
    </div>
  )
}
