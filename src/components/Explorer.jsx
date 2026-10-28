import { useState } from 'react'
import { useDesk } from '../lib/context.js'
import { TYPE_LABEL, compareBy, formatDate, groupItems, isTrashed, parentOf, pathOf } from '../lib/items.js'
import { ArrangeIcon, BinIcon, DesktopIcon, FolderIcon, NoteIcon, PictureIcon, UpIcon, ViewsIcon } from './icons.jsx'
import ItemTile from './ItemTile.jsx'
import { DetailsHead, Panel, TaskLink } from './TaskPane.jsx'

const noun = item => (item.type === 'folder' ? 'folder' : 'file')

export default function Explorer({ win }) {
  const { items, byId, selection, drag, trashCount, api } = useDesk()
  const folderId = win.target
  const isTrash = folderId === 'trash'
  const [view, setView] = useState('thumbs')
  const [sort, setSort] = useState('name')
  const [group, setGroup] = useState('none')

  // 当前文件夹的内容 → 排序 → 分组。每次渲染时现算，不单独存。
  const contents = items.filter(it => it.parent === folderId)
  const list = [...contents].sort(compareBy(sort))
  const groups = groupItems(list, group)
  const selected = selection.scope === folderId ? selection.ids.map(id => byId[id]).filter(Boolean) : []
  const selectedIds = selected.map(it => it.id)
  const dropId = isTrash ? 'trash' : folderId === 'desktop' ? 'desktop:list' : folderId
  const dropHover = Boolean(drag && drag.over === dropId && drag.valid)
  const up = parentOf(byId, folderId)
  const path = pathOf(byId, folderId)

  const placeName = p => (p === 'desktop' ? 'Desktop' : p === 'trash' ? 'Recycle Bin' : byId[p]?.name)
  const placeIcon = p =>
    p === 'desktop' ? <DesktopIcon size={16} /> : p === 'trash' ? <BinIcon size={16} full={trashCount > 0} /> : <FolderIcon size={16} />
  const folders = items.filter(it => it.type === 'folder' && !isTrashed(byId, it.id)).sort(compareBy('name'))
  const places = [...new Set(['desktop', up, ...folders.slice(0, 6).map(f => f.id)])]
    .filter(p => p && p !== folderId && p !== 'trash')
    .concat(isTrash ? [] : ['trash'])

  const viewEntries = [
    { label: 'Thumbnails', checked: view === 'thumbs', onClick: () => setView('thumbs') },
    { label: 'Details', checked: view === 'details', onClick: () => setView('details') },
  ]
  const arrangeEntries = [
    { label: 'Name', checked: sort === 'name', onClick: () => setSort('name') },
    { label: 'Type', checked: sort === 'type', onClick: () => setSort('type') },
    { label: 'Date', checked: sort === 'date', onClick: () => setSort('date') },
    '-',
    { label: 'Group by Year', checked: group === 'date', onClick: () => setGroup(g => (g === 'date' ? 'none' : 'date')) },
    { label: 'Group by Type', checked: group === 'type', onClick: () => setGroup(g => (g === 'type' ? 'none' : 'type')) },
  ]
  const menuBelow = (e, entries) => {
    const r = e.currentTarget.getBoundingClientRect()
    api.openMenu(r.left, r.bottom, entries)
  }
  const backgroundMenu = e => {
    if (e.target.closest('[data-item]')) return
    e.preventDefault()
    api.openMenu(e.clientX, e.clientY, [
      { label: 'View', submenu: viewEntries },
      { label: 'Arrange Icons By', submenu: arrangeEntries },
      '-',
      ...(isTrash
        ? [{ label: 'Empty Recycle Bin', disabled: !contents.length, onClick: api.emptyTrash }]
        : [
            {
              label: 'New',
              submenu: [
                { label: 'Folder', onClick: () => api.createItem('folder', folderId) },
                { label: 'Text Document', onClick: () => api.createItem('note', folderId) },
              ],
            },
            { label: 'Add Pictures…', onClick: () => api.pickFiles(folderId) },
          ]),
    ])
  }

  return (
    <>
      <div className="toolbar">
        <button className="tool" disabled={!up} onClick={() => api.navigate(win.id, up)} title="Up one level">
          <UpIcon />
        </button>
        <span className="tool-sep" />
        <button className="tool" onClick={e => menuBelow(e, viewEntries)}>
          <ViewsIcon /> Views ▾
        </button>
        <button className="tool" onClick={e => menuBelow(e, arrangeEntries)}>
          <ArrangeIcon /> Arrange ▾
        </button>
      </div>

      <div className="addressbar">
        <span className="addr-label">Address</span>
        <div className="addr-field">
          {placeIcon(folderId)}
          <span>{path.join('\\')}</span>
        </div>
      </div>

      <div className="explorer-main">
        <aside className="taskpane">
          <Panel title={isTrash ? 'Recycle Bin Tasks' : 'File and Folder Tasks'}>
            {isTrash ? (
              <>
                <TaskLink icon={<BinIcon size={16} />} disabled={!contents.length} onClick={api.emptyTrash}>
                  Empty the Recycle Bin
                </TaskLink>
                <TaskLink
                  icon={<FolderIcon size={16} />}
                  disabled={!contents.length}
                  onClick={() => api.restoreItems(selectedIds.length ? selectedIds : contents.map(it => it.id))}
                >
                  {selectedIds.length ? `Restore ${selectedIds.length} selected` : 'Restore all items'}
                </TaskLink>
              </>
            ) : (
              <>
                <TaskLink icon={<FolderIcon size={16} />} onClick={() => api.createItem('folder', folderId)}>
                  Make a new folder
                </TaskLink>
                <TaskLink icon={<NoteIcon size={16} />} onClick={() => api.createItem('note', folderId)}>
                  Write a new note
                </TaskLink>
                <TaskLink icon={<PictureIcon size={16} />} onClick={() => api.pickFiles(folderId)}>
                  Add pictures here
                </TaskLink>
                {selected.length === 1 && selected[0].type !== 'bin' && (
                  <TaskLink onClick={() => api.startRename(selected[0].id)}>Rename this {noun(selected[0])}</TaskLink>
                )}
                {selected.length > 0 && (
                  <TaskLink onClick={() => api.trashItems(selectedIds)}>
                    Delete {selected.length > 1 ? `${selected.length} items` : `this ${noun(selected[0])}`}
                  </TaskLink>
                )}
              </>
            )}
          </Panel>
          <Panel title="Other Places">
            {places.map(p => (
              <TaskLink key={p} icon={placeIcon(p)} onClick={() => api.navigate(win.id, p)}>
                {placeName(p)}
              </TaskLink>
            ))}
          </Panel>
          <Panel title="Details">
            <Details selected={selected} count={contents.length} />
          </Panel>
        </aside>

        <div
          className={`ex-content view-${view} ${dropHover ? 'drop-hover' : ''}`}
          data-drop={dropId}
          onPointerDown={e => !e.target.closest('[data-item]') && api.select(folderId, [])}
          onContextMenu={backgroundMenu}
          onDragOver={isTrash ? undefined : api.fileDragOver}
          onDrop={isTrash ? undefined : e => api.dropFiles(e, folderId)}
        >
          {view === 'details' && list.length > 0 && <DetailsHead sort={sort} onSort={setSort} />}
          {groups.map(g => (
            <section key={g.label || 'all'} className="ex-group">
              {g.label && <h4 className="group-head">{g.label}</h4>}
              <div className="ex-grid">
                {g.items.map(it => (
                  <ItemTile key={it.id} item={it} scope={folderId} variant={view === 'details' ? 'row' : 'tile'} />
                ))}
              </div>
            </section>
          ))}
          {!list.length && (
            <p className="empty">
              {isTrash ? 'The Recycle Bin is empty.' : 'This folder is empty. Drag files here to put them in it.'}
            </p>
          )}
        </div>
      </div>

      <footer className="statusbar">
        <span>
          {list.length} object{list.length === 1 ? '' : 's'}
        </span>
        {selected.length > 0 && <span>{selected.length} selected</span>}
        <span className="status-hint">
          {isTrash ? 'Drag items out to restore them' : 'Drag files in or out of this window'}
        </span>
      </footer>
    </>
  )
}

function Details({ selected, count }) {
  if (selected.length > 1) return <p className="tp-text">{selected.length} items selected.</p>
  if (!selected.length) {
    return (
      <p className="tp-text">
        {count} item{count === 1 ? '' : 's'} here. Click a file to see its details.
      </p>
    )
  }
  const it = selected[0]
  const text = it.text || ''
  return (
    <div className="tp-details">
      {it.type === 'image' && <img className="tp-preview" src={it.thumb || it.src} alt="" draggable={false} />}
      <b>{it.name}</b>
      <span>{TYPE_LABEL[it.type]}</span>
      {it.date && <span>Date: {formatDate(it.date)}</span>}
      {it.credit && (
        <span>
          Photo:{' '}
          {it.source ? (
            <a href={it.source} target="_blank" rel="noreferrer">
              {it.credit}
            </a>
          ) : (
            it.credit
          )}
        </span>
      )}
      {it.type === 'note' && text && <span className="tp-snippet">“{text.length > 90 ? `${text.slice(0, 90)}…` : text}”</span>}
    </div>
  )
}
