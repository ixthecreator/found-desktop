import { useDesk } from '../lib/context.js'
import { clampPos } from '../lib/layout.js'
import ItemTile from './ItemTile.jsx'
import Wallpaper from './Wallpaper.jsx'

// 桌面；壁纸加上所有parent是'desktop'的图标，按各自的x/y绝对定位；
// 框选、空白处右键、接收从电脑拖进来的图片也归它管
export default function Desktop({ deskRef }) {
  const { items, settings, desk, band, arrangeLabels, api } = useDesk()
  const onDesktop = items.filter(it => it.parent === 'desktop')

  return (
    <div
      className="desktop"
      ref={deskRef}
      data-drop="desktop"
      // 只有点在空白处才算；点在图标上的由图标自己处理
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
        const p = clampPos(it, desk) // 屏幕变小了也别跑到外面去
        return <ItemTile key={it.id} item={it} scope="desktop" variant="desktop" style={{ left: p.x, top: p.y }} />
      })}
      {/* 时间线排列后顶上的年份，几秒后消失 */}
      {arrangeLabels.map(l => (
        <span key={l.label} className="arrange-label" style={{ left: l.x }}>
          {l.label}
        </span>
      ))}
      {/* 框选的虚线框 */}
      {band && <div className="band" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
    </div>
  )
}
