/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Defining the custom brand colors used in your JSX
        brand: {
          blue: "#3B82F6", // Standard bright blue
          dark: "#1E40AF", // Deeper blue for hover states/gradients
        },
      },
      fontFamily: {
        // Ensuring the "font-sans" utility uses a clean modern stack
        sans: [
          'Inter', 
          'ui-sans-serif', 
          'system-ui', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          '"Segoe UI"', 
          'Roboto', 
          'sans-serif'
        ],
      },
      animation: {
        // Custom gradient animation for the "built for scale" text
        'gradient': 'gradient 8s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
      backgroundImage: {
        // Useful for the dynamic background ornaments
        'radial-gradient': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}