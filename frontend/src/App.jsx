import { useState } from 'react'
import { Sidebar }   from './components/layout/Sidebar'
import { Topbar }    from './components/layout/Topbar'
import { MobileNav } from './components/layout/MobileNav'
import { Inicio }    from './screens/Inicio'
import { Registro }  from './screens/Registro'
import { Vision }    from './screens/Vision'
import { Plan }      from './screens/Plan'
import { Mas }       from './screens/Mas'
import { USERS }     from './lib/constants'
import './styles/globals.css'

const SCREENS = { inicio: Inicio, registro: Registro, vision: Vision, plan: Plan, mas: Mas }

export default function App() {
  const [screen, setScreen] = useState('inicio')
  const [user,   setUser]   = useState(USERS[0].id)

  const Screen = SCREENS[screen] || Inicio

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onScreen={setScreen} user={user} onUser={setUser} />

      <main className="main-content">
        <Topbar screen={screen} user={user} onUser={setUser} />
        <Screen user={user} />
      </main>

      <MobileNav screen={screen} onScreen={setScreen} />
    </div>
  )
}
