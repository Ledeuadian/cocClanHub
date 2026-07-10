/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-dependent colors use CSS variables that swap with .dark class
        clan: {
          bg: 'var(--clan-bg)',
          surface: 'var(--clan-surface)',
          card: 'var(--clan-card)',
          border: 'var(--clan-border)',
          accent: '#f59e0b',      // gold (same in both themes)
          gold: '#fbbf24',
          'gold-dark': '#d97706',
          primary: '#3b82f6',     // blue (same in both themes)
          danger: '#ef4444',
          success: '#10b981',
          elixir: '#a855f7',      // purple (same in both themes)
          dark: 'var(--clan-dark)',
          darker: 'var(--clan-darker)',
          text: 'var(--clan-text)',
          muted: 'var(--clan-muted)'
        }
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out': 'fadeOut 0.2s ease-in forwards'
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideInRight: {
          '0%': { transform: 'translateX(110%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeOut: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(110%)', opacity: '0' }
        }
      }
    }
  },
  plugins: []
}