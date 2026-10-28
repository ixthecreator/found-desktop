import { useEffect, useState } from 'react'
import { useDesk } from '../lib/context.js'
import { InfoIcon, StartOrb } from './icons.jsx'

export default function Taskbar({ windows, titles, activeId, startOpen }) {
  const { api } = useDesk()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <footer className="taskbar">
      <button className={`start-button ${startOpen ? 'pressed' : ''}`} onClick={api.toggleStart} title="Click here to begin">
        <StartOrb />
        <span>start</span>
      </button>
      <div className="task-buttons">
        {windows.map(w => {
          const t = titles[w.id]
          if (!t) return null
          return (
            <button
              key={w.id}
              className={`task ${w.id === activeId && !w.min ? 'active' : ''}`}
              title={t.title}
              onClick={() => api.taskClick(w.id)}
            >
              {t.icon}
              <span>{t.title}</span>
            </button>
          )
        })}
      </div>
      <div className="tray">
        <button className="tray-icon" title="Show tips" onClick={api.showTip}>
          <InfoIcon />
        </button>
        <span className="clock">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
      </div>
    </footer>
  )
}
