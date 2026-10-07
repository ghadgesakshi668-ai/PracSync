/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: { 950: '#08141F', 900: '#0C1D2E', 800: '#12293F', 700: '#1B3A57', 600: '#2A4F70' },
        canvas: '#F2F4F7',
        brand: {
          50: '#EBF7F9', 100: '#CFEBF0', 200: '#A2D8E1', 400: '#3FA6B8',
          500: '#188EA3', 600: '#0F7488', 700: '#0B5D6E', 800: '#0A4A58',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,29,46,0.05), 0 1px 3px rgba(15,29,46,0.06)',
        pop: '0 12px 32px rgba(8,20,31,0.22)',
      },
    },
  },
  plugins: [],
}
