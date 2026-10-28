import { useDesk } from '../lib/context.js'
import { formatDate, locationName, viewerSiblings } from '../lib/items.js'
import { ArrowIcon } from './icons.jsx'

export default function PictureViewer({ win }) {
  const { items, byId, api } = useDesk()
  const item = byId[win.target]
  if (!item) return null
  const siblings = viewerSiblings(items, item)
  const index = siblings.findIndex(s => s.id === item.id)
  const many = siblings.length > 1

  return (
    <div className="viewer">
      <div className="viewer-stage">
        <img key={item.id} src={item.src} alt={item.name} draggable={false} />
      </div>
      <div className="viewer-caption">
        <b>{item.name}</b> · {formatDate(item.date)} · in {locationName(byId, item.parent)}
        {item.credit && (
          <>
            {' '}· Photo:{' '}
            {item.source ? (
              <a href={item.source} target="_blank" rel="noreferrer">
                {item.credit}
              </a>
            ) : (
              item.credit
            )}
          </>
        )}
      </div>
      <div className="viewer-bar">
        <button className="round-btn" disabled={!many} title="Previous picture (←)" onClick={() => api.stepViewer(win.id, -1)}>
          <ArrowIcon dir="left" />
        </button>
        <span className="viewer-count">
          {index + 1} of {siblings.length}
        </span>
        <button className="round-btn" disabled={!many} title="Next picture (→)" onClick={() => api.stepViewer(win.id, 1)}>
          <ArrowIcon />
        </button>
        <span className="bar-sep" />
        <button className="xp-btn" onClick={() => api.setWallpaper(item.src)}>
          Set as Background
        </button>
        <button className="xp-btn" onClick={() => api.openContaining(item)}>
          Open Folder
        </button>
        <button className="xp-btn" disabled={item.parent === 'trash'} onClick={() => api.deleteFromViewer(win.id)}>
          Delete
        </button>
      </div>
    </div>
  )
}
