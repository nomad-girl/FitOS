import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0EA5E9',
          light: '#F0F9FF',
          dark: '#0369A1',
        },
        accent: '#06B6D4',
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },
        bg: '#FAFBFD',
        card: '#FFFFFF',
      },
      borderRadius: {
        DEFAULT: '16px',
        sm: '10px',
        xs: '6px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        DEFAULT: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        md: '0 4px 12px rgba(0,0,0,.07), 0 1px 3px rgba(0,0,0,.04)',
        lg: '0 10px 30px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
}

export default config
