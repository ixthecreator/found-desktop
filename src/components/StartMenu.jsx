import { useDesk } from '../lib/context.js'
import { compareBy, isTrashed } from '../lib/items.js'
import { BinIcon, DesktopIcon, FolderIcon, NoteIcon, PictureIcon, PowerIcon, ResetIcon, SearchIcon } from './icons.jsx'

function BigItem({ icon, title, sub, onClick }) {
  return (
    <li>
      <button className="sm-item big" onClick={onClick}>
        {icon}
        <span>
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </span>
      </button>
    </li>
  )
}

function SmallItem({ icon, label, onClick }) {
  return (
    <li>
      <button className="sm-item" onClick={onClick}>
        {icon}
        <span>{label}</span>
      </button>
    </li>
  )
}

export default function StartMenu({ owner }) {
  const { items, byId, trashCount, api } = useDesk()
  const folders = items.filter(it => it.type === 'folder' && !isTrashed(byId, it.id)).sort(compareBy('name'))
  const readme = byId.readme && !isTrashed(byId, 'readme') ? byId.readme : null
  const run = fn => () => {
    api.closeStart()
    fn()
  }

  return (
    <div className="start-menu" role="menu">
      <header className="sm-head">
        <img className="sm-avatar" src="https://picsum.photos/id/1062/96/96" alt="" draggable={false} />
        <span>{owner}</span>
      </header>
      <div className="sm-body">
        <ul className="sm-left">
          {readme && (
            <BigItem icon={<NoteIcon size={32} />} title={readme.name} sub="Start here" onClick={run(() => api.open('readme'))} />
          )}
          <BigItem icon={<SearchIcon size={32} />} title="Search" sub="Find files by name, year or type" onClick={run(api.openSearch)} />
          <li className="sm-sep" />
          <BigItem icon={<NoteIcon size={32} />} title="New Note" sub="Write something down" onClick={run(() => api.createItem('note', 'desktop', null, true))} />
          <BigItem icon={<PictureIcon size={32} />} title="Add Pictures…" sub="Leave something behind" onClick={run(() => api.pickFiles('desktop'))} />
          <BigItem icon={<FolderIcon size={32} />} title="New Folder" sub="Make a place to sort into" onClick={run(() => api.createItem('folder', 'desktop'))} />
        </ul>
        <ul className="sm-right">
          <SmallItem icon={<DesktopIcon size={22} />} label="Desktop" onClick={run(() => api.openFolder('desktop'))} />
          {folders.map(f => (
            <SmallItem key={f.id} icon={<FolderIcon size={22} />} label={f.name} onClick={run(() => api.open(f.id))} />
          ))}
          <li className="sm-sep" />
          <SmallItem icon={<BinIcon size={22} full={trashCount > 0} />} label="Recycle Bin" onClick={run(() => api.openFolder('trash'))} />
          <SmallItem icon={<FolderIcon size={22} />} label="Arrange as Timeline" onClick={run(() => api.arrangeDesktop('date'))} />
        </ul>
      </div>
      <footer className="sm-foot">
        <button onClick={run(api.resetDesktop)}>
          <ResetIcon /> Reset Desktop
        </button>
        <button onClick={run(api.powerOff)}>
          <PowerIcon /> Turn Off
        </button>
      </footer>
    </div>
  )
}
