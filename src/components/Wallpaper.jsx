// 默认壁纸：用 SVG 画的蓝天、模糊的云和两道绿色山坡。
export default function Wallpaper({ src }) {
  if (src) return <div className="wallpaper wallpaper-photo" style={{ backgroundImage: `url("${src}")` }} />
  return (
    <svg className="wallpaper" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1756c4" />
          <stop offset=".45" stopColor="#4a90e6" />
          <stop offset=".72" stopColor="#a6cff5" />
          <stop offset="1" stopColor="#e4f2fe" />
        </linearGradient>
        <linearGradient id="wp-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc743" />
          <stop offset=".3" stopColor="#4f9e24" />
          <stop offset="1" stopColor="#25600d" />
        </linearGradient>
        <linearGradient id="wp-hill-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c9f3a" />
          <stop offset="1" stopColor="#2f6d1a" />
        </linearGradient>
        <filter id="wp-cloud" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <rect width="1600" height="1000" fill="url(#wp-sky)" />
      <g filter="url(#wp-cloud)" fill="#fff">
        <ellipse cx="330" cy="250" rx="220" ry="48" opacity=".85" />
        <ellipse cx="470" cy="215" rx="130" ry="40" opacity=".7" />
        <ellipse cx="1080" cy="170" rx="260" ry="55" opacity=".8" />
        <ellipse cx="1290" cy="330" rx="170" ry="38" opacity=".65" />
        <ellipse cx="760" cy="390" rx="200" ry="30" opacity=".5" />
      </g>
      <path d="M0 690C260 600 520 590 820 640S1350 620 1600 560V1000H0z" fill="url(#wp-hill-back)" />
      <path d="M0 780C240 650 560 560 900 600S1420 760 1600 720V1000H0z" fill="url(#wp-hill)" />
      <path d="M0 780C240 650 560 560 900 600" stroke="#a7e06a" strokeWidth="5" fill="none" opacity=".35" />
    </svg>
  )
}
