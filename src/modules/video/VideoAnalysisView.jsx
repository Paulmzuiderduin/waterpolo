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

const snippetDuration = (snippet) => round2(Math.max(0, (snippet?.end || 0) - (snippet?.start || 0)));

const normalizeDrawingTiming = (drawing, duration) => {
  const max = Math.max(0.05, duration || 0.05);
  const rawFrom = Number(drawing?.showFrom ?? 0);
  const rawTo = Number(drawing?.showTo ?? max);
  const showFrom = Math.max(0, Math.min(max, Number.isFinite(rawFrom) ? rawFrom : 0));
  const showTo = Math.max(showFrom + 0.05, Math.min(max, Number.isFinite(rawTo) ? rawTo : max));
  return { showFrom: round2(showFrom), showTo: round2(showTo) };
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
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
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

const getReadableError = (error) => {
  if (!error) return 'Unknown export error.';
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'Unknown export error.';
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
  const [drawMode, setDrawMode] = useState(false);
  const [loopSnippet, setLoopSnippet] = useState(true);
  const [playingSnippetId, setPlayingSnippetId] = useState('');
  const [videoTime, setVideoTime] = useState(0);
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
  const selectedSnippetDuration = selectedSnippet ? Math.max(0.05, snippetDuration(selectedSnippet)) : 0;
  const currentSnippetTime = selectedSnippet
    ? round2(Math.max(0, Math.min(selectedSnippetDuration, videoTime - selectedSnippet.start)))
    : 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.snippets) {
        const hydrated = parsed.snippets.map((snippet) => {
          const duration = Math.max(0.05, snippetDuration(snippet));
          return {
            ...snippet,
            drawings: (snippet.drawings || []).map((drawing, index) => ({
              ...drawing,
              id: drawing.id || `${snippet.id}_drawing_${index + 1}`,
              ...normalizeDrawingTiming(drawing, duration)
            }))
          };
        });
        setSnippets(hydrated);
        setSelectedSnippetId(hydrated[0]?.id || '');
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
      setVideoTime(video.currentTime || 0);
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space') return;
      const target = event.target;
      const tagName = target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
        return;
      }
      if (target?.isContentEditable) return;
      const video = videoRef.current;
      if (!video) return;
      event.preventDefault();
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
        setPlayingSnippetId('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    setVideoTime(0);
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
    setSnippets((prev) => {
      const next = prev.filter((snippet) => snippet.id !== snippetId);
      if (selectedSnippetId === snippetId) {
        setSelectedSnippetId(next[0]?.id || '');
      }
      return next;
    });
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
    if (!drawMode) return;
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
            size: 28,
            showFrom: 0,
            showTo: selectedSnippetDuration
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
        width: drawWidth,
        showFrom: 0,
        showTo: selectedSnippetDuration
      });
    }
  };

  const handlePointerMove = (event) => {
    if (!drawMode) return;
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
    if (!drawMode) return;
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

  const setDrawingTiming = (drawingId, field, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    updateSelectedSnippet((snippet) => {
      const duration = Math.max(0.05, snippetDuration(snippet));
      return {
        ...snippet,
        drawings: (snippet.drawings || []).map((drawing) => {
          if (drawing.id !== drawingId) return drawing;
          const timing = normalizeDrawingTiming(drawing, duration);
          let from = timing.showFrom;
          let to = timing.showTo;
          if (field === 'from') {
            from = Math.max(0, Math.min(duration, numeric));
            if (from >= to) to = Math.min(duration, from + 0.05);
          } else {
            to = Math.max(0.05, Math.min(duration, numeric));
            if (to <= from) from = Math.max(0, to - 0.05);
          }
          return { ...drawing, showFrom: round2(from), showTo: round2(to) };
        })
      };
    });
  };

  const setDrawingTimingToNow = (drawingId, field) => {
    setDrawingTiming(drawingId, field, currentSnippetTime);
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
      const outputName = `output_${token}.mp4`;

      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      const start = secondsToFfmpeg(snippet.start);
      const end = secondsToFfmpeg(snippet.end);

      if (withOverlay && snippet.drawings?.length) {
        const video = videoRef.current;
        const width = Math.max(320, video?.videoWidth || 1280);
        const height = Math.max(180, video?.videoHeight || 720);
        const duration = Math.max(0.05, snippetDuration(snippet));
        const overlayDrawings = snippet.drawings.map((drawing) => ({
          ...drawing,
          ...normalizeDrawingTiming(drawing, duration)
        }));
        const overlayFiles = [];
        for (let index = 0; index < overlayDrawings.length; index += 1) {
          const drawing = overlayDrawings[index];
          const overlayFile = `overlay_${token}_${index}.png`;
          const overlayBlob = await renderDrawingsToPng([drawing], width, height);
          await ffmpeg.writeFile(overlayFile, await fetchFile(overlayBlob));
          overlayFiles.push({
            file: overlayFile,
            from: drawing.showFrom.toFixed(2),
            to: drawing.showTo.toFixed(2)
          });
        }

        const filterParts = ['[0:v]setpts=PTS-STARTPTS[base]'];
        let lastLabel = 'base';
        overlayFiles.forEach((overlay, index) => {
          const nextLabel = `ov${index}`;
          filterParts.push(
            `[${lastLabel}][${index + 1}:v]overlay=0:0:enable='between(t\\,${overlay.from}\\,${overlay.to})'[${nextLabel}]`
          );
          lastLabel = nextLabel;
        });
        const filterComplex = filterParts.join(';');
        const inputArgs = overlayFiles.flatMap((overlay) => ['-i', overlay.file]);
        const mapWithAudio = ['-map', `[${lastLabel}]`, '-map', '0:a?'];
        const mapVideoOnly = ['-map', `[${lastLabel}]`];

        await executeWithFallbacks(ffmpeg, [
          [
            '-ss',
            start,
            '-to',
            end,
            '-i',
            inputName,
            ...inputArgs,
            '-filter_complex',
            filterComplex,
            ...mapWithAudio,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'copy',
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
            ...inputArgs,
            '-filter_complex',
            filterComplex,
            ...mapWithAudio,
            '-c:v',
            'mpeg4',
            '-q:v',
            '4',
            '-c:a',
            'copy',
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
            ...inputArgs,
            '-filter_complex',
            filterComplex,
            ...mapVideoOnly,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '24',
            '-pix_fmt',
            'yuv420p',
            outputName
          ]
        ]);
        for (const overlay of overlayFiles) {
          try {
            await ffmpeg.deleteFile(overlay.file);
          } catch {}
        }
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
            'copy',
            '-movflags',
            '+faststart',
            outputName
          ],
          ['-ss', start, '-to', end, '-i', inputName, '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'copy', outputName],
          ['-ss', start, '-to', end, '-i', inputName, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', outputName]
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
    } catch (exportError) {
      if (exportError?.name === 'AbortError') return;
      const reason = getReadableError(exportError);
      setError(`Export failed. ${reason}`);
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
    ? [
        ...(selectedSnippet.drawings || []).filter((drawing) => {
          const timing = normalizeDrawingTiming(drawing, selectedSnippetDuration);
          return currentSnippetTime >= timing.showFrom && currentSnippetTime <= timing.showTo;
        }),
        ...(drawDraft ? [drawDraft] : [])
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="wp-card relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-24 h-44 w-44 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Video Analysis</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Local Snippets & Drawings</h2>
            <p className="mt-1 text-sm text-slate-600">
              Optional video workflow. Clips and annotations stay local in-browser unless you export.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Space = play/pause</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">No cloud upload</span>
              {sourceFile && (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
                  {sourceFile.name}
                </span>
              )}
            </div>
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
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              onClick={openVideoPicker}
            >
              <Upload size={14} />
              {sourceFile ? 'Change video' : 'Select video'}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={exportProjectJson}
              disabled={snippets.length === 0}
            >
              <Download size={14} />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="wp-card rounded-3xl p-4 xl:col-start-2 xl:row-start-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Snippets ({snippets.length})</h3>
            <button
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setSelectedSnippetId('');
                setDrawDraft(null);
                setDrawMode(false);
              }}
              disabled={!selectedSnippetId}
            >
              Unselect
            </button>
          </div>
          <div className="mt-3 max-h-[690px] space-y-2 overflow-y-auto pr-1">
            {snippets.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-sm text-slate-500">
                Add your first snippet from the video panel.
              </div>
            )}
            {snippets.map((snippet) => {
              const selected = snippet.id === selectedSnippetId;
              return (
                <div
                  key={snippet.id}
                  className={`rounded-xl border p-3 transition ${
                    selected ? 'border-cyan-300 bg-cyan-50/60' : 'border-slate-200 bg-white'
                  }`}
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
                      className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                      onClick={() => deleteSnippet(snippet.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    {formatClock(snippet.start)} - {formatClock(snippet.end)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{snippet.drawings?.length || 0} drawings</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        selected
                          ? 'border border-cyan-300 bg-cyan-100 text-cyan-700'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                      onClick={() => setSelectedSnippetId(snippet.id)}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => playSnippet(snippet)}
                    >
                      <Play size={12} />
                      Play
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => exportSnippet(snippet, true)}
                      disabled={busy || !sourceFile}
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                      MP4 + Draw
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => exportSnippet(snippet, false)}
                      disabled={busy || !sourceFile}
                    >
                      <Download size={12} />
                      MP4
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 xl:col-start-1 xl:row-start-1 xl:row-span-2">
          <div className="wp-card rounded-3xl p-4">
            {!videoUrl ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-20 text-center text-sm text-slate-500">
                Select a local video to start analysis.
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Current: {formatClock(videoTime)}
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      drawMode ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {drawMode ? 'Drawing mode ON' : 'Drawing mode OFF'}
                  </div>
                </div>
                <div
                  ref={drawAreaRef}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-black"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <video
                    ref={videoRef}
                    className="h-auto max-h-[560px] w-full object-contain"
                    controls={!drawMode}
                    src={videoUrl}
                  />
                  {selectedSnippet && (
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {renderedDrawings.map((drawing) => {
                        if (drawing.type === 'arrow') {
                          const markerId = `preview-arrowhead-${drawing.id}`;
                          return (
                            <g key={drawing.id}>
                              <defs>
                                <marker
                                  id={markerId}
                                  markerWidth="4"
                                  markerHeight="4"
                                  refX="3.5"
                                  refY="2"
                                  orient="auto"
                                >
                                  <path d="M0,0 L4,2 L0,4 Z" fill={drawing.color} />
                                </marker>
                              </defs>
                              <line
                                x1={drawing.x1}
                                y1={drawing.y1}
                                x2={drawing.x2}
                                y2={drawing.y2}
                                stroke={drawing.color}
                                strokeWidth={(drawing.width || 3) / 10}
                                strokeLinecap="round"
                                markerEnd={`url(#${markerId})`}
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
                          const points = (drawing.points || []).map((point) => `${point.x},${point.y}`).join(' ');
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
              </>
            )}
          </div>

          <div className="wp-card rounded-3xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Snippet controls</h3>
              {selectedSnippet && (
                <div className="text-xs font-semibold text-slate-500">Active: {selectedSnippet.name}</div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (!videoRef.current) return;
                  setStartMarker(round2(videoRef.current.currentTime));
                }}
                disabled={!videoUrl}
              >
                Mark in
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (!videoRef.current) return;
                  setEndMarker(round2(videoRef.current.currentTime));
                }}
                disabled={!videoUrl}
              >
                Mark out
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={addSnippet}
                disabled={!videoUrl}
              >
                <Plus size={14} />
                Add snippet
              </button>
              <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={loopSnippet}
                  onChange={(event) => setLoopSnippet(event.target.checked)}
                />
                Loop playback
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs text-slate-500">In</div>
                <div className="font-semibold text-slate-700">
                  {startMarker === null ? '--' : formatClock(startMarker)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs text-slate-500">Out</div>
                <div className="font-semibold text-slate-700">
                  {endMarker === null ? '--' : formatClock(endMarker)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 xl:col-start-2 xl:row-start-2">
          <div className="wp-card rounded-3xl p-4">
            <h3 className="text-sm font-semibold text-slate-700">Drawing tools</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    tool === option.key
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
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
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                  drawMode ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => {
                  setDrawMode((prev) => {
                    const next = !prev;
                    if (next) {
                      videoRef.current?.pause();
                      setPlayingSnippetId('');
                    }
                    return next;
                  });
                }}
                disabled={!selectedSnippet}
              >
                {drawMode ? 'Draw ON' : 'Draw OFF'}
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={removeLastDrawing}
                disabled={!selectedSnippet || !selectedSnippet.drawings?.length}
              >
                Undo
              </button>
              <button
                className="rounded-lg border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={clearDrawings}
                disabled={!selectedSnippet || !selectedSnippet.drawings?.length}
              >
                Clear
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Enable Draw ON only when you want to place overlays.</p>
          </div>

          <div className="wp-card rounded-3xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Drawing visibility window</span>
              <span>{selectedSnippet ? formatClock(currentSnippetTime) : '--'}</span>
            </div>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {!selectedSnippet?.drawings?.length && (
                <div className="text-xs text-slate-500">No drawings yet.</div>
              )}
              {(selectedSnippet?.drawings || []).map((drawing, index) => {
                const timing = normalizeDrawingTiming(drawing, selectedSnippetDuration);
                return (
                  <div key={drawing.id} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                    <div className="text-[11px] font-semibold text-slate-600">
                      #{index + 1} - {drawing.type}
                    </div>
                    <div className="mt-1 grid grid-cols-[1fr_1fr_auto] items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={selectedSnippetDuration || 0}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        value={timing.showFrom}
                        onChange={(event) => setDrawingTiming(drawing.id, 'from', event.target.value)}
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={selectedSnippetDuration || 0}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                        value={timing.showTo}
                        onChange={(event) => setDrawingTiming(drawing.id, 'to', event.target.value)}
                      />
                      <div className="flex gap-1">
                        <button
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
                          onClick={() => setDrawingTimingToNow(drawing.id, 'from')}
                        >
                          Now to In
                        </button>
                        <button
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
                          onClick={() => setDrawingTimingToNow(drawing.id, 'to')}
                        >
                          Now to Out
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wp-card rounded-3xl p-4 text-xs text-slate-600">
            Exported MP4 snippets are local files. Use <span className="font-semibold">MP4 + Draw</span> to burn the
            visible overlays into the clip.
          </div>
        </section>
      </div>
    </div>
  );
};

export default VideoAnalysisView;
