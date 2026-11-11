// 文件夹窗口、搜索窗口共用的小组件

// 任务面板里的一块；蓝色标题加内容
export function Panel({ title, children }) {
  return (
    <section className="tp-panel">
      <h3 className="tp-head">{title}</h3>
      <div className="tp-body">{children}</div>
    </section>
  )
}

// 任务面板里可以点的一行；图标加文字，长得像链接
export function TaskLink({ icon, children, onClick, disabled }) {
  return (
    <button className="tp-link" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

// 详细列表的表头；点列名就按那一列排；搜索窗口多一列“在哪个文件夹”；
// 每列的class跟ItemTile里每行的格子对上，宽度在样式里统一定
export function DetailsHead({ sort, onSort, showLocation = false }) {
  const col = (key, label) => (
    <button
      className={'col-' + key + (sort === key ? ' sorted' : '')}
      onClick={() => onSort(key)}
      title={'Sort by ' + label.toLowerCase()}
    >
      {label}
      {sort === key && ' ▴'}
    </button>
  )
  return (
    <div className="row-head">
      {col('name', 'Name')}
      {showLocation && <span className="col-where">In Folder</span>}
      {col('type', 'Type')}
      {col('date', 'Date')}
    </div>
  )
}
