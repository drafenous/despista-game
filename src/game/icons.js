export function uiPowerSvg(type,color){
    const stroke = '#ffffffcc';
    const glow = color || '#d9e4f2';

    const wrap = (inner) => `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="grad-${type}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${glow}"/>
            <stop offset="100%" stop-color="${glow}cc"/>
          </linearGradient>
        </defs>
        ${inner.replaceAll('__FILL__', `url(#grad-${type})`).replaceAll('__STROKE__', stroke)}
      </svg>`;

    const svgs = {
      escape: wrap(`
        <path d="M12 2.8 L6.4 12 h3.7 L8.9 21.2 17.6 10.7 h-3.8 L17 2.8 Z"
          fill="__FILL__" stroke="__STROKE__" stroke-width="1.1" stroke-linejoin="round"/>
      `),
      soap: wrap(`
        <rect x="4.2" y="6.2" width="15.6" height="11.6" rx="4.3"
          fill="__FILL__" stroke="__STROKE__" stroke-width="1.1"/>
        <circle cx="8.2" cy="8.1" r="1.1" fill="#ffffffc8"/>
        <circle cx="11.2" cy="6.6" r="0.8" fill="#ffffffb8"/>
        <circle cx="14.6" cy="8.3" r="0.9" fill="#ffffffb8"/>
      `),
      skates: wrap(`
        <path d="M5 13.4 h10.2 c1.8 0 2.7.8 3.4 2.6 l.7 1.8 H5.6c-1.2 0-1.6-.7-1.6-1.8z"
          fill="__FILL__" stroke="__STROKE__" stroke-width="1.1" stroke-linejoin="round"/>
        <circle cx="8.2" cy="19.1" r="1.45" fill="#0b1020" stroke="__STROKE__" stroke-width=".9"/>
        <circle cx="12.2" cy="19.1" r="1.45" fill="#0b1020" stroke="__STROKE__" stroke-width=".9"/>
        <circle cx="16.2" cy="19.1" r="1.45" fill="#0b1020" stroke="__STROKE__" stroke-width=".9"/>
        <path d="M7.1 11.4 l2-3.7 h5.1" fill="none" stroke="__STROKE__" stroke-width="1.3" stroke-linecap="round"/>
      `),
      staff: wrap(`
        <path d="M12 3.2 v16.1" stroke="__STROKE__" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M8.6 6.1 q3.4-3.2 6.8 0 q-3.4 3.2-6.8 0Z" fill="__FILL__" stroke="__STROKE__" stroke-width="1"/>
        <path d="M5.3 15.6 c2.8-2.4 4.4-3.1 6.7-3.1 s3.9.7 6.7 3.1" fill="none" stroke="__STROKE__" stroke-width="1.2" stroke-linecap="round"/>
      `),
      invis: wrap(`
        <path d="M3.2 12s3.3-5.3 8.8-5.3 8.8 5.3 8.8 5.3-3.3 5.3-8.8 5.3-8.8-5.3-8.8-5.3Z"
          fill="none" stroke="__STROKE__" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2.9" fill="__FILL__" stroke="__STROKE__" stroke-width="1"/>
        <path d="M5 19 L19 5" stroke="__STROKE__" stroke-width="1.4" stroke-linecap="round"/>
      `),
      teleport: wrap(`
        <circle cx="12" cy="12" r="7.1" fill="none" stroke="__STROKE__" stroke-width="1.3" stroke-dasharray="2 2"/>
        <path d="M11.8 4.7 l1.6 4 4.1 1.5 -4.1 1.5 -1.6 4 -1.6-4 -4.1-1.5 4.1-1.5Z"
          fill="__FILL__" stroke="__STROKE__" stroke-width="1" stroke-linejoin="round"/>
      `),
      shield: wrap(`
        <path d="M12 3.2 18.7 5.6 v5.8c0 4.2-2.9 7.3-6.7 9.4-3.8-2.1-6.7-5.2-6.7-9.4V5.6Z"
          fill="__FILL__" stroke="__STROKE__" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M12 7.2 v7.1" stroke="__STROKE__" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M8.8 10.3 h6.4" stroke="__STROKE__" stroke-width="1.2" stroke-linecap="round"/>
      `),
      time: wrap(`
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="__STROKE__" stroke-width="1.35"/>
        <path d="M12 12 V7.6" stroke="__STROKE__" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 12 l3.5 2.1" stroke="__STROKE__" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M8.7 2.9 h6.6" stroke="__STROKE__" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M9.3 20.2 h5.4" stroke="__STROKE__" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>
      `)
    };

    return svgs[type] || `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="${glow}"/></svg>`;
  }

