import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function bundleFfmpegCore() {
  return {
    name: 'bundle-ffmpeg-core',
    buildStart() {
      // @ffmpeg/ffmpeg crea un Worker de tipo módulo. Por eso debemos
      // publicar el núcleo ESM: el núcleo UMD no expone `default` y Safari
      // termina mostrando "failed to import ffmpeg-core.js".
      const source = resolve('node_modules/@ffmpeg/core/dist/esm');
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
