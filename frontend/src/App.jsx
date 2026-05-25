import { useState, lazy, Suspense } from 'react'
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

export default function App() {
  const [screen, setScreen] = useState('inicio')
  const [user,   setUser]   = useState(USERS[0].id)

  const Screen = SCREENS[screen] || Inicio

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onScreen={setScreen} user={user} onUser={setUser} />

      <main className="main-content">
        <Topbar screen={screen} user={user} onUser={setUser} />
        <div className="main-body">
          <Suspense fallback={<div style={{ padding: '40px', color: 'var(--text-3)' }}>Cargando…</div>}>
            <Screen user={user} />
          </Suspense>
        </div>
      </main>

      <MobileNav screen={screen} onScreen={setScreen} />
    </div>
  )
}
