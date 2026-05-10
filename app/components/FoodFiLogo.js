export default function FoodFiLogo({ size = 60, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={style}>
      {/* Background rounded square — orange gradient */}
      <rect width="60" height="60" rx="16"
        fill="url(#ff-grad)" />

      {/* ── Fork (left) ── */}
      {/* Tines */}
      <line x1="15" y1="11" x2="15" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="19" y1="11" x2="19" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="23" y1="11" x2="23" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* Fork arch */}
      <path d="M15 21 Q15 26 19 26 Q23 26 23 21"
        stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Fork stem */}
      <line x1="19" y1="26" x2="19" y2="50" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── Spoon (right) ── */}
      {/* Spoon bowl */}
      <ellipse cx="42" cy="17" rx="4" ry="6" stroke="white" strokeWidth="2"/>
      {/* Spoon stem */}
      <line x1="42" y1="23" x2="42" y2="50" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── Plate (center) ── */}
      <ellipse cx="30" cy="38" rx="8.5" ry="2" stroke="white" strokeWidth="1.5"
        fill="white" fillOpacity="0.12" strokeOpacity="0.7"/>
      <path d="M21.5 38 Q21.5 47 30 47 Q38.5 47 38.5 38"
        stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Steam */}
      <path d="M27 31 Q25.5 28.5 27 26 Q28.5 23.5 27 21"
        stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
      <path d="M30.5 31 Q29 28.5 30.5 26 Q32 23.5 30.5 21"
        stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.5"/>
      <path d="M34 31 Q32.5 28.5 34 26 Q35.5 23.5 34 21"
        stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>

      <defs>
        <linearGradient id="ff-grad" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff8c42"/>
          <stop offset="100%" stopColor="#d94f00"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
