import { useDesk } from '../lib/context.js'

// 把v限制在lo到hi之间
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))

// 通用的窗口外框；标题栏，最小化、最大化、关闭按钮，右下角拉伸的手柄；里面放什么由children决定
export default function WindowFrame({ win, active, title, icon, children, minSize = [300, 200] }) {
  const { api, desk } = useDesk()
  // 窗口至少露出100px宽，标题栏整条露出来；保证总能拖回来；
  // 浏览器缩小以后也按这个规则显示；只管显示，不改存的位置
  const keepVisible = (x, y, w) => ({ x: clamp(x, 100 - w, desk.w - 100), y: clamp(y, 0, desk.h - 30) })
  const rect = win.max ? { x: 0, y: 0, w: desk.w, h: desk.h } : { ...win, ...keepVisible(win.x, win.y, win.w) }

  // 拖标题栏挪窗口，拖右下角改大小；监听挂在window上，鼠标甩出窗口也能接着拖；
  // 最大化的时候不能挪；点在按钮上不算拖
  const startDrag = (e, mode) => {
    if (e.button !== 0 || e.target.closest('button')) return
    if (mode === 'move' && win.max) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const start = { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
    const onMove = ev => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (mode === 'move') {
        api.patchWindow(win.id, keepVisible(start.x + dx, start.y + dy, start.w))
      } else {
        api.patchWindow(win.id, { w: Math.max(minSize[0], start.w + dx), h: Math.max(minSize[1], start.h + dy) })
      }
    }
    // 松手就把监听拿掉
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 窄窗口加narrow；样式里会把左边的任务面板藏掉
  const className = ['window', active ? 'active' : 'inactive', win.max && 'max', rect.w < 540 && 'narrow']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={className}
      data-drop="none" // 窗口边框、标题栏上不接东西；挡住后面的桌面
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: win.z,
        display: win.min ? 'none' : undefined,
      }}
      // 点窗口哪里都先激活它
      onPointerDown={() => api.focusWindow(win.id)}
    >
      <header
        className="titlebar"
        onPointerDown={e => startDrag(e, 'move')}
        onDoubleClick={e => !e.target.closest('button') && api.toggleMax(win.id)}
      >
        <span className="title-icon">{icon}</span>
        <span className="title-text">{title}</span>
        <div className="title-buttons">
          <button className="tb-min" title="Minimize" onClick={() => api.minimizeWindow(win.id)} />
          <button
            className={win.max ? 'tb-restore' : 'tb-max'}
            title={win.max ? 'Restore' : 'Maximize'}
            onClick={() => api.toggleMax(win.id)}
          />
          <button className="tb-close" title="Close" onClick={() => api.closeWindow(win.id)} />
        </div>
      </header>
      <div className="window-body">{children}</div>
      {!win.max && <div className="resize-grip" title="Drag to resize" onPointerDown={e => startDrag(e, 'resize')} />}
    </section>
  )
}
