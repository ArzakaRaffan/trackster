/** @type {import('tailwindcss').Config} */
// Trackster design tokens. Values are literal (not var()) so Tailwind's core utilities
// — text-*, bg-*, rounded-*, shadow-*, p-*, gap-* — resolve without any plugin.
// Keep this file in sync with design_system/tokens/*.css.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#121212',
        surface: { DEFAULT: '#181818', interactive: '#1f1f1f', alt: '#252525', overlay: '#272727', light: '#eeeeee' },
        brand: { DEFAULT: '#1ed760', border: '#1db954', press: '#1aa34a' },
        ink: { DEFAULT: '#ffffff', bright: '#fdfdfd', secondary: '#cbcbcb', muted: '#b3b3b3', subtle: '#7c7c7c' },
        line: { subtle: 'rgba(255,255,255,0.10)', DEFAULT: '#4d4d4d', strong: '#7c7c7c' },
        status: {
          under: '#1ed760', 'under-bg': 'rgba(30,215,96,0.12)',
          near: '#ffa42b', 'near-bg': 'rgba(255,164,43,0.12)',
          over: '#f3727f', 'over-bg': 'rgba(243,114,127,0.12)',
          info: '#539df5', 'info-bg': 'rgba(83,157,245,0.12)',
        },
        source: {
          bca: '#539df5', 'bca-bg': 'rgba(83,157,245,0.14)',
          jago: '#ffa42b', 'jago-bg': 'rgba(255,164,43,0.14)',
        },
        track: 'rgba(255,255,255,0.10)',
      },
      fontFamily: {
        // Replace Figtree with SpotifyMixUI / CircularSp when licensed binaries are available.
        sans: ['Figtree', 'SpotifyMixUI', 'CircularSp-Arab', 'CircularSp-Hebr', 'Helvetica Neue', 'helvetica', 'arial', 'Hiragino Sans', 'Meiryo', 'sans-serif'],
        title: ['Figtree', 'SpotifyMixUITitle', 'CircularSp-Arab', 'Helvetica Neue', 'helvetica', 'arial', 'sans-serif'],
      },
      fontSize: {
        micro: ['10px', { lineHeight: 'normal' }],
        badge: ['10.5px', { lineHeight: '1.33' }],
        small: ['12px', { lineHeight: '1.5' }],
        label: ['14px', { lineHeight: 'normal', letterSpacing: '0.14px' }],
        body: ['16px', { lineHeight: 'normal' }],
        heading: ['18px', { lineHeight: '1.3' }],
        title: ['24px', { lineHeight: '1' }],
        amount: ['40px', { lineHeight: '1', letterSpacing: '-1px' }],
        'amount-hero': ['56px', { lineHeight: '1', letterSpacing: '-1.5px' }],
      },
      letterSpacing: { button: '0.14px', caps: '1.4px', 'caps-wide': '2px', amount: '-1.5px' },
      spacing: { px: '1px', 0.5: '2px', 0.75: '3px', 1: '4px', 1.25: '5px', 1.5: '6px', 2: '8px', 2.5: '10px', 3: '12px', 3.5: '14px', 3.75: '15px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', navbar: '64px' },
      borderRadius: { minimal: '2px', subtle: '4px', standard: '6px', comfortable: '8px', medium: '10px', panel: '20px', large: '100px', pill: '500px', 'full-pill': '9999px' },
      boxShadow: {
        medium: 'rgba(0,0,0,0.3) 0px 8px 8px',
        heavy: 'rgba(0,0,0,0.5) 0px 8px 24px',
        field: 'rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset',
        'field-focus': 'rgb(18,18,18) 0px 1px 0px, #1ed760 0px 0px 0px 1px inset',
        'field-error': 'rgb(18,18,18) 0px 1px 0px, #f3727f 0px 0px 0px 1px inset',
        hairline: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
      },
      transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },
      transitionTimingFunction: { standard: 'cubic-bezier(.3,0,.4,1)', expressive: 'cubic-bezier(.16,1,.3,1)' },
      maxWidth: { content: '720px' },
      screens: { xs: '425px', sm: '576px', md: '768px', 'md-lg': '896px', lg: '1024px', xl: '1280px' },
    },
  },
  plugins: [],
};
