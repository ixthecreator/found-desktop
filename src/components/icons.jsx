// 手绘的 2000 年代风格图标，全部是 SVG。除特别说明外 viewBox 都是 48x48。

function Svg({ size, children, viewBox = '0 0 48 48' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function FolderIcon({ size = 48, open = false }) {
  return (
    <Svg size={size}>
      <defs>
        <linearGradient id="folder-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffeaa8" />
          <stop offset="1" stopColor="#efbc45" />
        </linearGradient>
      </defs>
      <path d="M4 11.5Q4 9 6.5 9h11l3.5 3.5h20.5Q44 12.5 44 15v24.5Q44 42 41.5 42h-35Q4 42 4 39.5z" fill="#dca43a" stroke="#b8862a" />
      <rect x="8" y="15" width="31" height="20" fill="#fff" stroke="#cfcfcf" />
      {open ? (
        <path d="M10 22h36l-5.5 18Q40 42 38 42H6.5Q4 42 4.6 39.6z" fill="url(#folder-front)" stroke="#c18f2c" />
      ) : (
        <path d="M4 19.5Q4 18 5.5 18h37Q44 18 44 19.5v20Q44 42 41.5 42h-35Q4 42 4 39.5z" fill="url(#folder-front)" stroke="#c18f2c" />
      )}
    </Svg>
  )
}

export function NoteIcon({ size = 48 }) {
  return (
    <Svg size={size}>
      <path d="M9 6h22l8 8v29H9z" fill="#fff" stroke="#8193b2" />
      <path d="M31 6v8h8" fill="#e3e9f4" stroke="#8193b2" />
      <path d="M13 19h22M13 23.5h22M13 28h22M13 32.5h22M13 37h14" stroke="#a9bbdc" strokeWidth="1.3" />
      <rect x="9" y="6" width="22" height="4.5" fill="#4a86d8" />
    </Svg>
  )
}

export function BinIcon({ size = 48, full = false }) {
  return (
    <Svg size={size}>
      <defs>
        <linearGradient id="bin-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b3cfd9" />
          <stop offset=".45" stopColor="#f3fafc" />
          <stop offset="1" stopColor="#8fb1be" />
        </linearGradient>
      </defs>
      <path d="M10 13h28l-3.2 28.5Q34.5 44 32 44H16q-2.5 0-2.8-2.5z" fill="url(#bin-body)" stroke="#5f7f8e" />
      <path d="M16 16l1.2 26M20.5 16l.5 26M24 16v26M27.5 16l-.5 26M32 16l-1.2 26" stroke="#7c9daa" strokeWidth=".9" opacity=".8" />
      {full && (
        <g stroke="#8e8e8e" strokeLinejoin="round">
          <path d="M13 13c-1.5-5 3-8.5 7.5-6 2-4.5 8.5-4 9.5.5 4.5-1 7 3.5 5 5.5z" fill="#fff" />
          <path d="M19 9.5l3 2.5M26 7.5l1 3.5M31 9l-2.5 2.5" fill="none" stroke="#b5b5b5" />
        </g>
      )}
      <ellipse cx="24" cy="13" rx="14.5" ry="3.6" fill={full ? 'none' : '#dcebf0'} stroke="#5f7f8e" />
    </Svg>
  )
}

export function DesktopIcon({ size = 16 }) {
  return (
    <Svg size={size}>
      <rect x="5" y="7" width="38" height="27" rx="2" fill="#dfe7f2" stroke="#4a5a72" strokeWidth="2" />
      <rect x="9" y="11" width="30" height="19" fill="#3a8be0" />
      <path d="M9 25q10-6 30-2v7H9z" fill="#5cae3a" />
      <path d="M19 34h10l2 6H17z" fill="#b8c2cf" stroke="#4a5a72" strokeWidth="2" />
    </Svg>
  )
}

export function PictureIcon({ size = 16 }) {
  return (
    <Svg size={size}>
      <rect x="5" y="9" width="38" height="30" rx="2" fill="#fff" stroke="#5d6f8c" strokeWidth="2" />
      <rect x="9" y="13" width="30" height="22" fill="#8cc4f5" />
      <path d="M9 35l9-11 7 7 5-5 9 9z" fill="#4f9a2e" />
      <circle cx="31" cy="19" r="3" fill="#ffd640" />
    </Svg>
  )
}

export function SearchIcon({ size = 16 }) {
  return (
    <Svg size={size}>
      <circle cx="20" cy="20" r="12" fill="#dcefff" stroke="#3b5c8f" strokeWidth="4" />
      <path d="M29 29l12 12" stroke="#7a4f22" strokeWidth="7" strokeLinecap="round" />
    </Svg>
  )
}

export function BackIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#3bb04a" stroke="#1f7a2b" strokeWidth="2" />
      <path d="M27 13L16 24l11 11M17 24h17" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function UpIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      <path d="M4 15q0-3 3-3h11l4 4h18q3 0 3 3v20q0 3-3 3H7q-3 0-3-3z" fill="#f2c14e" stroke="#c18f2c" strokeWidth="2" />
      <path d="M24 37V22m-7 6l7-7 7 7" stroke="#2a8a2e" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function ViewsIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      {[8, 26].map(x =>
        [8, 26].map(y => <rect key={`${x}${y}`} x={x} y={y} width="14" height="14" fill="#7fb0ea" stroke="#3c66a8" strokeWidth="2" />),
      )}
    </Svg>
  )
}

export function ArrangeIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      <path d="M8 12h20M8 24h14M8 36h8" stroke="#3c66a8" strokeWidth="4" strokeLinecap="round" />
      <path d="M37 8v30m-6-6l6 7 6-7" stroke="#2a8a2e" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function ArrowIcon({ size = 16, dir = 'right' }) {
  return (
    <Svg size={size}>
      <path
        d={dir === 'right' ? 'M18 10l14 14-14 14' : 'M30 10L16 24l14 14'}
        stroke="#21539e"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function InfoIcon({ size = 16 }) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#fff" stroke="#2a5db0" strokeWidth="3" />
      <circle cx="24" cy="14" r="3.5" fill="#2a5db0" />
      <path d="M24 21v15" stroke="#2a5db0" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  )
}

export function PowerIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="42" height="42" rx="8" fill="#e2492f" stroke="#fff" strokeWidth="2.5" />
      <path d="M17 15a13 13 0 1 0 14 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M24 10v14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </Svg>
  )
}

export function ResetIcon({ size = 22 }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="42" height="42" rx="8" fill="#e8a317" stroke="#fff" strokeWidth="2.5" />
      <path d="M33 17a11 11 0 1 0 2 9" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M35 9v9h-9" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

// 开始按钮上的小光球（故意不用任何操作系统的 logo）。
export function StartOrb({ size = 20 }) {
  return (
    <Svg size={size}>
      <defs>
        <radialGradient id="orb" cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f08a1c" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="19" fill="url(#orb)" stroke="#fff" strokeWidth="3" />
      <path d="M24 13v22M13 24h22" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".9" />
    </Svg>
  )
}
