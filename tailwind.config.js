/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: {
      background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
      card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
      secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
      muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
      border: 'hsl(var(--border))', kinetic: 'hsl(var(--kinetic))', magenta: 'hsl(var(--magenta))', gold: 'hsl(var(--gold))'
    },
    fontFamily: { display: ['var(--font-display)'], body: ['var(--font-body)'] },
    borderRadius: { lg: 'var(--radius)' },
    keyframes: {
      'pulse-line': { '0%,100%': { opacity: '.35', transform: 'scaleX(.4)' }, '50%': { opacity: '1', transform: 'scaleX(1)' } },
      progress: { from: { width: '0%' }, to: { width: '100%' } },
      rings: { '0%,100%': { opacity: '.25', transform: 'rotateX(64deg) scale(.96)' }, '50%': { opacity: '.5', transform: 'rotateX(64deg) scale(1.04)' } }
    },
    animation: { 'pulse-line': 'pulse-line 1.9s ease-in-out infinite', progress: 'progress 1.4s ease forwards', rings: 'rings 9s ease-in-out infinite' }
  }},
  plugins: []
}
