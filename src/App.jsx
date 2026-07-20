import { useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, Check, ChevronRight,
  Download, Film, GripVertical, LoaderCircle, Pause, Play, Plus,
  Scissors, Sparkles, Trash2, Upload, UserRound, WandSparkles, X
} from 'lucide-react';
import { fileExtension, formatTime, safeName, uid } from './utils';

const CUT_OPTIONS = [1, 3, 5, 8, 10];
const ffmpeg = new FFmpeg();

function App() {
  const videoRef = useRef(null);
  const [source, setSource] = useState(null);
  const [avatars, setAvatars] = useState([]);
  const [clips, setClips] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markIn, setMarkIn] = useState(0);
  const [markOut, setMarkOut] = useState(0);
  const [cutSize, setCutSize] = useState(3);
  const [customSize, setCustomSize] = useState(6);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [impactMoments, setImpactMoments] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    ffmpeg.on('progress', ({ progress: value }) => setProgress(Math.max(0, Math.min(100, Math.round(value * 100)))));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const sourceRef = useRef(null);
  const avatarsRef = useRef([]);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { avatarsRef.current = avatars; }, [avatars]);
  useEffect(() => () => {
    if (sourceRef.current?.url) URL.revokeObjectURL(sourceRef.current.url);
    avatarsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  const filesById = useMemo(() => {
    const map = new Map();
    if (source) map.set(source.id, source);
    avatars.forEach((item) => map.set(item.id, item));
    return map;
  }, [source, avatars]);

  const timelineStats = useMemo(() => {
    const original = timeline.filter((item) => item.kind === 'original').reduce((sum, item) => sum + item.duration, 0);
    const own = timeline.filter((item) => item.kind === 'avatar').reduce((sum, item) => sum + item.duration, 0);
    const total = original + own;
    return { original, own, total, originalPercent: total ? Math.round((original / total) * 100) : 0 };
  }, [timeline]);

  function onSourceSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (source?.url) URL.revokeObjectURL(source.url);
    const item = { id: uid(), file, url: URL.createObjectURL(file), name: file.name, kind: 'original' };
    setSource(item);
    setClips([]);
    setTimeline((items) => items.filter((entry) => entry.kind !== 'original'));
    setImpactMoments([]);
    setDuration(0);
    setMarkIn(0);
    setMarkOut(0);
    setToast('Vídeo original cargado. No se ha enviado a ningún servidor.');
  }

  function onMetadata() {
    const value = videoRef.current?.duration || 0;
    setDuration(value);
    setMarkOut(Math.min(value, cutSize));
  }

  function onAvatarSelected(event) {
    const selected = Array.from(event.target.files || []);
    const additions = selected.map((file) => ({
      id: uid(), file, url: URL.createObjectURL(file), name: file.name,
      duration: 0, kind: 'avatar'
    }));
    setAvatars((items) => [...items, ...additions]);
    event.target.value = '';
  }

  function updateAvatarDuration(id, value) {
    setAvatars((items) => items.map((item) => item.id === id ? { ...item, duration: value } : item));
  }

  function setPoint(type) {
    const time = videoRef.current?.currentTime || 0;
    if (type === 'in') {
      setMarkIn(Math.min(time, markOut - 0.1));
    } else {
      setMarkOut(Math.max(time, markIn + 0.1));
    }
  }

  function addManualClip() {
    if (!source || markOut <= markIn) return;
    const clip = makeClip(markIn, markOut, `Corte manual ${clips.length + 1}`);
    setClips((items) => [...items, clip]);
    setToast('Corte añadido a la biblioteca.');
  }

  function makeClip(start, end, label, impact = null) {
    return {
      id: uid(), fileId: source.id, kind: 'original', start,
      end: Math.min(end, duration), duration: Math.min(end, duration) - start,
      label, impact
    };
  }

  function generateAutomaticCuts() {
    if (!source || !duration) return;
    const size = cutSize === 'custom' ? Number(customSize) : Number(cutSize);
    if (!size || size < 0.5) return setToast('La duración mínima es de 0,5 segundos.');
    const total = Math.ceil(duration / size);
    if (total > 500) return setToast('Se generarían más de 500 cortes. Elige una duración mayor.');
    const generated = [];
    for (let start = 0, index = 1; start < duration; start += size, index += 1) {
      generated.push(makeClip(start, Math.min(start + size, duration), `Corte automático ${index}`));
    }
    setClips(generated);
    setToast(`${generated.length} cortes creados. Elige solamente los que necesites.`);
  }

  function addClipToTimeline(clip) {
    setTimeline((items) => [...items, { ...clip, timelineId: uid() }]);
  }

  function createAutomaticTimeline() {
    if (!clips.length) return setToast('Primero crea los cortes del vídeo.');
    const automaticTimeline = [...clips]
      .sort((a, b) => a.start - b.start)
      .map((clip) => ({ ...clip, timelineId: uid() }));
    setTimeline(automaticTimeline);
    setToast(`Montaje automático creado con ${automaticTimeline.length} fragmentos.`);
  }

  function addAvatarToTimeline(avatar) {
    if (!avatar.duration) return setToast('Espera a que termine de cargarse el vídeo del avatar.');
    setTimeline((items) => [...items, {
      timelineId: uid(), id: avatar.id, fileId: avatar.id, kind: 'avatar',
      start: 0, end: avatar.duration, duration: avatar.duration,
      label: avatar.name
    }]);
  }

  function moveTimeline(index, direction) {
    setTimeline((items) => {
      const next = [...items];
      const target = index + direction;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function seekTo(time) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    videoRef.current.play();
  }

  async function ensureFfmpeg() {
    if (ffmpegReady) return;
    setStatus('Preparando el motor de vídeo por primera vez…');
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')
    });
    setFfmpegReady(true);
  }

  async function writeInput(fileItem, suffix = '') {
    const name = `input-${fileItem.id}${suffix}.${fileExtension(fileItem.file)}`;
    try { await ffmpeg.deleteFile(name); } catch { /* todavía no existe */ }
    await ffmpeg.writeFile(name, await fetchFile(fileItem.file));
    return name;
  }

  function downloadBytes(data, name, type = 'video/mp4') {
    const blob = new Blob([data.buffer], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function downloadClip(clip) {
    const fileItem = filesById.get(clip.fileId);
    if (!fileItem) return;
    setWorking(true); setProgress(0);
    try {
      await ensureFfmpeg();
      setStatus('Creando el fragmento seleccionado…');
      const input = await writeInput(fileItem);
      const output = `clip-${clip.id}.mp4`;
      await ffmpeg.exec([
        '-ss', String(clip.start), '-i', input, '-t', String(clip.duration),
        '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'ultrafast',
        '-crf', '22', '-c:a', 'aac', '-movflags', '+faststart', output
      ]);
      const data = await ffmpeg.readFile(output);
      downloadBytes(data, `${safeName(source?.name)}-${formatTime(clip.start).replaceAll(':', '-')}.mp4`);
      await ffmpeg.deleteFile(output);
      setToast('Fragmento descargado.');
    } catch (error) {
      console.error(error);
      setToast('No se pudo crear el fragmento. Prueba con un MP4 H.264.');
    } finally { setWorking(false); setStatus(''); setProgress(0); }
  }

  async function exportTimeline() {
    if (!timeline.length) return setToast('Añade al menos un elemento a la línea de tiempo.');
    setWorking(true); setProgress(0);
    try {
      await ensureFfmpeg();
      setStatus('Preparando los archivos para el montaje…');
      const inputNames = new Map();
      for (const item of timeline) {
        if (!inputNames.has(item.fileId)) {
          const fileItem = filesById.get(item.fileId);
          inputNames.set(item.fileId, await writeInput(fileItem));
        }
      }

      const segmentNames = [];
      for (let index = 0; index < timeline.length; index += 1) {
        const item = timeline[index];
        const segment = `segment-${index}.mp4`;
        segmentNames.push(segment);
        setStatus(`Procesando bloque ${index + 1} de ${timeline.length}…`);
        await ffmpeg.exec([
          '-ss', String(item.start), '-i', inputNames.get(item.fileId), '-t', String(item.duration),
          '-map', '0:v:0', '-map', '0:a?',
          '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', segment
        ]);
      }

      setStatus('Uniendo todos los bloques…');
      const list = segmentNames.map((name) => `file '${name}'`).join('\n');
      await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(list));
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-movflags', '+faststart', 'video-respuesta.mp4']);
      const data = await ffmpeg.readFile('video-respuesta.mp4');
      downloadBytes(data, `video-respuesta-${Date.now()}.mp4`);
      setToast('Montaje terminado y descargado.');
    } catch (error) {
      console.error(error);
      setToast('La exportación no pudo terminar. Reduce la duración o utiliza vídeos MP4 H.264.');
    } finally { setWorking(false); setStatus(''); setProgress(0); }
  }

  async function analyzeImpact() {
    if (!source || !videoRef.current || !duration) return;
    setAnalyzing(true); setStatus('Analizando cambios visuales del vídeo…');
    const video = videoRef.current;
    const wasPaused = video.paused;
    video.pause();
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 90;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const interval = Math.max(1, duration / 100);
    const samples = [];
    let previous = null;

    try {
      for (let time = 0; time < duration; time += interval) {
        await seekVideo(video, time);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const signature = [];
        for (let i = 0; i < pixels.length; i += 160) {
          signature.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
        }
        let difference = 0;
        if (previous) {
          for (let i = 0; i < signature.length; i += 1) difference += Math.abs(signature[i] - previous[i]);
          difference /= signature.length;
        }
        samples.push({ time, difference });
        previous = signature;
        setProgress(Math.round((time / duration) * 100));
      }
      const ranked = [...samples].sort((a, b) => b.difference - a.difference).slice(0, 8);
      const max = Math.max(...ranked.map((item) => item.difference), 1);
      const moments = ranked
        .map((item) => ({
          id: uid(), start: Math.max(0, item.time - 1),
          end: Math.min(duration, item.time + 4),
          score: Math.max(40, Math.round((item.difference / max) * 100)),
          reason: item.difference > max * 0.7 ? 'Cambio visual fuerte' : 'Cambio de plano o movimiento'
        }))
        .sort((a, b) => a.start - b.start);
      setImpactMoments(moments);
      setToast('Análisis terminado. Estos resultados son orientativos.');
    } catch (error) {
      console.error(error);
      setToast('No se pudo analizar este formato de vídeo.');
    } finally {
      video.currentTime = currentTime;
      if (!wasPaused) video.play();
      setAnalyzing(false); setStatus(''); setProgress(0);
    }
  }

  function addImpactClip(moment) {
    const clip = makeClip(moment.start, moment.end, `Momento de impacto ${moment.score}/100`, moment.score);
    setClips((items) => [...items, clip]);
    setToast('Momento añadido a la biblioteca.');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon"><Scissors size={22} /></span><div><strong>ClipRespuesta</strong><small>Editor privado de críticas y reacciones</small></div></div>
        <div className="privacy-pill"><Check size={15} /> Procesamiento local</div>
      </header>

      <main>
        <section className="hero">
          <div><span className="eyebrow"><WandSparkles size={15} /> CREA CONTENIDO TRANSFORMATIVO</span><h1>Convierte un vídeo en una respuesta realmente tuya</h1><p>Corta solamente los momentos necesarios, añade tu avatar, ordena el análisis y exporta el montaje final sin enviar tus archivos a un servidor.</p></div>
          <div className="step-strip"><span className={source ? 'done' : 'active'}>1. Vídeo</span><ChevronRight/><span className={clips.length ? 'done' : source ? 'active' : ''}>2. Cortes</span><ChevronRight/><span className={timeline.length ? 'done' : clips.length ? 'active' : ''}>3. Montaje</span><ChevronRight/><span className={timeline.length ? 'active' : ''}>4. Exportar</span></div>
        </section>

        {!source ? (
          <label className="upload-hero">
            <input type="file" accept="video/*" onChange={onSourceSelected} />
            <span className="upload-circle"><Upload size={34}/></span>
            <h2>Sube el vídeo que quieres analizar</h2>
            <p>MP4, MOV o WebM · Recomendado: 1080p o inferior</p>
            <span className="primary-button">Seleccionar vídeo</span>
            <small>El archivo permanece en tu dispositivo</small>
          </label>
        ) : (
          <div className="workspace-grid">
            <section className="card player-card">
              <div className="card-title"><div><span className="number">1</span><div><h2>Vídeo original</h2><p>{source.name}</p></div></div><label className="text-button"><Upload size={16}/> Cambiar<input type="file" accept="video/*" onChange={onSourceSelected}/></label></div>
              <video ref={videoRef} src={source.url} controls onLoadedMetadata={onMetadata} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
              <div className="time-readout"><span>Posición: <strong>{formatTime(currentTime)}</strong></span><span>Duración: <strong>{formatTime(duration)}</strong></span></div>
              <div className="manual-cut">
                <div className="manual-head"><h3><Scissors size={17}/> Corte manual</h3><span>{formatTime(markOut - markIn)}</span></div>
                <div className="mark-grid">
                  <label>Entrada<input type="number" step="0.1" min="0" max={duration} value={markIn} onChange={(e) => setMarkIn(Number(e.target.value))}/><button onClick={() => setPoint('in')}>Usar posición actual</button></label>
                  <label>Salida<input type="number" step="0.1" min="0" max={duration} value={markOut} onChange={(e) => setMarkOut(Number(e.target.value))}/><button onClick={() => setPoint('out')}>Usar posición actual</button></label>
                </div>
                <button className="secondary-button full" onClick={addManualClip}><Plus size={17}/> Añadir corte a la biblioteca</button>
              </div>
            </section>

            <aside className="side-column">
              <section className="card">
                <div className="card-title compact"><div><span className="number">2</span><div><h2>Cortes automáticos</h2><p>Divide el vídeo en fragmentos iguales</p></div></div></div>
                <div className="cut-options">{CUT_OPTIONS.map((value) => <button key={value} className={cutSize === value ? 'selected' : ''} onClick={() => setCutSize(value)}>{value}s</button>)}<button className={cutSize === 'custom' ? 'selected' : ''} onClick={() => setCutSize('custom')}>Otro</button></div>
                {cutSize === 'custom' && <label className="custom-input">Duración personalizada<input type="number" min="0.5" step="0.5" value={customSize} onChange={(e) => setCustomSize(e.target.value)}/></label>}
                <button className="primary-button full" onClick={generateAutomaticCuts}><Sparkles size={17}/> Generar cortes</button>
              </section>

              <section className="card impact-card">
                <div className="card-title compact"><div><span className="number purple"><BarChart3 size={16}/></span><div><h2>Momentos con impacto</h2><p>Detecta cambios visuales destacados</p></div></div></div>
                <button className="secondary-button full" onClick={analyzeImpact} disabled={analyzing}>{analyzing ? <LoaderCircle className="spin" size={17}/> : <WandSparkles size={17}/>} {analyzing ? 'Analizando…' : 'Analizar vídeo'}</button>
                {!!impactMoments.length && <div className="impact-list">{impactMoments.map((moment) => <div key={moment.id}><button className="impact-play" onClick={() => seekTo(moment.start)}><Play size={13}/></button><span><strong>{formatTime(moment.start)} — {formatTime(moment.end)}</strong><small>{moment.reason}</small></span><b>{moment.score}</b><button className="mini-add" onClick={() => addImpactClip(moment)}><Plus size={14}/></button></div>)}</div>}
                <p className="hint"><AlertTriangle size={14}/> La puntuación es orientativa y no predice la viralidad.</p>
              </section>
            </aside>
          </div>
        )}

        {source && <section className="card library-section">
          <div className="section-heading"><div><span className="number">3</span><div><h2>Biblioteca de cortes</h2><p>{clips.length ? `${clips.length} fragmentos disponibles` : 'Crea cortes manuales, automáticos o sugeridos'}</p></div></div>{clips.length > 0 && <div className="library-actions"><button className="secondary-button" onClick={createAutomaticTimeline}><WandSparkles size={16}/> Crear montaje automático</button><button className="danger-text" onClick={() => setClips([])}><Trash2 size={15}/> Vaciar</button></div>}</div>
          {!clips.length ? <div className="empty-state"><Film size={30}/><p>Aquí aparecerán tus fragmentos.</p></div> : <div className="clip-grid">{clips.map((clip) => <article className="clip-card" key={clip.id}><button className="clip-preview" onClick={() => seekTo(clip.start)}><Play size={20}/><span>{formatTime(clip.start)}</span>{clip.impact && <b>{clip.impact}/100</b>}</button><div><strong>{clip.label}</strong><small>{formatTime(clip.start)} → {formatTime(clip.end)} · {formatTime(clip.duration)}</small></div><div className="clip-actions"><button title="Descargar fragmento" onClick={() => downloadClip(clip)}><Download size={16}/></button><button className="add-timeline" onClick={() => addClipToTimeline(clip)}><Plus size={16}/> Montaje</button><button title="Eliminar" onClick={() => setClips((items) => items.filter((item) => item.id !== clip.id))}><X size={16}/></button></div></article>)}</div>}
        </section>}

        {source && <section className="card avatar-section">
          <div className="section-heading"><div><span className="number green"><UserRound size={17}/></span><div><h2>Vídeos del avatar o contenido propio</h2><p>Añade introducciones, explicaciones y conclusiones</p></div></div><label className="secondary-button"><Upload size={16}/> Subir vídeos<input type="file" accept="video/*" multiple onChange={onAvatarSelected}/></label></div>
          {!avatars.length ? <div className="empty-inline"><UserRound size={24}/><span>Sube los vídeos del avatar que intercalarás con los fragmentos.</span></div> : <div className="avatar-grid">{avatars.map((avatar) => <article key={avatar.id}><video src={avatar.url} onLoadedMetadata={(e) => updateAvatarDuration(avatar.id, e.currentTarget.duration)} controls/><div><strong>{avatar.name}</strong><small>{formatTime(avatar.duration)} · Contenido propio</small></div><button className="secondary-button full" onClick={() => addAvatarToTimeline(avatar)}><Plus size={16}/> Añadir al montaje</button></article>)}</div>}
        </section>}

        {source && <section className="card timeline-section">
          <div className="section-heading"><div><span className="number">4</span><div><h2>Montaje final</h2><p>Ordena los bloques en el orden en que deben aparecer</p></div></div><span className="total-time">Total: {formatTime(timelineStats.total)}</span></div>
          {!timeline.length ? <div className="empty-state"><GripVertical size={28}/><p>Añade cortes y vídeos del avatar para construir la respuesta.</p></div> : <div className="timeline-list">{timeline.map((item, index) => <article key={item.timelineId} className={item.kind}><GripVertical className="grip" size={19}/><span className="timeline-index">{index + 1}</span><span className="timeline-type">{item.kind === 'avatar' ? <UserRound size={17}/> : <Film size={17}/>}</span><div><strong>{item.label}</strong><small>{item.kind === 'avatar' ? 'Contenido propio' : `${formatTime(item.start)} → ${formatTime(item.end)}`} · {formatTime(item.duration)}</small></div><div className="reorder"><button disabled={index === 0} onClick={() => moveTimeline(index, -1)}><ArrowUp size={15}/></button><button disabled={index === timeline.length - 1} onClick={() => moveTimeline(index, 1)}><ArrowDown size={15}/></button><button onClick={() => setTimeline((items) => items.filter((entry) => entry.timelineId !== item.timelineId))}><Trash2 size={15}/></button></div></article>)}</div>}

          {!!timeline.length && <div className="rights-meter"><div className="meter-copy"><span><strong>Contenido ajeno: {timelineStats.originalPercent}%</strong><small>{formatTime(timelineStats.original)} de fragmentos originales</small></span><span className="own"><strong>Contenido propio: {100 - timelineStats.originalPercent}%</strong><small>{formatTime(timelineStats.own)} de avatar</small></span></div><div className="meter"><span style={{ width: `${timelineStats.originalPercent}%` }}/></div>{timelineStats.originalPercent > 35 ? <p className="warning"><AlertTriangle size={16}/> El material original supera el 35 %. Considera añadir más análisis propio. Esto no determina por sí solo el copyright ni la monetización.</p> : <p className="good"><Check size={16}/> La mayor parte del montaje es contenido propio. Aun así, revisa que cada fragmento sea necesario para tu análisis.</p>}</div>}

          <div className="export-row"><div><h3>Exportación MP4 · 720p</h3><p>La primera preparación puede tardar un poco. Mantén esta pestaña abierta.</p></div><button className="primary-button export" onClick={exportTimeline} disabled={!timeline.length || working}>{working ? <LoaderCircle className="spin" size={18}/> : <Download size={18}/>} Generar y descargar vídeo</button></div>
        </section>}

        <footer><p>ClipRespuesta no descarga vídeos de plataformas externas. Sube únicamente archivos que tengas derecho a utilizar.</p></footer>
      </main>

      {(working || analyzing) && <div className="processing"><div><LoaderCircle className="spin" size={30}/><strong>{status || 'Procesando…'}</strong><div className="progress"><span style={{ width: `${progress}%` }}/></div><small>{progress}% · No cierres esta pestaña</small></div></div>}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('No se pudo leer el fotograma')); };
    const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

export default App;
