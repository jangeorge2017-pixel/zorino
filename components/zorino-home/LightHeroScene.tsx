export function LightHeroDome() {
  return (
    <div className="zh-light-dome" aria-hidden="true">
      <svg viewBox="0 0 900 520" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision">
        <defs>
          <radialGradient id="zhLightDomeGlow" cx="50%" cy="92%" r="62%">
            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.55" />
            <stop offset="46%" stopColor="#93c5fd" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="zhLightDomeArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="22%" stopColor="#4f46e5" stopOpacity="0.14" />
            <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.24" />
            <stop offset="78%" stopColor="#38bdf8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <filter id="zhLightDomeBlur" x="-25%" y="-45%" width="150%" height="190%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <ellipse cx="450" cy="424" rx="356" ry="108" fill="url(#zhLightDomeGlow)" />
        <path
          d="M104 428A346 272 0 0 1 796 428"
          fill="none"
          stroke="url(#zhLightDomeArc)"
          strokeWidth="26"
          filter="url(#zhLightDomeBlur)"
        />
        <g
          fill="none"
          stroke="rgba(79, 70, 229, 0.14)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        >
          <path d="M104 428A346 272 0 0 1 796 428" />
          <path d="M158 428A292 228 0 0 1 742 428" opacity="0.76" />
          <path d="M218 428A232 180 0 0 1 682 428" opacity="0.54" />
          <ellipse cx="450" cy="428" rx="346" ry="92" opacity="0.72" />
          <ellipse cx="450" cy="428" rx="232" ry="62" opacity="0.48" />
          <path d="M450 156V428" opacity="0.5" />
          <path d="M330 196C368 266 368 350 330 428" opacity="0.44" />
          <path d="M570 196C532 266 532 350 570 428" opacity="0.44" />
          <path d="M232 260C308 312 308 374 232 428" opacity="0.32" />
          <path d="M668 260C592 312 592 374 668 428" opacity="0.32" />
        </g>
      </svg>
    </div>
  );
}

export function LightHeroZEmblem() {
  return (
    <div className="zh-light-z" aria-hidden="true">
      <svg viewBox="0 0 520 560" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id="zhLightZTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="34%" stopColor="#7dd3fc" />
            <stop offset="72%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="zhLightZFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="30%" stopColor="#60a5fa" />
            <stop offset="62%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="zhLightZSide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="48%" stopColor="#4338ca" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id="zhLightZBottom" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4338ca" />
            <stop offset="52%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id="zhLightZGlass" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
            <stop offset="44%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="zhLightZGlow" x="-35%" y="-25%" width="170%" height="160%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>
        <path
          d="M104 98H396L416 452H96L222 392H96L168 154H104Z"
          fill="#4f46e5"
          opacity="0.34"
          filter="url(#zhLightZGlow)"
        />
        <g stroke="rgba(15, 23, 42, 0.14)" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M104 98H396L370 154H168Z" fill="url(#zhLightZTop)" />
          <path d="M168 154H370L222 392H96Z" fill="url(#zhLightZFace)" />
          <path d="M222 392H416V452H96Z" fill="url(#zhLightZBottom)" />
          <path d="M396 98L416 392V452L370 154Z" fill="url(#zhLightZSide)" opacity="0.92" />
          <path d="M96 392L222 392L96 452Z" fill="url(#zhLightZSide)" opacity="0.76" />
          <path d="M104 98H396L370 154H168Z" fill="url(#zhLightZGlass)" stroke="none" />
          <path d="M168 154H370L222 392H96Z" fill="url(#zhLightZGlass)" stroke="none" opacity="0.46" />
        </g>
        <g fill="none" stroke="#ffffff" strokeLinecap="round">
          <path d="M118 110H381" strokeOpacity="0.82" strokeWidth="2.4" />
          <path d="M180 164H356L218 378" strokeOpacity="0.7" strokeWidth="2.2" />
          <path d="M112 402H399" strokeOpacity="0.66" strokeWidth="2.2" />
          <path d="M398 112L413 389" strokeOpacity="0.44" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
