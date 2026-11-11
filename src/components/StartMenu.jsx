import { useDesk } from '../lib/context.js'
import { compareBy, isTrashed } from '../lib/items.js'
import { BinIcon, DesktopIcon, FolderIcon, NoteIcon, PictureIcon, ResetIcon, SearchIcon } from './icons.jsx'

// 开始菜单左栏的大按钮；图标、标题，外加一行说明
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

// 右栏的小按钮；只有图标和名字
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

// 开始菜单；左栏是常用操作，右栏是桌面、各个文件夹、回收站，底下是重置；
// 点哪一项都先关菜单再执行，见run
export default function StartMenu({ owner }) {
  const { items, byId, trashCount, api } = useDesk()
  const folders = items.filter(it => it.type === 'folder' && !isTrashed(byId, it.id)).sort(compareBy('name'))
  // README被扔了就不显示“Start here”
  const readme = byId.readme && !isTrashed(byId, 'readme') ? byId.readme : null
  const run = fn => () => {
    api.closeStart()
    fn()
  }

  return (
    <div className="start-menu">
      <header className="sm-head">
        <img className="sm-avatar" src="https://picsum.photos/id/1062/96/96" draggable={false} />
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
      </footer>
    </div>
  )
}
