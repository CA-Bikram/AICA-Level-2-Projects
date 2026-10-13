import React from 'react';

interface GarvLogoProps {
  className?: string;
  height?: number | string;
}

/**
 * Official GARV-&-Associates logo banner recreation
 * Features the official CA INDIA emblem (with tricolor accent),
 * "GARV-&-Associates" in serif bold, vibrant green separator bar,
 * and "CHARTERED ACCOUNTANTS" in uppercase tracking.
 */
export const GarvLogo: React.FC<GarvLogoProps> = ({ className = 'h-12' }) => {
  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded shadow-sm select-none ${className}`}
      style={{
        backgroundColor: '#064051',
        padding: '6px 14px 6px 8px',
        color: '#ffffff',
      }}
    >
      {/* Official CA INDIA Emblem in white rounded badge */}
      <div
        className="bg-white rounded p-1 mr-3 flex flex-col items-center justify-center shadow-xs flex-shrink-0"
        style={{ width: 44, height: 40 }}
      >
        <svg viewBox="0 0 100 85" className="w-full h-full">
          {/* C */}
          <path
            d="M 38 18 C 28 14 14 22 14 36 C 14 50 28 58 38 54 C 43 52 44 46 40 46 C 36 46 34 49 30 50 C 22 52 20 43 20 36 C 20 29 22 20 30 22 C 34 23 36 26 40 26 C 44 26 43 20 38 18 Z"
            fill="#003366"
          />
          {/* A */}
          <path
            d="M 48 56 L 58 16 L 68 56 L 62 56 L 60 46 L 54 46 L 52 56 Z M 56 40 L 58 29 L 60 40 Z"
            fill="#003366"
          />
          {/* Saffron Swoosh / Ribbon */}
          <path
            d="M 42 38 L 52 48 L 84 14 L 87 17 L 52 53 L 39 40 Z"
            fill="#f97316"
          />
          {/* Green Swoosh / Ribbon */}
          <path
            d="M 45 42 L 54 51 L 86 17 L 89 20 L 54 56 L 42 44 Z"
            fill="#16a34a"
          />
          {/* INDIA Text below emblem */}
          <text
            x="50"
            y="76"
            fill="#003366"
            fontSize="18"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="3"
          >
            INDIA
          </text>
        </svg>
      </div>

      {/* Firm Typography */}
      <div className="flex flex-col justify-center pr-3">
        {/* Main Brand Title: GARV-&-Associates */}
        <div
          className="font-serif font-black text-[16px] sm:text-[18px] text-white leading-none tracking-tight"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.02em' }}
        >
          GARV-&amp;-Associates
        </div>

        {/* Lime Green Accent Divider Bar */}
        <div
          className="w-full h-[2px] my-1"
          style={{ backgroundColor: '#78ba3b' }}
        ></div>

        {/* Subtitle: CHARTERED ACCOUNTANTS */}
        <div
          className="font-sans font-bold text-[9.5px] sm:text-[10.5px] text-white uppercase tracking-[0.22em] leading-none"
          style={{ letterSpacing: '0.22em' }}
        >
          CHARTERED ACCOUNTANTS
        </div>
      </div>
    </div>
  );
};

/**
 * Returns a high-res data URL (PNG) of the official GARV-&-Associates logo
 * for seamless embedding into jsPDF and Word document generation.
 */
export function getGarvLogoDataUrl(): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // High DPI (2x) for crispness in PDF and Docx
  canvas.width = 680;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Solid Dark Teal (#064051)
  ctx.fillStyle = '#064051';
  ctx.fillRect(0, 0, 680, 140);

  // White box for CA INDIA emblem
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(16, 12, 116, 116, 10);
  } else {
    ctx.rect(16, 12, 116, 116);
  }
  ctx.fill();

  // CA letters inside white badge
  ctx.fillStyle = '#003366';
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('CA', 26, 78);

  // Saffron Swoosh
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 64);
  ctx.lineTo(76, 80);
  ctx.lineTo(118, 32);
  ctx.stroke();

  // Green Swoosh
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(63, 71);
  ctx.lineTo(78, 86);
  ctx.lineTo(120, 39);
  ctx.stroke();

  // "INDIA" text underneath CA inside badge
  ctx.fillStyle = '#003366';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INDIA', 74, 114);
  ctx.textAlign = 'left'; // Reset alignment

  // Text: GARV-&-Associates (Serif Bold)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px "Georgia", "Times New Roman", serif';
  ctx.fillText('GARV-&-Associates', 152, 60);

  // Green divider line
  ctx.fillStyle = '#78ba3b';
  ctx.fillRect(152, 75, 495, 4);

  // Text: CHARTERED ACCOUNTANTS (Spaced Uppercase)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = '5px';
  }
  ctx.fillText('CHARTERED ACCOUNTANTS', 154, 110);

  return canvas.toDataURL('image/png');
}
