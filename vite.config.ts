import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({

  plugins: [
    react(),
    typescript({
      tsconfig: './tsconfig.json', // Point to your tsconfig.json
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["node_modules"],
    }),
    tsconfigPaths(),
    crx({ manifest }),

  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }

})