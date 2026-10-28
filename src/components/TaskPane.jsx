// 文件夹窗口和搜索窗口共用的小组件。

export function Panel({ title, children }) {
  return (
    <section className="tp-panel">
      <h3 className="tp-head">{title}</h3>
      <div className="tp-body">{children}</div>
    </section>
  )
}

export function TaskLink({ icon, children, ...rest }) {
  return (
    <button className="tp-link" {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function DetailsHead({ sort, onSort, showLocation = false }) {
  const col = (key, label) => (
    <button className={sort === key ? 'sorted' : ''} onClick={() => onSort(key)} title={`Sort by ${label.toLowerCase()}`}>
      {label}
      {sort === key && ' ▴'}
    </button>
  )
  return (
    <div className="row-head">
      {col('name', 'Name')}
      {showLocation && <span>In Folder</span>}
      {col('type', 'Type')}
      {col('date', 'Date')}
    </div>
  )
}
