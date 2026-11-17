/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#060a0f',
        base: '#0b151b',
        raised: '#0f1d23',
        focus: '#142a2a',
        line: '#263e3e',
        'line-strong': '#3b6f66',
        mint: '#7df6d1',
        ice: '#aab7ff',
        amber: '#f0c66e',
        coral: '#ff8893',
        digital: '#7df6d1',
        bio: '#8fe3b0',
        energy: '#ffb86b',
        material: '#b9a3ff',
        ink: '#e9f6f3',
        muted: '#8ca19d',
        dim: '#748f89',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin-reverse 28s linear infinite',
        'float-panel': 'float-panel 8s ease-in-out infinite',
        'float-dust': 'float-dust 12s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
        'scan-beam': 'scan-beam 10s linear infinite',
        'flicker': 'flicker 7s linear infinite',
        'neural-flow': 'neural-flow 2.6s linear infinite',
        'lattice-orbit': 'spin 22s linear infinite',
        'lattice-orbit-reverse': 'spin-reverse 30s linear infinite',
      },
      keyframes: {
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'float-panel': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' },
        },
        'float-dust': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)', opacity: '0.2' },
          '50%': { transform: 'translate3d(10px, -18px, 0)', opacity: '0.75' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(0.94)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        'scan-beam': {
          '0%': { transform: 'translateY(-30%)', opacity: '0' },
          '10%': { opacity: '0.7' },
          '90%': { opacity: '0.35' },
          '100%': { transform: 'translateY(130%)', opacity: '0' },
        },
        'flicker': {
          '0%, 18%, 22%, 60%, 64%, 100%': { opacity: '1' },
          '20%, 62%': { opacity: '0.55' },
        },
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        '.perspective-none': { perspective: 'none' },
        '.perspective-500': { perspective: '500px' },
        '.perspective-1000': { perspective: '1000px' },
        '.perspective-1500': { perspective: '1500px' },
        '.perspective-2000': { perspective: '2000px' },
        '.transform-style-3d': { transformStyle: 'preserve-3d' },
        '.transform-style-flat': { transformStyle: 'flat' },
        '.backface-hidden': { backfaceVisibility: 'hidden' },
        '.backface-visible': { backfaceVisibility: 'visible' },
      })
    },
  ],
}
