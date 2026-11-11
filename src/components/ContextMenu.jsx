import { useEffect, useRef, useState } from 'react'

// 右键菜单；每一项是{ label, onClick, checked, bold, disabled, submenu }，'-'是分隔线
export default function ContextMenu({ menu, onClose }) {
  if (!menu) return null
  return <MenuList entries={menu.entries} x={menu.x} y={menu.y} onClose={onClose} />
}

// 一层菜单；子菜单也是它，套着用
function MenuList({ entries, x, y, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y })
  const [sub, setSub] = useState(null) // 当前展开的子菜单是第几项，在哪弹

  // 量一下菜单多大；超出屏幕右边、下边就往回挪
  useEffect(() => {
    const r = ref.current.getBoundingClientRect()
    setPos({
      x: x + r.width > window.innerWidth ? Math.max(0, window.innerWidth - r.width - 2) : x,
      y: y + r.height > window.innerHeight ? Math.max(0, window.innerHeight - r.height - 2) : y,
    })
  }, [x, y])

  return (
    <div className="ctx-menu" ref={ref} style={{ left: pos.x, top: pos.y }}>
      {entries.map((entry, i) => {
        if (entry === '-') return <div key={i} className="ctx-sep" />
        const open = sub !== null && sub.index === i
        const className = ['ctx-item', entry.bold && 'bold', entry.disabled && 'disabled', open && 'open']
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={i}
            className={className}
            // 鼠标移上去就展开子菜单，移到别的项就收起
            onMouseEnter={e => {
              if (!entry.submenu) {
                setSub(null)
                return
              }
              const r = e.currentTarget.getBoundingClientRect()
              setSub({ index: i, x: r.right - 3, y: r.top - 3 })
            }}
            // 点了先关菜单再执行；灰掉的、有子菜单的点了没反应
            onClick={e => {
              if (entry.disabled || entry.submenu) return
              e.stopPropagation()
              onClose()
              if (entry.onClick) entry.onClick()
            }}
          >
            <span className="ctx-check">{entry.checked ? '✓' : ''}</span>
            <span className="ctx-label">{entry.label}</span>
            {entry.submenu && <span className="ctx-arrow">▶</span>}
            {open && <MenuList entries={entry.submenu} x={sub.x} y={sub.y} onClose={onClose} />}
          </div>
        )
      })}
    </div>
  )
}
