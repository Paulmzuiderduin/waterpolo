import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Play, Plus, Scissors, Trash2, Upload } from 'lucide-react';

const TOOL_OPTIONS = [
  { key: 'arrow', label: 'Arrow' },
  { key: 'circle', label: 'Circle' },
  { key: 'freehand', label: 'Freehand' },
  { key: 'text', label: 'Text' }
];

let ffmpegRuntimePromise = null;

const round2 = (value) => Math.round(value * 100) / 100;

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const formatClock = (seconds) => {
  const total = Math.max(0, seconds || 0);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

const secondsToFfmpeg = (seconds) => {
  const total = Math.max(0, seconds || 0);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = (total % 60).toFixed(3);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

const safeBaseName = (filename = 'video') =>
  filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_');

const makeSnippetName = (videoName, index, start, end) =>
  `${safeBaseName(videoName)}_snippet-${String(index + 1).padStart(3, '0')}_${formatClock(start).replace(/[:.]/g, '-')}_${formatClock(end).replace(/[:.]/g, '-')}`;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

const saveBlobLocally = async (blob, suggestedName) => {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  downloadBlob(blob, suggestedName);
};

const drawArrowCanvas = (ctx, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const headLength = 12;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
};

const renderDrawingsToPng = async (drawings, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  drawings.forEach((drawing) => {
    const color = drawing.color || '#ef4444';
    const lineWidth = drawing.width || 3;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (drawing.type === 'arrow') {
      drawArrowCanvas(
        ctx,
        (drawing.x1 / 100) * width,
        (drawing.y1 / 100) * height,
        (drawing.x2 / 100) * width,
        (drawing.y2 / 100) * height
      );
      return;
    }

    if (drawing.type === 'circle') {
      const x1 = (drawing.x1 / 100) * width;
      const y1 = (drawing.y1 / 100) * height;
      const x2 = (drawing.x2 / 100) * width;
      const y2 = (drawing.y2 / 100) * height;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const radius = Math.hypot(x2 - x1, y2 - y1) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (drawing.type === 'freehand') {
      if (!drawing.points?.length) return;
      ctx.beginPath();
      ctx.moveTo((drawing.points[0].x / 100) * width, (drawing.points[0].y / 100) * height);
      drawing.points.slice(1).forEach((point) => {
        ctx.lineTo((point.x / 100) * width, (point.y / 100) * height);
      });
      ctx.stroke();
      return;
    }

    if (drawing.type === 'text' && drawing.text?.trim()) {
      const fontSize = drawing.size || 28;
      ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
      ctx.fillText(drawing.text, (drawing.x / 100) * width, (drawing.y / 100) * height);
    }
  });

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

const getFfmpegRuntime = async () => {
  if (ffmpegRuntimePromise) return ffmpegRuntimePromise;
  ffmpegRuntimePromise = (async () => {
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js'),
      import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js')
    ]);

    const ffmpeg = new FFmpeg();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    });
    return { ffmpeg, fetchFile };
  })();

  return ffmpegRuntimePromise;
};

const executeWithFallbacks = async (ffmpeg, commands) => {
  let lastError = null;
  for (const args of commands) {
    try {
      await ffmpeg.exec(args);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('FFmpeg export failed');
};

const VideoAnalysisView = ({ teamId, seasonId, toast }) => {
  const [sourceFile, setSourceFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState('');
  const [startMarker, setStartMarker] = useState(null);
  const [endMarker, setEndMarker] = useState(null);
  const [tool, setTool] = useState('arrow');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawDraft, setDrawDraft] = useState(null);
  const [loopSnippet, setLoopSnippet] = useState(true);
  const [playingSnippetId, setPlayingSnippetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const drawAreaRef = useRef(null);

  const storageKey = `waterpolo_video_analysis_${seasonId}_${teamId}`;
  const selectedSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === selectedSnippetId) || null,
    [snippets, selectedSnippetId]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.snippets) {
        setSnippets(parsed.snippets);
        setSelectedSnippetId(parsed.snippets[0]?.id || '');
      } else {
        setSnippets([]);
        setSelectedSnippetId('');
      }
    } catch {
      setSnippets([]);
      setSelectedSnippetId('');
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ snippets }));
  }, [snippets, storageKey]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (!playingSnippetId) return;
      const snippet = snippets.find((item) => item.id === playingSnippetId);
      if (!snippet) return;
      if (video.currentTime >= snippet.end) {
        if (loopSnippet) {
          video.currentTime = snippet.start;
        } else {
          video.pause();
          setPlayingSnippetId('');
        }
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [playingSnippetId, loopSnippet, snippets]);

  const openVideoPicker = () => fileInputRef.current?.click();

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setSourceFile(file);
    setVideoUrl(nextUrl);
    setStartMarker(null);
    setEndMarker(null);
    setPlayingSnippetId('');
    setError('');
    event.target.value = '';
  };

  const updateSelectedSnippet = (updater) => {
    if (!selectedSnippetId) return;
    setSnippets((prev) =>
      prev.map((snippet) => (snippet.id === selectedSnippetId ? updater(snippet) : snippet))
    );
  };

  const addSnippet = () => {
    if (!sourceFile) {
      setError('Select a video first.');
      return;
    }
    if (startMarker === null || endMarker === null || endMarker <= startMarker) {
      setError('Set valid in/out markers first.');
      return;
    }
    const nextSnippet = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: makeSnippetName(sourceFile.name, snippets.length, startMarker, endMarker),
      start: round2(startMarker),
      end: round2(endMarker),
      drawings: []
    };
    setSnippets((prev) => [...prev, nextSnippet]);
    setSelectedSnippetId(nextSnippet.id);
    setError('');
  };

  const deleteSnippet = (snippetId) => {
    setSnippets((prev) => prev.filter((snippet) => snippet.id !== snippetId));
    if (selectedSnippetId === snippetId) {
      const rest = snippets.filter((snippet) => snippet.id !== snippetId);
      setSelectedSnippetId(rest[0]?.id || '');
    }
  };

  const playSnippet = (snippet) => {
    const video = videoRef.current;
    if (!video || !snippet) return;
    video.currentTime = snippet.start;
    video.play().catch(() => {});
    setPlayingSnippetId(snippet.id);
  };

  const getPointerPercent = (event) => {
    const rect = drawAreaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
    };
  };

  const handlePointerDown = (event) => {
    if (!selectedSnippet) return;
    const point = getPointerPercent(event);
    if (!point) return;
    if (tool === 'text') {
      const text = window.prompt('Enter label text');
      if (!text?.trim()) return;
      updateSelectedSnippet((snippet) => ({
        ...snippet,
        drawings: [
          ...(snippet.drawings || []),
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'text',
            x: point.x,
            y: point.y,
            text: text.trim(),
            color: drawColor,
            size: 28
          }
        ]
      }));
      return;
    }
    if (tool === 'freehand') {
      setDrawDraft({
        id: `draft_${Date.now()}`,
        type: 'freehand',
        points: [point],
        color: drawColor,
        width: drawWidth
      });
    } else {
      setDrawDraft({
        id: `draft_${Date.now()}`,
        type: tool,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        color: drawColor,
        width: drawWidth
      });
    }
  };

  const handlePointerMove = (event) => {
    if (!drawDraft) return;
    const point = getPointerPercent(event);
    if (!point) return;
    if (drawDraft.type === 'freehand') {
      setDrawDraft((prev) => ({
        ...prev,
        points: [...prev.points, point]
      }));
    } else {
      setDrawDraft((prev) => ({
        ...prev,
        x2: point.x,
        y2: point.y
      }));
    }
  };

  const handlePointerUp = () => {
    if (!drawDraft || !selectedSnippet) return;
    if (drawDraft.type === 'freehand' && drawDraft.points.length < 2) {
      setDrawDraft(null);
      return;
    }
    updateSelectedSnippet((snippet) => ({
      ...snippet,
      drawings: [...(snippet.drawings || []), drawDraft]
    }));
    setDrawDraft(null);
  };

  const removeLastDrawing = () => {
    updateSelectedSnippet((snippet) => ({
      ...snippet,
      drawings: (snippet.drawings || []).slice(0, -1)
    }));
  };

  const clearDrawings = () => {
    updateSelectedSnippet((snippet) => ({
      ...snippet,
      drawings: []
    }));
  };

  const exportSnippet = async (snippet, withOverlay) => {
    if (!sourceFile || !snippet) return;
    setBusy(true);
    setError('');
    try {
      const { ffmpeg, fetchFile } = await getFfmpegRuntime();
      const extension = sourceFile.name.split('.').pop() || 'mp4';
      const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const inputName = `input_${token}.${extension}`;
      const overlayName = `overlay_${token}.png`;
      const outputName = `output_${token}.mp4`;

      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      const start = secondsToFfmpeg(snippet.start);
      const end = secondsToFfmpeg(snippet.end);

      if (withOverlay && snippet.drawings?.length) {
        const video = videoRef.current;
        const width = Math.max(320, video?.videoWidth || 1280);
        const height = Math.max(180, video?.videoHeight || 720);
        const overlayBlob = await renderDrawingsToPng(snippet.drawings, width, height);
        await ffmpeg.writeFile(overlayName, await fetchFile(overlayBlob));

        await executeWithFallbacks(ffmpeg, [
          [
            '-ss',
            start,
            '-to',
            end,
            '-i',
            inputName,
            '-i',
            overlayName,
            '-filter_complex',
            'overlay=0:0',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            '-shortest',
            outputName
          ],
          [
            '-ss',
            start,
            '-to',
            end,
            '-i',
            inputName,
            '-i',
            overlayName,
            '-filter_complex',
            'overlay=0:0',
            '-c:v',
            'mpeg4',
            '-q:v',
            '4',
            '-c:a',
            'aac',
            '-shortest',
            outputName
          ]
        ]);
      } else {
        await executeWithFallbacks(ffmpeg, [
          ['-ss', start, '-to', end, '-i', inputName, '-c', 'copy', outputName],
          [
            '-ss',
            start,
            '-to',
            end,
            '-i',
            inputName,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            outputName
          ],
          ['-ss', start, '-to', end, '-i', inputName, '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'aac', outputName]
        ]);
      }

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const filename = `${snippet.name || 'snippet'}.mp4`;
      await saveBlobLocally(blob, filename);
      toast?.(`${withOverlay ? 'Burned' : 'Plain'} MP4 snippet saved locally.`, 'success');

      try {
        await ffmpeg.deleteFile(inputName);
      } catch {}
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {}
      try {
        await ffmpeg.deleteFile(overlayName);
      } catch {}
    } catch (exportError) {
      if (exportError?.name === 'AbortError') return;
      setError('Export failed. Try a shorter snippet or a smaller source video.');
      toast?.('Video export failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportProjectJson = () => {
    const payload = {
      seasonId,
      teamId,
      sourceVideoName: sourceFile?.name || '',
      snippets
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    downloadBlob(blob, `${safeBaseName(sourceFile?.name || 'video')}_annotations.json`);
  };

  const renderedDrawings = selectedSnippet
    ? [...(selectedSnippet.drawings || []), ...(drawDraft ? [drawDraft] : [])]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Video Analysis</p>
          <h2 className="text-2xl font-semibold">Local Snippets & Annotations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Works locally in-browser. Exported MP4 snippets can be played without this website.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoChange}
          />
          <button
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={openVideoPicker}
          >
            <Upload size={14} />
            {sourceFile ? 'Change video' : 'Select video'}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={exportProjectJson}
            disabled={snippets.length === 0}
          >
            <Download size={14} />
            Export annotations JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            {!videoUrl ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Select a local video to start analysis.
              </div>
            ) : (
              <div
                ref={drawAreaRef}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-black"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <video ref={videoRef} className="h-auto max-h-[520px] w-full object-contain" controls src={videoUrl} />
                {selectedSnippet && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {renderedDrawings.map((drawing) => {
                      if (drawing.type === 'arrow') {
                        return (
                          <g key={drawing.id}>
                            <line
                              x1={drawing.x1}
                              y1={drawing.y1}
                              x2={drawing.x2}
                              y2={drawing.y2}
                              stroke={drawing.color}
                              strokeWidth={(drawing.width || 3) / 10}
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }
                      if (drawing.type === 'circle') {
                        const cx = (drawing.x1 + drawing.x2) / 2;
                        const cy = (drawing.y1 + drawing.y2) / 2;
                        const rx = Math.abs(drawing.x2 - drawing.x1) / 2;
                        const ry = Math.abs(drawing.y2 - drawing.y1) / 2;
                        return (
                          <ellipse
                            key={drawing.id}
                            cx={cx}
                            cy={cy}
                            rx={rx}
                            ry={ry}
                            fill="none"
                            stroke={drawing.color}
                            strokeWidth={(drawing.width || 3) / 10}
                          />
                        );
                      }
                      if (drawing.type === 'freehand') {
                        const points = (drawing.points || [])
                          .map((point) => `${point.x},${point.y}`)
                          .join(' ');
                        return (
                          <polyline
                            key={drawing.id}
                            points={points}
                            fill="none"
                            stroke={drawing.color}
                            strokeWidth={(drawing.width || 3) / 10}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      }
                      if (drawing.type === 'text') {
                        return (
                          <text
                            key={drawing.id}
                            x={drawing.x}
                            y={drawing.y}
                            fill={drawing.color}
                            fontSize="3.2"
                            fontWeight="700"
                          >
                            {drawing.text}
                          </text>
                        );
                      }
                      return null;
                    })}
                  </svg>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Snippet markers</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700"
                onClick={() => {
                  if (!videoRef.current) return;
                  setStartMarker(round2(videoRef.current.currentTime));
                }}
                disabled={!videoUrl}
              >
                Mark in
              </button>
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700"
                onClick={() => {
                  if (!videoRef.current) return;
                  setEndMarker(round2(videoRef.current.currentTime));
                }}
                disabled={!videoUrl}
              >
                Mark out
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white disabled:opacity-50"
                onClick={addSnippet}
                disabled={!videoUrl}
              >
                <Plus size={14} />
                Add snippet
              </button>
              <label className="ml-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={loopSnippet}
                  onChange={(event) => setLoopSnippet(event.target.checked)}
                />
                Loop snippet playback
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="text-xs text-slate-500">In</div>
                <div className="font-semibold">{startMarker === null ? '—' : formatClock(startMarker)}</div>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="text-xs text-slate-500">Out</div>
                <div className="font-semibold">{endMarker === null ? '—' : formatClock(endMarker)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Drawing tools</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    tool === option.key ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'
                  }`}
                  onClick={() => setTool(option.key)}
                  disabled={!selectedSnippet}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Color</label>
              <input
                type="color"
                className="h-8 w-10 rounded border border-slate-200 p-1"
                value={drawColor}
                onChange={(event) => setDrawColor(event.target.value)}
                disabled={!selectedSnippet}
              />
              <label className="text-xs font-semibold text-slate-500">Line width</label>
              <input
                type="range"
                min="1"
                max="10"
                value={drawWidth}
                onChange={(event) => setDrawWidth(Number(event.target.value))}
                disabled={!selectedSnippet}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                onClick={removeLastDrawing}
                disabled={!selectedSnippet || !selectedSnippet.drawings?.length}
              >
                Undo drawing
              </button>
              <button
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                onClick={clearDrawings}
                disabled={!selectedSnippet || !selectedSnippet.drawings?.length}
              >
                Clear drawings
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Snippets</h3>
            <div className="mt-3 space-y-2">
              {snippets.length === 0 && <div className="text-sm text-slate-500">No snippets yet.</div>}
              {snippets.map((snippet) => {
                const selected = snippet.id === selectedSnippetId;
                return (
                  <div
                    key={snippet.id}
                    className={`rounded-xl border px-3 py-3 ${selected ? 'border-cyan-400 bg-cyan-50' : 'border-slate-100'}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                        value={snippet.name}
                        onChange={(event) =>
                          setSnippets((prev) =>
                            prev.map((item) =>
                              item.id === snippet.id ? { ...item, name: event.target.value } : item
                            )
                          )
                        }
                      />
                      <button
                        className="rounded-md border border-red-200 p-1 text-red-600"
                        onClick={() => deleteSnippet(snippet.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatClock(snippet.start)} → {formatClock(snippet.end)} · {snippet.drawings?.length || 0} drawings
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => setSelectedSnippetId(snippet.id)}
                      >
                        Select
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => playSnippet(snippet)}
                      >
                        <Play size={12} />
                        Play
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        onClick={() => exportSnippet(snippet, true)}
                        disabled={busy || !sourceFile}
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                        Export MP4 + drawings
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        onClick={() => exportSnippet(snippet, false)}
                        disabled={busy || !sourceFile}
                      >
                        <Download size={12} />
                        Export MP4 only
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 text-xs text-slate-500 shadow-sm">
            Exported snippets are local files and play in normal media players. Drawings are burned into the video only
            when you use “Export MP4 + drawings”.
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysisView;
