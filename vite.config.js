import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function bundleFfmpegCore() {
  return {
    name: 'bundle-ffmpeg-core',
    buildStart() {
      const source = resolve('node_modules/@ffmpeg/core/dist/umd');
      const destination = resolve('public/ffmpeg');
      mkdirSync(destination, { recursive: true });
      cpSync(resolve(source, 'ffmpeg-core.js'), resolve(destination, 'ffmpeg-core.js'));
      cpSync(resolve(source, 'ffmpeg-core.wasm'), resolve(destination, 'ffmpeg-core.wasm'));
    }
  };
}

export default defineConfig({
  plugins: [react(), bundleFfmpegCore()],
  build: {
    target: 'es2020'
  }
});
