const storageKey = "toktrend-state-v2";
const appVersion = "2026.06.04-8";

const trends = [
  {
    hashtag: "#AITools",
    title: "Herramientas IA que ahorran horas",
    description: "Apps y automatizaciones mostradas con resultado inmediato.",
    score: 96
  },
  {
    hashtag: "#CreatorLab",
    title: "Una IA creando videos sola",
    description: "Proceso completo desde idea hasta video final.",
    score: 94
  },
  {
    hashtag: "#ViralHack",
    title: "Truco simple con resultado visible",
    description: "Solucion rapida a un problema cotidiano.",
    score: 91
  },
  {
    hashtag: "#DeskSetup",
    title: "Transformacion visual de escritorio",
    description: "Antes, despues, luces y resultado final.",
    score: 88
  }
];

const cinematicStyles = {
  fitness: {
    keywords: ["fitness", "gym", "ejercicio", "entreno", "salud", "deporte"],
    props: "fitness",
    palette: ["#071013", "#22d3ee", "#f43f5e"],
    reference: "Entrenamiento real, energia suave.",
    camera: "Travelling lento y close-ups."
  },
  food: {
    keywords: ["cocina", "comida", "receta", "chef", "restaurante", "postre", "cafe"],
    props: "food",
    palette: ["#111111", "#f97316", "#10b981"],
    reference: "Ingredientes frescos y plato final.",
    camera: "Macro, vapor y montaje rapido."
  },
  business: {
    keywords: ["ventas", "negocio", "marketing", "cliente", "empresa", "emprender", "dinero"],
    props: "business",
    palette: ["#0f172a", "#38bdf8", "#facc15"],
    reference: "Pantallas, notas y decisiones.",
    camera: "Plano detalle y paneo limpio."
  },
  tech: {
    keywords: ["ia", "ai", "tech", "app", "software", "codigo", "automatizacion"],
    props: "tech",
    palette: ["#050816", "#00f5d4", "#7c3aed"],
    reference: "Interfaz digital y luces precisas.",
    camera: "Orbitas suaves, enfoque selectivo."
  },
  beauty: {
    keywords: ["belleza", "maquillaje", "moda", "piel", "estilo"],
    props: "beauty",
    palette: ["#171012", "#fb7185", "#f8fafc"],
    reference: "Luz limpia y detalle elegante.",
    camera: "Close-up suave y transiciones."
  },
  general: {
    keywords: [],
    props: "general",
    palette: ["#08090d", "#20e0d0", "#ff375f"],
    reference: "Montaje vertical cinematico con texto grande.",
    camera: "Push-in suave y cortes limpios."
  }
};

let state = loadState();
let currentVideo = null;
let lastBlob = null;
let publicationTimer = null;

function defaultState() {
  return {
    connected: false,
    aiOnline: false,
    aiProvider: "local",
    periodMinutes: 60,
    videosCreated: 0,
    trendIndex: 0,
    learningNotes: [],
    nextPublicationAt: Date.now() + 60 * 60 * 1000,
    assistantMessages: [
      {
        role: "assistant",
        content: "Soy el asistente de TokTrend. Puedo crear hooks, guiones, captions, hashtags y mejoras usando tus comentarios."
      }
    ]
  };
}

function loadState() {
  try {
    return { ...defaultState(), ...(JSON.parse(localStorage.getItem(storageKey)) || {}) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function $(selector) {
  return document.querySelector(selector);
}

function apiBase() {
  if (window.TOKTREND_API_BASE) return String(window.TOKTREND_API_BASE).replace(/\/$/, "");
  // GitHub Pages usa el backend local para OAuth y publicacion sin exponer secretos.
  if (location.protocol === "file:") return "http://127.0.0.1:8789";
  if (["127.0.0.1", "localhost", ""].includes(location.hostname)) return "";
  return "http://127.0.0.1:8789";
}

function hasBackend() {
  return Boolean(apiBase());
}

function formatPeriod(minutes) {
  const value = Number(minutes || 60);
  if (value < 60) return `${value} min`;
  const hours = value / 60;
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function latestLearningText() {
  const note = (state.learningNotes || [])[0];
  if (!note) return "Estoy aprendiendo de los comentarios para mejorar el proximo video.";
  if (typeof note === "string") return note;
  const suggestions = Array.isArray(note.suggestions) && note.suggestions.length
    ? ` Sugerencias: ${note.suggestions.slice(0, 2).join(" / ")}`
    : "";
  return `${note.summary || "Aprendizaje actualizado."}${suggestions}`;
}

async function postJson(path, body) {
  const base = apiBase();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "El backend no respondio correctamente.");
  }
  return data;
}

async function checkAiHealth() {
  try {
    const response = await fetch(`${apiBase()}/api/health`);
    const data = await response.json();
    state.aiOnline = Boolean(data.ok && data.ai);
    state.aiProvider = data.provider || (state.aiOnline ? "ia" : "local");
    if (data.tiktok) state.connected = Boolean(data.tiktok.connected);
  } catch {
    state.aiOnline = false;
    state.aiProvider = "local";
    state.connected = false;
  }
  saveState();
  renderStatus();
}

async function backendAvailable() {
  if (!hasBackend()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(`${apiBase()}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function connectTikTok() {
  showToast("Revisando conexion local con TikTok...", "info");
  if (!(await backendAvailable())) {
    showToast("No se encontro el servicio local de TokTrend para conectar TikTok. La creacion y descarga siguen disponibles.", "warning");
    return;
  }
  showToast("Abriendo autorizacion de TikTok...", "info");
  location.href = `${apiBase()}/api/tiktok/oauth/start?return_to=${encodeURIComponent(location.href)}`;
}

function savePeriod() {
  state.periodMinutes = Number($("#periodSelect").value || 60);
  state.nextPublicationAt = Date.now() + state.periodMinutes * 60 * 1000;
  saveState();
  schedulePublicationCycle();
  renderStatus();
  showToast(`Periodo guardado. Proximo ciclo en ${formatPeriod(state.periodMinutes)}.`, "success");
}

function nextTrend() {
  const trend = trends[state.trendIndex % trends.length];
  state.trendIndex += 1;
  saveState();
  return trend;
}

function getCinematicDirection(topic) {
  const normalized = String(topic || "").toLowerCase();
  const style = Object.values(cinematicStyles).find((candidate) =>
    candidate.keywords.some((keyword) => normalized.includes(keyword))
  ) || cinematicStyles.general;
  return { ...style, topic };
}

function topicHashtag(topic) {
  const cleaned = String(topic || "toktrend").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28);
  return `#${cleaned || "toktrend"}`;
}

function buildLocalVideo(topic, mode = "manual", trend = null) {
  const cleanTopic = String(topic || trend?.title || "trend viral de TikTok").trim();
  const direction = getCinematicDirection(`${cleanTopic} ${trend?.description || ""}`);
  const learning = latestLearningText();
  const title = mode === "trend" ? `TokTrend detecto: ${cleanTopic}` : `TokTrend: ${cleanTopic}`;
  const caption = "Soy una IA autonoma que evoluciona sola y aprende de tus comentarios. Sigueme y dime que debo mejorar.";
  const hashtags = `${trend?.hashtag || topicHashtag(cleanTopic)} #TokTrend #IA #ParaTi #TikTokAI`;

  return {
    source: mode,
    title,
    caption,
    hashtags,
    direction,
    scenes: [
      {
        overlay: "Soy IA",
        voice: "Soy una IA autonoma que evoluciona sola cada dia.",
        seconds: 4,
        shot: "opening"
      },
      {
        overlay: cleanTopic.slice(0, 42),
        voice: `Hoy conecto ${cleanTopic} con un video claro y util.`,
        seconds: 4,
        shot: "topic"
      },
      {
        overlay: "Comenta",
        voice: `${learning} Dime que debo corregir para aprender mejor.`,
        seconds: 4,
        shot: "feedback"
      }
    ]
  };
}

function normalizeAiPlan(plan, fallbackVideo) {
  const direction = plan?.direction || fallbackVideo.direction;
  const palette = Array.isArray(direction.palette) && direction.palette.length >= 3
    ? direction.palette.slice(0, 3)
    : fallbackVideo.direction.palette;
  const fallbackScenes = fallbackVideo.scenes;
  const scenes = Array.isArray(plan?.scenes) && plan.scenes.length
    ? plan.scenes.slice(0, 4).map((scene, index) => ({
        overlay: String(scene.overlay || fallbackScenes[index % fallbackScenes.length].overlay).slice(0, 48),
        voice: String(scene.voice || fallbackScenes[index % fallbackScenes.length].voice),
        seconds: Math.max(2, Math.min(8, Number(scene.seconds || 4))),
        shot: scene.shot || fallbackScenes[index % fallbackScenes.length].shot || "topic"
      }))
    : fallbackScenes;

  return {
    source: "ai",
    title: String(plan?.title || fallbackVideo.title),
    caption: String(plan?.caption || fallbackVideo.caption),
    hashtags: String(plan?.hashtags || fallbackVideo.hashtags),
    direction: {
      ...fallbackVideo.direction,
      ...direction,
      palette,
      props: direction.props || fallbackVideo.direction.props || "general",
      reference: direction.reference || fallbackVideo.direction.reference,
      camera: direction.camera || fallbackVideo.direction.camera
    },
    scenes
  };
}

async function requestAiVideo(payload, fallbackVideo) {
  const data = await postJson("/api/ai-video", {
    ...payload,
    learningNotes: state.learningNotes || []
  });
  state.aiOnline = data.provider !== "local";
  state.aiProvider = data.provider || "ia";
  saveState();
  return normalizeAiPlan(data.plan, fallbackVideo);
}

async function createAutoVideo() {
  const trend = nextTrend();
  const fallback = buildLocalVideo(trend.title, "trend", trend);
  setBusy(true, "La IA esta creando el guion cinematico...");
  try {
    showVideo(await requestAiVideo({ mode: "trend", trend }, fallback));
  } catch (error) {
    state.aiOnline = false;
    state.aiProvider = "local";
    saveState();
    showToast(`Se uso el generador local: ${error.message}`, "warning");
    showVideo(fallback);
  } finally {
    setBusy(false);
    renderStatus();
  }
}

async function createManualVideo() {
  const topic = $("#manualTopicInput").value.trim();
  if (!topic) {
    showToast("Escribe un tema para crear el video manual.", "warning");
    return;
  }
  const fallback = buildLocalVideo(topic, "manual");
  setBusy(true, "La IA esta creando el video sobre tu tema...");
  try {
    showVideo(await requestAiVideo({ mode: "manual", topic }, fallback));
  } catch (error) {
    state.aiOnline = false;
    state.aiProvider = "local";
    saveState();
    showToast(`Se uso el generador local: ${error.message}`, "warning");
    showVideo(fallback);
  } finally {
    setBusy(false);
    renderStatus();
  }
}

function showVideo(video) {
  currentVideo = video;
  lastBlob = null;
  $("#resultPanel").classList.remove("hidden");
  $("#videoTitle").textContent = video.title;
  $("#videoCaption").textContent = video.caption;
  $("#videoHashtags").textContent = video.hashtags;
  $("#videoReference").textContent = `${video.direction.reference} ${video.direction.camera}`;
  $("#sceneOverlay").textContent = video.scenes[0].overlay;
  $("#lastVideoLink").classList.add("hidden");

  const [base, accent, accent2] = video.direction.palette;
  $("#phoneScene").style.background = `
    radial-gradient(circle at 45% 35%, ${accent}66, transparent 34%),
    radial-gradient(circle at 70% 70%, ${accent2}55, transparent 36%),
    linear-gradient(145deg, ${base}, ${shadeColor(base, 32)})
  `;

  state.videosCreated += 1;
  saveState();
  renderDialogList(video);
  renderStatus();
}

function renderDialogList(video) {
  const panel = $("#dialogPanel");
  const list = $("#dialogList");
  panel.classList.remove("hidden");
  list.innerHTML = "";
  video.scenes.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "dialog-item";
    item.innerHTML = `
      <strong>Escena ${index + 1}: ${escapeHtml(scene.overlay)}</strong>
      <p>${escapeHtml(scene.voice)}</p>
      <small>${scene.seconds || 4}s - ${escapeHtml(scene.shot || "topic")}</small>
    `;
    list.appendChild(item);
  });
}

function previewVoice() {
  if (!currentVideo || !("speechSynthesis" in window)) {
    showToast("Tu navegador no tiene texto a voz disponible.", "warning");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentVideo.scenes.map((scene) => scene.voice).join(" "));
  utterance.lang = "es-ES";
  utterance.rate = 0.9;
  utterance.pitch = 0.95;
  utterance.volume = 0.9;
  const voices = speechSynthesis.getVoices();
  const softVoice = voices.find((voice) => /es|spanish/i.test(`${voice.lang} ${voice.name}`));
  if (softVoice) utterance.voice = softVoice;
  speechSynthesis.speak(utterance);
}

function setBusy(isBusy, message = "Procesando...") {
  $("#renderMessage").textContent = message;
  $("#renderProgress").style.width = isBusy ? "32%" : "0%";
  $("#renderOverlay").classList.toggle("hidden", !isBusy);
}

function shadeColor(hex, amount) {
  const clean = hex.replace("#", "");
  const number = parseInt(clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean, 16);
  const r = Math.max(0, Math.min(255, (number >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((number >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (number & 255) + amount));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function drawFrame(ctx, canvas, video, scene, progress) {
  const width = canvas.width;
  const height = canvas.height;
  const [base, accent, accent2] = video.direction.palette;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, base);
  gradient.addColorStop(0.6, shadeColor(base, 34));
  gradient.addColorStop(1, shadeColor(accent, -46));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawVisualSet(ctx, width, height, video.direction.props, accent, accent2, progress);
  drawLightSweep(ctx, width, height, accent, progress);

  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(0, 0, width, 170);
  ctx.fillRect(0, height - 260, width, 260);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "800 54px Arial";
  wrapText(ctx, scene.overlay, width - 90).slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, width / 2, 170 + index * 64);
  });

  ctx.font = "700 30px Arial";
  wrapText(ctx, scene.voice, width - 80).slice(0, 4).forEach((line, index) => {
    ctx.fillText(line, width / 2, height - 185 + index * 38);
  });

  ctx.fillStyle = accent;
  ctx.font = "800 26px Arial";
  ctx.fillText("TokTrend IA autonoma", width / 2, 74);

  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.fillRect(60, height - 64, (width - 120) * progress, 8);
}

function drawVisualSet(ctx, width, height, props, accent, accent2, progress) {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((progress - 0.5) * 0.08);
  ctx.translate(-width / 2, -height / 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.fillStyle = `${accent2}33`;

  if (props === "food") {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(width / 2 + Math.cos(i) * 105, height / 2 + Math.sin(i * 1.7) * 105, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (props === "business") {
    for (let i = 0; i < 5; i++) {
      const h = 80 + i * 52 + progress * 30;
      ctx.fillRect(180 + i * 70, height / 2 + 180 - h, 38, h);
    }
    ctx.beginPath();
    ctx.moveTo(160, height / 2 + 120);
    ctx.lineTo(300, height / 2 - 40);
    ctx.lineTo(430, height / 2 + 10);
    ctx.lineTo(560, height / 2 - 150);
    ctx.stroke();
  } else if (props === "fitness") {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 60, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2 - 170, height / 2 + 110);
    ctx.lineTo(width / 2 + 170, height / 2 + 110);
    ctx.stroke();
    ctx.fillRect(width / 2 - 220, height / 2 + 70, 64, 80);
    ctx.fillRect(width / 2 + 156, height / 2 + 70, 64, 80);
  } else if (props === "tech") {
    for (let i = 0; i < 7; i++) {
      ctx.strokeRect(150 + i * 34, 360 + i * 44, 280, 78);
    }
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      ctx.lineTo(80 + i * 48, 720 + Math.sin(i + progress * 4) * 90);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 230 + progress * 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(170, 410, 380, 380);
  }
  ctx.restore();
}

function drawLightSweep(ctx, width, height, color, progress) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = color;
  ctx.translate(width * progress, height / 2);
  ctx.rotate(-0.35);
  ctx.fillRect(-40, -height, 80, height * 2);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderVideoBlob() {
  if (!currentVideo) throw new Error("Primero crea un video.");
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Tu navegador no soporta render de video. Usa Chrome o Edge actualizado.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  recorder.start();
  const fps = 30;
  const totalFrames = currentVideo.scenes.reduce((sum, scene) => sum + scene.seconds * fps, 0);
  let frame = 0;
  for (const scene of currentVideo.scenes) {
    const sceneFrames = scene.seconds * fps;
    for (let i = 0; i < sceneFrames; i++) {
      drawFrame(ctx, canvas, currentVideo, scene, i / sceneFrames);
      frame += 1;
      $("#renderProgress").style.width = `${Math.round((frame / totalFrames) * 100)}%`;
      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }
  }

  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: "video/webm" });
}

async function downloadVideo() {
  setBusy(true, "Renderizando video descargable...");
  try {
    lastBlob = await renderVideoBlob();
    const url = URL.createObjectURL(lastBlob);
    const link = $("#lastVideoLink");
    link.href = url;
    link.classList.remove("hidden");
    link.click();
    state.learningNotes.unshift("El ultimo video pidio comentarios para corregir enfoque, tema y claridad.");
    state.learningNotes = state.learningNotes.slice(0, 10);
    saveState();
    renderLearningSummary();
  } finally {
    setBusy(false);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function publishToTikTok() {
  if (!currentVideo) {
    showToast("Primero crea un video.", "warning");
    return;
  }
  await checkAiHealth();
  if (!state.connected) {
    showToast("Conecta TikTok antes de publicar. El video ya puede descargarse localmente.", "warning");
    return;
  }

  setBusy(true, "Creando video para TikTok...");
  try {
    const blob = lastBlob || await renderVideoBlob();
    lastBlob = blob;
    $("#renderMessage").textContent = "Subiendo a TikTok...";
    $("#renderProgress").style.width = "65%";
    const data = await postJson("/api/tiktok/publish", {
      videoDataUrl: await blobToDataUrl(blob),
      title: currentVideo.title,
      caption: currentVideo.caption,
      hashtags: currentVideo.hashtags
    });
    $("#renderProgress").style.width = "100%";
    showToast(`Video enviado a TikTok. Publish ID: ${data.result?.publishId || "recibido"}`, "success");
  } catch (error) {
    showToast(`No se pudo publicar en TikTok: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

function analyzeComments() {
  const input = $("#commentsInput");
  const raw = input.value.trim();
  if (!raw) {
    showToast("Escribe algunos comentarios para analizarlos.", "warning");
    return;
  }

  const comments = raw.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const positive = comments.filter((item) => /(bueno|excelente|me gusta|genial|viral|util|interesante)/i.test(item)).length;
  const negative = comments.filter((item) => /(malo|aburrido|confuso|lento|feo|repetido|no corresponde|no es el tema)/i.test(item)).length;
  const suggestions = comments.filter((item) => /(haz|agrega|quita|explica|deberia|podria|quiero|me gustaria|\?)/i.test(item));
  const mismatch = comments.filter((item) => /(no corresponde|no es el tema|fuera de tema|confuso)/i.test(item));

  const summary = `Comentarios analizados: ${comments.length}. Positivos: ${positive}. Negativos: ${negative}. Correcciones de tema: ${mismatch.length}.`;
  state.learningNotes.unshift({
    date: new Date().toISOString(),
    summary,
    suggestions: [...mismatch, ...suggestions].slice(0, 5)
  });
  state.learningNotes = state.learningNotes.slice(0, 10);
  input.value = "";
  saveState();
  renderLearningSummary();
  showToast("Comentarios analizados y usados para mejorar el siguiente video.", "success");
}

function renderLearningSummary() {
  const target = $("#learningSummary");
  if (!target) return;
  const notes = state.learningNotes || [];
  if (!notes.length) {
    target.textContent = "Sin comentarios analizados todavia.";
    return;
  }
  const latest = notes[0];
  if (typeof latest === "string") {
    target.textContent = latest;
    return;
  }
  const suggestions = Array.isArray(latest.suggestions) && latest.suggestions.length
    ? ` Sugerencias: ${latest.suggestions.slice(0, 3).join(" / ")}`
    : "";
  target.textContent = `${latest.summary || "Aprendizaje actualizado."}${suggestions}`;
}

async function requestAssistantReply(message) {
  try {
    const data = await postJson("/api/assistant", {
      message,
      messages: (state.assistantMessages || []).slice(-10),
      currentVideo: currentVideo ? {
        title: currentVideo.title,
        caption: currentVideo.caption,
        hashtags: currentVideo.hashtags
      } : null,
      learningNotes: state.learningNotes || []
    });
    state.aiOnline = data.provider !== "local";
    state.aiProvider = data.provider || "local";
    saveState();
    return String(data.reply || "").trim();
  } catch {
    return localAssistantReply(message);
  }
}

function localAssistantReply(message) {
  const lower = message.toLowerCase();
  if (lower.includes("hook") || lower.includes("gancho")) {
    return "Hook: \"Esta IA esta aprendiendo a crear TikToks sola, y este es su siguiente intento\". Muestra el resultado rapido y cierra pidiendo un comentario concreto.";
  }
  if (lower.includes("caption") || lower.includes("texto")) {
    return "Caption: \"Estoy probando como una IA mejora con comentarios reales. Dime que cambiarias del siguiente video.\"";
  }
  if (lower.includes("hashtag")) {
    return "Hashtags sugeridos: #TokTrend #IA #ParaTi #AICreator #TikTokTips #Automatizacion";
  }
  return "Puedo ayudarte con hooks, guion de 3 escenas, caption, hashtags o mejoras por comentarios.";
}

function renderAssistantMessages() {
  const container = $("#assistantMessages");
  container.innerHTML = "";
  (state.assistantMessages || []).forEach((message) => {
    const item = document.createElement("div");
    item.className = `assistant-message ${message.role === "user" ? "from-user" : "from-assistant"}`;
    item.textContent = message.content;
    container.appendChild(item);
  });
  container.scrollTop = container.scrollHeight;
}

function addAssistantMessage(role, content) {
  state.assistantMessages = state.assistantMessages || [];
  state.assistantMessages.push({ role, content });
  state.assistantMessages = state.assistantMessages.slice(-16);
  saveState();
  renderAssistantMessages();
}

async function sendAssistantMessage(event) {
  event.preventDefault();
  const input = $("#assistantInput");
  const button = $("#assistantSendBtn");
  const message = input.value.trim();
  if (!message) {
    showToast("Escribe un mensaje para el asistente.", "warning");
    return;
  }
  addAssistantMessage("user", message);
  input.value = "";
  button.disabled = true;
  button.textContent = "Pensando...";
  try {
    addAssistantMessage("assistant", await requestAssistantReply(message));
  } finally {
    button.disabled = false;
    button.textContent = "Enviar";
    renderStatus();
  }
}

function schedulePublicationCycle() {
  clearTimeout(publicationTimer);
  const minutes = Number(state.periodMinutes || 60);
  const delay = Math.max(60 * 1000, minutes * 60 * 1000);
  const nextAt = Number(state.nextPublicationAt || 0);
  const wait = nextAt > Date.now() ? Math.max(60 * 1000, nextAt - Date.now()) : delay;
  publicationTimer = setTimeout(() => {
    runPublicationCycle().catch((error) => {
      showToast(`No se pudo completar el ciclo automatico: ${error.message}`, "warning");
      state.nextPublicationAt = Date.now() + delay;
      saveState();
      schedulePublicationCycle();
    });
  }, wait);
}

async function runPublicationCycle() {
  await createAutoVideo();
  if (state.connected) await publishToTikTok();
  state.nextPublicationAt = Date.now() + Number(state.periodMinutes || 60) * 60 * 1000;
  saveState();
  schedulePublicationCycle();
}

function renderStatus() {
  $("#connectionStatus").textContent = state.connected ? "TikTok" : "Local";
  $("#aiStatus").textContent = state.aiOnline ? providerLabel(state.aiProvider) : "Local";
  $("#periodStatus").textContent = formatPeriod(state.periodMinutes);
  $("#videoCount").textContent = state.videosCreated;
  $("#periodSelect").value = String(state.periodMinutes);
  $("#connectTikTokBtn").textContent = state.connected ? "TikTok conectado" : "Conectar con TikTok";
  renderLearningSummary();
  renderAssistantMessages();
}

function providerLabel(provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  if (provider === "auto") return "Auto";
  return "IA";
}

function showToast(message, type = "info") {
  let toast = $("#toktrendToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toktrendToast";
    toast.style.position = "fixed";
    toast.style.right = "24px";
    toast.style.bottom = "24px";
    toast.style.maxWidth = "420px";
    toast.style.padding = "14px 16px";
    toast.style.borderRadius = "8px";
    toast.style.font = "700 14px/1.4 Arial, sans-serif";
    toast.style.color = "#fff";
    toast.style.zIndex = "9999";
    toast.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
    document.body.appendChild(toast);
  }
  const colors = { info: "#1f2937", success: "#047857", warning: "#92400e", error: "#991b1b" };
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.__toktrendToastTimer);
  window.__toktrendToastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 6500);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function bindEvents() {
  $("#connectTikTokBtn").addEventListener("click", connectTikTok);
  $("#savePeriodBtn").addEventListener("click", savePeriod);
  $("#periodSelect").addEventListener("change", savePeriod);
  $("#autoVideoBtn").addEventListener("click", createAutoVideo);
  $("#manualVideoBtn").addEventListener("click", createManualVideo);
  $("#previewVoiceBtn").addEventListener("click", previewVoice);
  $("#refreshAiBtn").addEventListener("click", () => {
    if (!currentVideo) return showToast("Primero crea un video.", "warning");
    const topic = currentVideo.title.replace(/^TokTrend(:| detecto:)\s*/i, "");
    requestAiVideo({ mode: currentVideo.source || "manual", topic }, currentVideo)
      .then(showVideo)
      .catch((error) => showToast(`No se pudo mejorar con IA: ${error.message}`, "warning"));
  });
  $("#downloadVideoBtn").addEventListener("click", () => {
    downloadVideo().catch((error) => showToast(`No se pudo crear el video: ${error.message}`, "error"));
  });
  $("#publishTikTokBtn").addEventListener("click", () => {
    publishToTikTok().catch((error) => showToast(`No se pudo publicar en TikTok: ${error.message}`, "error"));
  });
  $("#analyzeCommentsBtn").addEventListener("click", analyzeComments);
  $("#assistantForm").addEventListener("submit", sendAssistantMessage);
}

bindEvents();
renderStatus();
checkAiHealth();
schedulePublicationCycle();

if ("caches" in window) {
  const previousVersion = localStorage.getItem("toktrend-app-version");
  if (previousVersion !== appVersion) {
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.toLowerCase().includes("toktrend")).map((key) => caches.delete(key))))
      .finally(() => localStorage.setItem("toktrend-app-version", appVersion))
      .catch(() => {});
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`./sw.js?v=${appVersion}`).catch(() => {});
  });
}
