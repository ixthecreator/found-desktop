import { useDesk } from '../lib/context.js'

export default function WindowFrame({ win, active, title, icon, children, minSize = [300, 200] }) {
  const { api, desk } = useDesk()
  const rect = win.max ? { x: 0, y: 0, w: desk.w, h: desk.h } : win

  // 拖标题栏移动窗口，拖右下角调整大小。用 setPointerCapture，鼠标移出窗口也能继续拖。
  const startDrag = (e, mode) => {
    if (e.button !== 0 || e.target.closest('button')) return
    if (mode === 'move' && win.max) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const sx = e.clientX
    const sy = e.clientY
    const start = { x: win.x, y: win.y, w: win.w, h: win.h }
    const onMove = ev => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (mode === 'move') {
        api.patchWindow(win.id, {
          x: Math.min(Math.max(start.x + dx, 100 - start.w), desk.w - 100),
          y: Math.min(Math.max(start.y + dy, 0), desk.h - 30),
        })
      } else {
        api.patchWindow(win.id, { w: Math.max(minSize[0], start.w + dx), h: Math.max(minSize[1], start.h + dy) })
      }
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const className = ['window', active ? 'active' : 'inactive', win.max && 'max', rect.w < 540 && 'narrow']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={className}
      data-drop="none"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: win.z,
        display: win.min ? 'none' : undefined,
      }}
      onPointerDownCapture={() => api.focusWindow(win.id)}
      aria-label={title}
    >
      <header
        className="titlebar"
        onPointerDown={e => startDrag(e, 'move')}
        onDoubleClick={e => !e.target.closest('button') && api.toggleMax(win.id)}
      >
        <span className="title-icon">{icon}</span>
        <span className="title-text">{title}</span>
        <div className="title-buttons">
          <button className="tb-min" aria-label="Minimize" title="Minimize" onClick={() => api.minimizeWindow(win.id)} />
          <button
            className={win.max ? 'tb-restore' : 'tb-max'}
            aria-label={win.max ? 'Restore' : 'Maximize'}
            title={win.max ? 'Restore' : 'Maximize'}
            onClick={() => api.toggleMax(win.id)}
          />
          <button className="tb-close" aria-label="Close" title="Close" onClick={() => api.closeWindow(win.id)} />
        </div>
      </header>
      <div className="window-body">{children}</div>
      {!win.max && <div className="resize-grip" title="Drag to resize" onPointerDown={e => startDrag(e, 'resize')} />}
    </section>
  )
}
