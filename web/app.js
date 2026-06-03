const storageKey = "toktrend-simple-state-v1";
const browserAiKeyStorageKey = "toktrend-openai-browser-key";

const trends = [
  {
    hashtag: "#DeskSetup",
    title: "Transformacion extrema de escritorio",
    description: "Setups visuales con luces, orden y antes/despues.",
    score: 96,
    style: "cortes rapidos, neon y texto grande"
  },
  {
    hashtag: "#AITools",
    title: "Herramienta que ahorra horas",
    description: "Apps y automatizaciones mostradas con resultado inmediato.",
    score: 94,
    style: "pantalla dividida y reaccion del creador"
  },
  {
    hashtag: "#ViralHack",
    title: "Truco diario que cambia todo",
    description: "Solucion simple a un problema cotidiano.",
    score: 92,
    style: "antes y despues con zoom final"
  },
  {
    hashtag: "#CreatorLab",
    title: "Probando una idea viral en minutos",
    description: "Proceso completo desde idea hasta video final.",
    score: 90,
    style: "cronometro, mesa de trabajo y cortes acelerados"
  }
];

const cinematicStyles = {
  fitness: {
    keywords: ["fitness", "gym", "ejercicio", "entreno", "musculo", "salud", "deporte"],
    palette: ["#101820", "#19c37d", "#f2f2f2"],
    reference: "Video referente: gimnasio cinematico, close-ups de movimiento, luces laterales, energia alta.",
    props: "fitness"
  },
  food: {
    keywords: ["cocina", "comida", "receta", "chef", "meal", "restaurante", "postre", "cafe"],
    palette: ["#160f0a", "#ffb84d", "#f25f4c"],
    reference: "Video referente: cocina macro, vapor, ingredientes cayendo, plano detalle de textura.",
    props: "food"
  },
  business: {
    keywords: ["ventas", "negocio", "dinero", "marketing", "cliente", "empresa", "emprender"],
    palette: ["#07111f", "#2f80ed", "#f2c94c"],
    reference: "Video referente: ciudad nocturna, graficas creciendo, escritorio ejecutivo, ritmo premium.",
    props: "business"
  },
  tech: {
    keywords: ["ia", "ai", "tech", "app", "software", "gadget", "automatizacion", "herramienta"],
    palette: ["#050816", "#20e0d0", "#ff375f"],
    reference: "Video referente: interfaz futurista, lineas de datos, pantallas flotantes y glow digital.",
    props: "tech"
  },
  beauty: {
    keywords: ["moda", "belleza", "makeup", "skincare", "ropa", "estilo"],
    palette: ["#1b1020", "#ff7ab6", "#ffd6e8"],
    reference: "Video referente: beauty shot suave, reflejos, producto girando y luz difusa.",
    props: "beauty"
  },
  general: {
    keywords: [],
    palette: ["#08090d", "#20e0d0", "#ff375f"],
    reference: "Video referente: montaje TikTok cinematico con b-roll, texto grande y cierre de aprendizaje.",
    props: "general"
  }
};

let state = loadState();
let currentVideo = null;
let lastBlob = null;
let aiOnline = false;
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
    assistantMessages: [
      {
        role: "assistant",
        content: "Hola, soy el asistente de TokTrend. Puedo ayudarte con hooks, guiones, captions, hashtags y mejoras para tus videos."
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

function getBrowserAiKey() {
  return sessionStorage.getItem(browserAiKeyStorageKey) || "";
}

function hasBrowserAiKey() {
  return Boolean(getBrowserAiKey());
}

function shouldUseLocalBackend() {
  return true;
}

function apiBase() {
  if (window.TOKTREND_API_BASE) return String(window.TOKTREND_API_BASE).replace(/\/$/, "");
  if (location.protocol === "file:") return "http://127.0.0.1:8789";
  if (["127.0.0.1", "localhost", ""].includes(location.hostname)) return "";
  return "http://127.0.0.1:8789";
}

function saveBrowserAiKey() {
  const input = $("#browserAiKeyInput");
  const key = (input.value || "").trim();
  if (!key) {
    showToast("Pega una clave de OpenAI para activar IA en HTTPS.", "warning");
    return;
  }
  sessionStorage.setItem(browserAiKeyStorageKey, key);
  input.value = "";
  state.aiOnline = true;
  state.aiProvider = "openai-web";
  saveState();
  renderStatus();
  showToast("IA web activada en este navegador.", "success");
}

function clearBrowserAiKey() {
  sessionStorage.removeItem(browserAiKeyStorageKey);
  state.aiOnline = false;
  state.aiProvider = "local";
  saveState();
  renderStatus();
  showToast("Clave IA borrada de esta sesion.", "info");
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
  return note.summary || (Array.isArray(note.suggestions) && note.suggestions[0]) || "Estoy aprendiendo de los comentarios para mejorar el proximo video.";
}

async function connectTikTok() {
  const endpoint = `${apiBase()}/api/tiktok/oauth/start`;
  try {
    showToast("Abriendo autorizacion de TikTok...", "info");
    window.location.href = endpoint;
  } catch (error) {
    showToast(`No se pudo abrir TikTok OAuth: ${error.message}`, "error");
  }
}

async function checkAiHealth() {
  try {
    const endpoint = `${apiBase()}/api/health`;
    const response = await fetch(endpoint);
    const data = await response.json();
    aiOnline = Boolean(data.ok && data.ai);
    state.aiOnline = aiOnline;
    state.aiProvider = data.provider || (aiOnline ? "ia" : "local");
    if (data.tiktok) {
      state.connected = Boolean(data.tiktok.connected);
    }
  } catch {
    aiOnline = hasBrowserAiKey();
    state.aiOnline = aiOnline;
    state.aiProvider = aiOnline ? "openai-web" : "local";
    state.connected = false;
  }
  saveState();
  renderStatus();
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

function buildVideoFromTrend(trend) {
  const learning = latestLearningText();
  const direction = getCinematicDirection(`${trend.title} ${trend.description} ${trend.hashtag}`);
  return {
    source: "trend",
    title: `TokTrend detecto: ${trend.title}`,
    caption: `Soy una inteligencia artificial que evoluciona con tus comentarios. Hoy detecte ${trend.hashtag}: ${trend.description}`,
    hashtags: `${trend.hashtag} #TokTrend #IA #ParaTi`,
    direction,
    scenes: [
      {
        overlay: "Soy una IA",
        voice: "Soy TokTrend, una inteligencia artificial que aprende de cada comentario.",
        seconds: 4,
        shot: "opening"
      },
      {
        overlay: trend.hashtag,
        voice: `Detecte que ${trend.title} esta tomando fuerza en TikTok.`,
        seconds: 4,
        shot: "topic"
      },
      {
        overlay: "Aprendo contigo",
        voice: `${learning} Dime si el tema no corresponde o que debo corregir.`,
        seconds: 5,
        shot: "feedback"
      }
    ],
    manualVideoUrl: ""
  };
}

function buildManualVideo(topic, videoUrl) {
  const cleanTopic = (topic || "tema personalizado").trim();
  const hashtag = `#${cleanTopic.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "toktrend"}`;
  const direction = getCinematicDirection(cleanTopic);
  const learning = latestLearningText();
  return {
    source: "manual",
    title: `Video manual: ${cleanTopic}`,
    caption: `Soy una inteligencia artificial que aprende de tus comentarios. Este video fue creado sobre: ${cleanTopic}.`,
    hashtags: `${hashtag} #TokTrend #IA #ParaTi`,
    direction,
    scenes: [
      {
        overlay: cleanTopic,
        voice: `Soy TokTrend, una inteligencia artificial que crea videos y aprende de comentarios.`,
        seconds: 4,
        shot: "opening"
      },
      {
        overlay: "Tema elegido",
        voice: `Hoy voy a hablar sobre ${cleanTopic} con un enfoque claro y directo.`,
        seconds: 4,
        shot: "topic"
      },
      {
        overlay: "Corrigeme",
        voice: `${learning} Si algo no corresponde, dejamelo en comentarios.`,
        seconds: 5,
        shot: "feedback"
      }
    ],
    manualVideoUrl: videoUrl || ""
  };
}

function normalizeAiPlan(plan, fallbackVideo, manualVideoUrl = "") {
  const direction = plan.direction || fallbackVideo.direction || getCinematicDirection(fallbackVideo.title);
  const palette = Array.isArray(direction.palette) && direction.palette.length >= 3
    ? direction.palette.slice(0, 3)
    : fallbackVideo.direction.palette;
  const scenes = Array.isArray(plan.scenes) && plan.scenes.length
    ? plan.scenes.slice(0, 4).map((scene, index) => ({
        overlay: String(scene.overlay || fallbackVideo.scenes[index % fallbackVideo.scenes.length].overlay).slice(0, 48),
        voice: String(scene.voice || fallbackVideo.scenes[index % fallbackVideo.scenes.length].voice),
        seconds: Number(scene.seconds || 4),
        shot: scene.shot || fallbackVideo.scenes[index % fallbackVideo.scenes.length].shot || "topic"
      }))
    : fallbackVideo.scenes;
  return {
    source: "ai",
    title: String(plan.title || fallbackVideo.title),
    caption: String(plan.caption || fallbackVideo.caption),
    hashtags: String(plan.hashtags || fallbackVideo.hashtags),
    direction: {
      ...fallbackVideo.direction,
      ...direction,
      palette,
      props: direction.props || fallbackVideo.direction.props || "general",
      reference: direction.reference || fallbackVideo.direction.reference,
      camera: direction.camera || fallbackVideo.direction.camera
    },
    scenes,
    manualVideoUrl
  };
}

function buildBrowserAiPrompt(payload) {
  const topic = payload.topic || payload.trend?.title || "trend viral";
  const trendText = payload.trend ? JSON.stringify(payload.trend) : "{}";
  const learning = (state.learningNotes || [])
    .slice(0, 6)
    .map((note) => typeof note === "string" ? note : note.summary || "")
    .filter(Boolean)
    .join(" | ") || "Sin aprendizaje previo.";

  return `
Eres TokTrend, una IA que crea videos verticales para TikTok.
Tema: ${topic}
Trend: ${trendText}
Aprendizaje por comentarios: ${learning}

Devuelve solo JSON valido con esta forma:
{"title":"...","caption":"...","hashtags":"#... #TokTrend #IA #ParaTi","direction":{"props":"fitness|food|business|tech|beauty|general","palette":["#111111","#222222","#333333"],"reference":"...","camera":"..."},"scenes":[{"overlay":"...","voice":"...","seconds":4,"shot":"opening"},{"overlay":"...","voice":"...","seconds":4,"shot":"topic"},{"overlay":"...","voice":"...","seconds":4,"shot":"feedback"}]}

Reglas: exactamente 3 escenas, voz breve en espanol, hook inmediato, CTA a comentar, visuales cinematicos, hashtags utiles.
`;
}

function parseBrowserAiPlan(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("La IA no devolvio JSON valido");
  }
}

async function callOpenAIFromBrowser(input) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getBrowserAiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input,
      max_output_tokens: 900
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI no acepto la solicitud");
  }
  return data.output_text || (data.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("");
}

async function requestBrowserAiVideo(payload, fallbackVideo) {
  const text = await callOpenAIFromBrowser(buildBrowserAiPrompt(payload));
  aiOnline = true;
  state.aiOnline = true;
  state.aiProvider = "openai-web";
  saveState();
  return normalizeAiPlan(parseBrowserAiPlan(text), fallbackVideo, fallbackVideo.manualVideoUrl || "");
}

async function requestAiVideo(payload, fallbackVideo) {
  if (hasBrowserAiKey()) {
    return requestBrowserAiVideo(payload, fallbackVideo);
  }

  if (!shouldUseLocalBackend()) {
    throw new Error("El backend de TokTrend no esta disponible.");
  }

  const endpoint = `${apiBase()}/api/ai-video`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      learningNotes: state.learningNotes || []
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "La IA no respondio");
  }
  aiOnline = true;
  state.aiOnline = true;
  state.aiProvider = data.provider || "ia";
  saveState();
  return normalizeAiPlan(data.plan, fallbackVideo, fallbackVideo.manualVideoUrl || "");
}

async function requestAssistantReply(message) {
  if (hasBrowserAiKey()) {
    const currentContext = currentVideo
      ? `Video actual: ${currentVideo.title}. Caption: ${currentVideo.caption}. Hashtags: ${currentVideo.hashtags}.`
      : "No hay video actual.";
    const text = await callOpenAIFromBrowser(`
Eres el asistente de TokTrend. Responde en espanol, breve y practico.
${currentContext}
Notas de aprendizaje: ${latestLearningText()}
Usuario: ${message}
`);
    aiOnline = true;
    state.aiOnline = true;
    state.aiProvider = "openai-web";
    saveState();
    return text.trim();
  }

  if (!shouldUseLocalBackend()) {
    return localAssistantReply(message);
  }

  const endpoint = `${apiBase()}/api/assistant`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        messages: (state.assistantMessages || []).slice(-10),
        currentVideo: currentVideo ? {
          title: currentVideo.title,
          caption: currentVideo.caption,
          hashtags: currentVideo.hashtags
        } : null,
        learningNotes: state.learningNotes || []
      })
    });
  } catch {
    return localAssistantReply(message);
  }
  const data = await response.json();
  if (!response.ok || !data.ok) return localAssistantReply(message);
  aiOnline = data.provider !== "local";
  state.aiOnline = aiOnline;
  state.aiProvider = data.provider || "openai";
  saveState();
  return String(data.reply || "").trim();
}

function localAssistantReply(message) {
  const lower = message.toLowerCase();
  if (lower.includes("hook") || lower.includes("gancho")) {
    return "Hook: \"Esta IA esta aprendiendo a crear TikToks sola, y este es su siguiente intento\". Usalo como primera frase y muestra el resultado rapido.";
  }
  if (lower.includes("caption") || lower.includes("texto")) {
    return "Caption: \"Estoy probando como una IA mejora con comentarios reales. Dime que cambiarias del siguiente video.\"";
  }
  if (lower.includes("hashtag")) {
    return "Hashtags sugeridos: #TokTrend #IA #ParaTi #AICreator #TikTokTips #Automatizacion";
  }
  return "Puedo ayudarte con hooks, guion de 3 escenas, caption, hashtags o mejoras por comentarios. Si el backend local esta activo, uso IA remota; si no, mantengo el flujo local.";
}

function setBusy(isBusy, message = "Creando con IA...") {
  $("#renderMessage").textContent = message;
  $("#renderProgress").style.width = isBusy ? "35%" : "0%";
  $("#renderOverlay").classList.toggle("hidden", !isBusy);
}

function showVideo(video) {
  currentVideo = video;
  $("#resultPanel").classList.remove("hidden");
  $("#videoTitle").textContent = video.title;
  $("#videoCaption").textContent = video.caption;
  $("#videoHashtags").textContent = video.hashtags;
  $("#videoReference").textContent = video.direction.reference;
  $("#sceneOverlay").textContent = video.scenes[0].overlay;
  const [base, accent, accent2] = video.direction.palette;
  $("#phoneScene").style.background = `
    radial-gradient(circle at 45% 35%, ${accent}66, transparent 34%),
    radial-gradient(circle at 70% 70%, ${accent2}55, transparent 36%),
    linear-gradient(145deg, ${base}, ${shadeColor(base, 32)})
  `;

  const preview = $("#manualEditorPreview");
  if (video.manualVideoUrl) {
    preview.src = video.manualVideoUrl;
    preview.classList.remove("hidden");
    preview.play().catch(() => {});
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
  }

  state.videosCreated += 1;
  saveState();
  renderDialogList(video);
  renderStatus();
}

function renderDialogList(video) {
  const panel = $("#dialogPanel");
  const list = $("#dialogList");
  if (!panel || !list) return;
  panel.classList.remove("hidden");
  list.innerHTML = "";
  video.scenes.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "dialog-item";
    const title = document.createElement("strong");
    title.textContent = `Escena ${index + 1}: ${scene.overlay}`;
    const voice = document.createElement("p");
    voice.textContent = scene.voice;
    const meta = document.createElement("small");
    meta.textContent = `${scene.seconds || 4}s - ${scene.shot || "topic"}`;
    item.append(title, voice, meta);
    list.appendChild(item);
  });
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
  const trend = nextTrend();
  const fallback = buildVideoFromTrend(trend);
  setBusy(true, "Creando ciclo automatico...");

  try {
    const aiVideo = await requestAiVideo({ mode: "trend", trend }, fallback);
    showVideo(aiVideo);
  } catch {
    showVideo(fallback);
  } finally {
    setBusy(false);
  }

  if (state.connected) {
    await publishToTikTok();
  }

  state.nextPublicationAt = Date.now() + Number(state.periodMinutes || 60) * 60 * 1000;
  saveState();
  schedulePublicationCycle();
  renderStatus();
}

function getCinematicDirection(topic) {
  const normalized = topic.toLowerCase();
  const style = Object.values(cinematicStyles).find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword))
  ) || cinematicStyles.general;
  return {
    ...style,
    topic,
    camera: "push-in lento, cortes cada 2 segundos, profundidad de campo falsa y texto de alto contraste"
  };
}

async function createAutoVideo() {
  const trend = nextTrend();
  const fallback = buildVideoFromTrend(trend);
  setBusy(true, "La IA esta creando el guion cinematico...");
  try {
    const aiVideo = await requestAiVideo({ mode: "trend", trend }, fallback);
    showVideo(aiVideo);
  } catch (error) {
    aiOnline = false;
    state.aiOnline = false;
    saveState();
    showToast(`La IA no respondio: ${error.message}. Se uso el generador local como respaldo.`, "warning");
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
  const fallback = buildManualVideo(topic, "");
  setBusy(true, "La IA esta creando el video sobre tu tema...");
  try {
    const aiVideo = await requestAiVideo({ mode: "manual", topic }, fallback);
    showVideo(aiVideo);
  } catch (error) {
    aiOnline = false;
    state.aiOnline = false;
    saveState();
    showToast(`La IA no respondio: ${error.message}. Se uso el generador local como respaldo.`, "warning");
    showVideo(fallback);
  } finally {
    setBusy(false);
    renderStatus();
  }
}

function previewVoice() {
  if (!currentVideo || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentVideo.scenes.map((scene) => scene.voice).join(" "));
  utterance.lang = "es-ES";
  utterance.rate = 0.92;
  utterance.pitch = 0.95;
  utterance.volume = 0.9;
  speechSynthesis.speak(utterance);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
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

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCinematicReference(ctx, canvas, video, scene, progress) {
  const width = canvas.width;
  const height = canvas.height;
  const direction = video.direction || cinematicStyles.general;
  const [base, accent, accent2] = direction.palette;
  const push = 1 + progress * 0.08;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, base);
  bg.addColorStop(0.55, shadeColor(base, 34));
  bg.addColorStop(1, shadeColor(accent, -55));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(push, push);
  ctx.translate(-width / 2, -height / 2);

  drawLightSweep(ctx, width, height, accent, progress);
  if (direction.props === "fitness") drawFitnessSet(ctx, width, height, accent, accent2, progress);
  else if (direction.props === "food") drawFoodSet(ctx, width, height, accent, accent2, progress);
  else if (direction.props === "business") drawBusinessSet(ctx, width, height, accent, accent2, progress);
  else if (direction.props === "tech") drawTechSet(ctx, width, height, accent, accent2, progress);
  else if (direction.props === "beauty") drawBeautySet(ctx, width, height, accent, accent2, progress);
  else drawGeneralSet(ctx, width, height, accent, accent2, progress);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, width, 170);
  ctx.fillRect(0, height - 250, width, 250);
}

function drawLightSweep(ctx, width, height, color, progress) {
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = color;
  ctx.translate(width * (0.1 + progress * 0.8), height * 0.18);
  ctx.rotate(-0.45);
  ctx.fillRect(-80, -height, 120, height * 2);
  ctx.restore();
}

function drawFitnessSet(ctx, width, height, accent, accent2, progress) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 24;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.22, height * 0.45);
  ctx.lineTo(width * 0.78, height * 0.45);
  ctx.stroke();
  ctx.fillStyle = accent2;
  [0.18, 0.82].forEach((x) => {
    ctx.fillRect(width * x - 38, height * 0.39, 76, 150);
    ctx.fillRect(width * x - 68, height * 0.42, 136, 95);
  });
  drawPulseCircle(ctx, width * 0.5, height * 0.68, 180, accent, progress);
}

function drawFoodSet(ctx, width, height, accent, accent2, progress) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, width * 0.14, height * 0.56, width * 0.72, 120, 40);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.54, 210, 95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent2;
  for (let i = 0; i < 10; i++) {
    const angle = i * 0.62 + progress * 1.8;
    ctx.beginPath();
    ctx.arc(width * 0.5 + Math.cos(angle) * 150, height * 0.54 + Math.sin(angle) * 55, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  drawSteam(ctx, width, height, progress);
}

function drawBusinessSet(ctx, width, height, accent, accent2, progress) {
  ctx.strokeStyle = accent2;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(width * 0.18, height * 0.7);
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(width * (0.18 + i * 0.12), height * (0.68 - i * 0.055 - Math.sin(progress * 4 + i) * 0.015));
  }
  ctx.stroke();
  ctx.fillStyle = accent;
  for (let i = 0; i < 5; i++) {
    const barHeight = 120 + i * 70 + progress * 30;
    ctx.fillRect(width * (0.22 + i * 0.12), height * 0.78 - barHeight, 52, barHeight);
  }
}

function drawTechSet(ctx, width, height, accent, accent2, progress) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (let y = 260; y < height - 260; y += 90) {
    ctx.beginPath();
    ctx.moveTo(80, y + Math.sin(progress * 5 + y) * 16);
    ctx.lineTo(width - 80, y + Math.cos(progress * 4 + y) * 16);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, width * 0.22, height * 0.34, width * 0.56, 330, 28);
  ctx.fill();
  ctx.strokeStyle = accent2;
  ctx.stroke();
}

function drawBeautySet(ctx, width, height, accent, accent2, progress) {
  const x = width * 0.5;
  const y = height * 0.5;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(x, y, 145, 250, progress * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent2;
  ctx.beginPath();
  ctx.ellipse(x + 70, y - 30, 58, 180, -0.2, 0, Math.PI * 2);
  ctx.fill();
  drawPulseCircle(ctx, x - 20, y + 20, 260, accent2, progress);
}

function drawGeneralSet(ctx, width, height, accent, accent2, progress) {
  drawPulseCircle(ctx, width * 0.5, height * 0.44, 250, accent, progress);
  ctx.fillStyle = accent2;
  for (let i = 0; i < 5; i++) {
    roundRect(ctx, width * (0.16 + i * 0.12), height * (0.32 + Math.sin(progress * 3 + i) * 0.05), 70, 210, 18);
    ctx.fill();
  }
}

function drawPulseCircle(ctx, x, y, radius, color, progress) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(x, y, radius + Math.sin(progress * Math.PI * 2) * 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSteam(ctx, width, height, progress) {
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const x = width * (0.36 + i * 0.09);
    ctx.moveTo(x, height * 0.42);
    ctx.bezierCurveTo(x + Math.sin(progress * 5 + i) * 50, height * 0.34, x - 40, height * 0.29, x + 20, height * 0.22);
    ctx.stroke();
  }
}

function shadeColor(hex, percent) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function drawFrame(ctx, canvas, video, scene, progress, sourceVideo) {
  const width = canvas.width;
  const height = canvas.height;

  drawCinematicReference(ctx, canvas, video, scene, progress);

  if (sourceVideo && sourceVideo.readyState >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.drawImage(sourceVideo, 0, 0, width, height);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(ctx, 60, 70, width - 120, 90, 24);
  ctx.fill();
  ctx.fillStyle = "#20e0d0";
  ctx.font = "800 34px Arial";
  ctx.fillText("TokTrend", 95, 128);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(video.hashtags.split(" ")[0], width - 95, 128);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  roundRect(ctx, 70, height - 620, width - 140, 380, 32);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 76px Arial";
  wrapText(ctx, scene.overlay.toUpperCase(), width - 190).slice(0, 3)
    .forEach((line, index) => ctx.fillText(line, width / 2, height - 500 + index * 84));

  ctx.font = "500 36px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  wrapText(ctx, scene.voice, width - 200).slice(0, 4)
    .forEach((line, index) => ctx.fillText(line, width / 2, height - 285 + index * 45));

  ctx.fillStyle = "#ff375f";
  ctx.fillRect(90, height - 118, (width - 180) * progress, 8);
  ctx.textAlign = "left";
}

async function downloadVideo() {
  if (!currentVideo) {
    showToast("Primero crea un video.", "warning");
    return;
  }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    showToast("Tu navegador no soporta render de video. Usa Chrome o Edge actualizado.", "error");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];

  let sourceVideo = null;
  if (currentVideo.manualVideoUrl) {
    sourceVideo = document.createElement("video");
    sourceVideo.src = currentVideo.manualVideoUrl;
    sourceVideo.muted = true;
    sourceVideo.loop = true;
    await sourceVideo.play().catch(() => {});
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  $("#renderOverlay").classList.remove("hidden");
  $("#renderProgress").style.width = "0%";
  recorder.start();

  const fps = 30;
  const totalFrames = currentVideo.scenes.reduce((sum, scene) => sum + scene.seconds * fps, 0);
  let frame = 0;

  for (const scene of currentVideo.scenes) {
    const sceneFrames = scene.seconds * fps;
    for (let i = 0; i < sceneFrames; i++) {
      const progress = i / sceneFrames;
      drawFrame(ctx, canvas, currentVideo, scene, progress, sourceVideo);
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
  if (sourceVideo) sourceVideo.pause();

  lastBlob = new Blob(chunks, { type: "video/webm" });
  const url = URL.createObjectURL(lastBlob);
  const link = $("#lastVideoLink");
  link.href = url;
  link.classList.remove("hidden");
  link.click();

  state.learningNotes.unshift(`El ultimo video pidio comentarios para corregir enfoque, tema y claridad.`);
  state.learningNotes = state.learningNotes.slice(0, 10);
  saveState();
  $("#renderOverlay").classList.add("hidden");
}

async function renderVideoBlobOnly() {
  if (!currentVideo) {
    throw new Error("Primero crea un video.");
  }
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
      drawFrame(ctx, canvas, currentVideo, scene, i / sceneFrames, null);
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

  if (!shouldUseLocalBackend()) {
    showToast("En HTTPS puedes crear y descargar el video. La publicacion directa en TikTok requiere el servidor local.", "warning");
    return;
  }

  await checkAiHealth();
  if (!state.connected) {
    showToast("Conecta TikTok antes de publicar. El video ya puede crearse y descargarse localmente.", "warning");
    return;
  }

  $("#renderOverlay").classList.remove("hidden");
  $("#renderMessage").textContent = "Creando video para TikTok...";
  $("#renderProgress").style.width = "0%";
  try {
    const blob = lastBlob || await renderVideoBlobOnly();
    lastBlob = blob;
    $("#renderMessage").textContent = "Subiendo a TikTok...";
    $("#renderProgress").style.width = "65%";
    const videoDataUrl = await blobToDataUrl(blob);
    const endpoint = `${apiBase()}/api/tiktok/publish`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoDataUrl,
        title: currentVideo.title,
        caption: currentVideo.caption,
        hashtags: currentVideo.hashtags
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "TikTok no acepto la publicacion");
    }
    $("#renderProgress").style.width = "100%";
    showToast(`Video enviado a TikTok. Publish ID: ${data.result.publishId}`, "success");
  } catch (error) {
    showToast(`No se pudo publicar en TikTok: ${error.message}`, "error");
  } finally {
    $("#renderOverlay").classList.add("hidden");
  }
}

function showToast(message, type = "info") {
  let toast = document.querySelector("#toktrendToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toktrendToast";
    toast.style.position = "fixed";
    toast.style.right = "24px";
    toast.style.bottom = "24px";
    toast.style.maxWidth = "420px";
    toast.style.padding = "14px 16px";
    toast.style.borderRadius = "14px";
    toast.style.font = "600 14px/1.4 Arial, sans-serif";
    toast.style.color = "#fff";
    toast.style.zIndex = "9999";
    toast.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
    document.body.appendChild(toast);
  }

  const colors = {
    info: "#1f2937",
    success: "#047857",
    warning: "#92400e",
    error: "#991b1b"
  };

  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(window.__toktrendToastTimer);
  window.__toktrendToastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 6500);
}

function renderStatus() {
  $("#connectionStatus").textContent = state.connected ? "TikTok" : "Local";
  $("#aiStatus").textContent = state.aiOnline ? providerLabel(state.aiProvider) : "Local";
  $("#periodStatus").textContent = formatPeriod(state.periodMinutes);
  $("#videoCount").textContent = state.videosCreated;
  $("#periodSelect").value = String(state.periodMinutes);
  const keyInput = $("#browserAiKeyInput");
  if (keyInput) keyInput.placeholder = hasBrowserAiKey() ? "IA web activa en esta sesion" : "sk-...";
  renderLearningSummary();
  renderAssistantMessages();
}

function providerLabel(provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "openai-web") return "OpenAI Web";
  if (provider === "gemini") return "Gemini";
  if (provider === "auto") return "Auto";
  return "IA";
}

async function refreshCurrentWithAi() {
  if (!currentVideo) {
    showToast("Primero crea un video.", "warning");
    return;
  }
  const topic = currentVideo.title.replace(/^Video manual: /, "").replace(/^TokTrend detecto: /, "");
  const fallback = currentVideo;
  setBusy(true, "La IA esta mejorando el video...");
  try {
    const improved = await requestAiVideo({ mode: currentVideo.source || "manual", topic }, fallback);
    showVideo(improved);
  } catch (error) {
    aiOnline = false;
    state.aiOnline = false;
    saveState();
    showToast(`No se pudo mejorar con IA: ${error.message}. El video actual se conserva.`, "warning");
  } finally {
    setBusy(false);
    renderStatus();
  }
}

function analyzeComments() {
  const input = $("#commentsInput");
  if (!input) return;

  const raw = input.value.trim();
  if (!raw) {
    showToast("Escribe algunos comentarios para analizarlos.", "warning");
    return;
  }

  const comments = raw
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const positiveWords = /(bueno|excelente|me gusta|genial|perfecto|viral|increible|gracioso|util|interesante)/i;
  const negativeWords = /(malo|aburrido|no me gusta|lento|feo|confuso|mucho texto|sin gracia|repetido|cansado)/i;
  const suggestionWords = /(deberia|podria|haz|has otro|quiero|me gustaria|pon|agrega|quita|explica|\?)/i;

  let positives = 0;
  let negatives = 0;
  const suggestions = [];

  for (const comment of comments) {
    if (positiveWords.test(comment)) positives += 1;
    if (negativeWords.test(comment)) negatives += 1;
    if (suggestionWords.test(comment)) suggestions.push(comment);
  }

  const summary = `Comentarios analizados: ${comments.length}. Positivos: ${positives}. Negativos: ${negatives}. Sugerencias detectadas: ${suggestions.length}.`;

  state.learningNotes = state.learningNotes || [];
  state.learningNotes.unshift({
    date: new Date().toISOString(),
    summary,
    suggestions: suggestions.slice(0, 5)
  });
  state.learningNotes = state.learningNotes.slice(0, 10);

  saveState();
  input.value = "";
  renderLearningSummary();
  showToast("Comentarios analizados y notas de aprendizaje actualizadas.", "success");
}

function renderAssistantMessages() {
  const container = $("#assistantMessages");
  if (!container) return;

  const messages = state.assistantMessages || [];
  container.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("div");
    item.className = `assistant-message ${message.role === "user" ? "from-user" : "from-assistant"}`;
    item.textContent = message.content;
    container.appendChild(item);
  }
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
    const reply = await requestAssistantReply(message);
    addAssistantMessage("assistant", reply);
    renderStatus();
  } catch (error) {
    aiOnline = false;
    state.aiOnline = false;
    saveState();
    addAssistantMessage("assistant", `No pude conectar con la IA ahora: ${error.message}`);
    showToast(`El asistente no respondio: ${error.message}`, "warning");
    renderStatus();
  } finally {
    button.disabled = false;
    button.textContent = "Enviar";
  }
}

function bindEvents() {
  $("#connectTikTokBtn").addEventListener("click", connectTikTok);
  $("#savePeriodBtn").addEventListener("click", savePeriod);
  $("#periodSelect").addEventListener("change", savePeriod);
  $("#autoVideoBtn").addEventListener("click", createAutoVideo);
  $("#manualVideoBtn").addEventListener("click", createManualVideo);
  $("#previewVoiceBtn").addEventListener("click", previewVoice);
  $("#refreshAiBtn").addEventListener("click", refreshCurrentWithAi);
  $("#downloadVideoBtn").addEventListener("click", () => {
    downloadVideo().catch((error) => showToast(`No se pudo crear el video: ${error.message}`, "error"));
  });
  $("#publishTikTokBtn").addEventListener("click", () => {
    publishToTikTok().catch((error) => {
      showToast(`No se pudo publicar en TikTok: ${error.message}`, "error");
    });
  });
  const analyzeBtn = $("#analyzeCommentsBtn");
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeComments);
  }
  const assistantForm = $("#assistantForm");
  if (assistantForm) {
    assistantForm.addEventListener("submit", sendAssistantMessage);
  }
  const saveAiKeyBtn = $("#saveBrowserAiKeyBtn");
  if (saveAiKeyBtn) saveAiKeyBtn.addEventListener("click", saveBrowserAiKey);
  const clearAiKeyBtn = $("#clearBrowserAiKeyBtn");
  if (clearAiKeyBtn) clearAiKeyBtn.addEventListener("click", clearBrowserAiKey);
}

bindEvents();
renderStatus();
checkAiHealth();
schedulePublicationCycle();

console.log(`
INSTRUCCIONES DE DESARROLLO TOKTREND:
- Analizar comentarios y metricas para mejorar proximos videos.
- Comparar resultados entre videos para detectar que hooks funcionan mejor.
- Usar A/B testing de titulos, captions, duracion y estilo visual.
- Priorizar retencion, claridad, gancho inicial y llamadas a comentar.
- Mantener fallback local cuando OpenAI, Gemini o TikTok fallen.
- Preparar arquitectura futura por modulos: generacion, edicion, analisis, programacion y publicacion.
- Guia agency-agents aplicada: hook en 3 segundos, video vertical, 5 a 8 hashtags, feedback accionable y optimizacion por retencion.
`);
