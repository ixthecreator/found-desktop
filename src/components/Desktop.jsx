import { useDesk } from '../lib/context.js'
import { clampPos } from '../lib/layout.js'
import ItemTile from './ItemTile.jsx'
import Wallpaper from './Wallpaper.jsx'

export default function Desktop({ deskRef }) {
  const { items, settings, desk, band, arrangeLabels, api } = useDesk()
  const onDesktop = items.filter(it => it.parent === 'desktop')

  return (
    <div
      className="desktop"
      ref={deskRef}
      data-drop="desktop"
      onPointerDown={e => e.target === e.currentTarget && api.desktopPointerDown(e)}
      onContextMenu={e => {
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        api.desktopContextMenu(e)
      }}
      onDragOver={api.fileDragOver}
      onDrop={e => api.dropFiles(e, 'desktop')}
    >
      <Wallpaper src={settings.wallpaper} />
      {onDesktop.map(it => {
        const p = clampPos(it, desk)
        return <ItemTile key={it.id} item={it} scope="desktop" variant="desktop" style={{ left: p.x, top: p.y }} />
      })}
      {arrangeLabels.map(l => (
        <span key={l.label} className="arrange-label" style={{ left: l.x }}>
          {l.label}
        </span>
      ))}
      {band && <div className="band" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
    </div>
  )
}
