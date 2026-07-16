# ClipRespuesta

Editor de vídeo privado para crear respuestas, críticas y reacciones. Funciona completamente en el navegador: los vídeos no se guardan en el servidor.

## Funciones

- Carga de vídeo original y vídeos del avatar.
- Cortes manuales con entrada y salida.
- Cortes automáticos de 1, 3, 5, 8, 10 segundos o duración personalizada.
- Análisis local orientativo de momentos con cambios visuales y energía sonora.
- Descarga individual de fragmentos.
- Línea de tiempo con reordenación.
- Exportación final a MP4 con FFmpeg WebAssembly.
- Indicador de porcentaje de contenido propio y ajeno.

## Desplegar en Vercel

1. Importa este repositorio desde Vercel.
2. Vercel detectará automáticamente Vite.
3. Pulsa **Deploy**. No hacen falta variables de entorno.

## Desarrollo local opcional

```bash
npm install
npm run dev
```

## Privacidad y derechos

El procesamiento se realiza en el dispositivo del usuario. Utiliza únicamente material propio, autorizado o fragmentos necesarios para crítica, comentario o análisis conforme a la normativa aplicable. La duración de un fragmento no garantiza por sí sola que su uso esté permitido ni que YouTube lo monetice.
