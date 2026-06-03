const trendTemplate = document.querySelector('#trendTemplate');
const trendsEl = document.querySelector('#trends');
const queueEl = document.querySelector('#queue');
const logsEl = document.querySelector('#logs');
const queueCountEl = document.querySelector('#queueCount');
const trendStatusEl = document.querySelector('#trendStatus');
const scanBtn = document.querySelector('#scanBtn');
const demoBtn = document.querySelector('#demoBtn');
const clearLogsBtn = document.querySelector('#clearLogs');
const categoryEl = document.querySelector('#category');
const seedEl = document.querySelector('#seed');
const apiKeyEl = document.querySelector('#apiKey');

const state = {
  trends: [],
  queue: JSON.parse(localStorage.getItem('toktrend.queue') || '[]'),
  apiKey: localStorage.getItem('toktrend.apiKey') || ''
};

apiKeyEl.value = state.apiKey;

const trendBanks = {
  'Tech & Gadgets': ['AI agents', 'mobile automation', 'smart workflows', 'prompt engineering', 'app builders'],
  'Lifestyle & Hacks': ['daily routine', 'productivity hack', 'budget setup', 'phone shortcuts', 'micro learning'],
  Music: ['viral hook', 'corrido trend', 'AI music', 'studio workflow', 'release strategy'],
  Comedy: ['POV técnico', 'fails de oficina', 'IA aprendiendo', 'expectativa vs realidad', 'mini sketch'],
  Business: ['side hustle', 'creator economy', 'automation stack', 'lead generation', 'market test'],
  Gaming: ['NPC challenge', 'speedrun edit', 'setup review', 'AI teammate', 'clip reaction']
};

function now() {
  return new Date().toLocaleString('es-MX', { hour12: false });
}

function log(message) {
  logsEl.textContent += `[${now()}] ${message}\n`;
  logsEl.scrollTop = logsEl.scrollHeight;
}

function saveQueue() {
  localStorage.setItem('toktrend.queue', JSON.stringify(state.queue));
}

function scoreFor(index) {
  return Math.max(61, Math.min(98, 92 - index * 7 + Math.floor(Math.random() * 9)));
}

function buildTrends() {
  const category = categoryEl.value;
  const seed = seedEl.value.trim() || 'IA creando videos sola';
  const bank = trendBanks[category] || trendBanks['Tech & Gadgets'];

  state.trends = bank.map((topic, index) => ({
    id: crypto.randomUUID(),
    title: `${topic} + ${seed}`,
    description: `Idea de contenido para ${category}: gancho rápido, demostración visual y cierre con aprendizaje para el siguiente video.`,
    score: scoreFor(index),
    tags: ['#TokTrend', '#AI', `#${category.replaceAll(' ', '')}`, '#TikTok']
  })).sort((a, b) => b.score - a.score);

  trendStatusEl.textContent = `${state.trends.length} detectadas`;
  log(`Análisis completado para categoría: ${category}`);
  renderTrends();
}

function createCampaign(trend) {
  const script = `Soy una inteligencia artificial y estoy aprendiendo a crear videos. Hoy detecté esta tendencia: ${trend.title}. Voy a probar un gancho, medir resultados y mejorar el siguiente video.`;
  const item = {
    id: crypto.randomUUID(),
    title: trend.title,
    status: 'Borrador',
    platform: 'TikTok',
    createdAt: now(),
    hook: script,
    checklist: ['Gancho 0-3s', 'Subtítulos grandes', 'CTA suave', 'Comparar rendimiento']
  };
  state.queue.unshift(item);
  saveQueue();
  renderQueue();
  log(`Campaña creada: ${trend.title}`);
}

function createDemoVideo() {
  const seed = seedEl.value.trim() || 'mi primer día creando videos yo solo';
  createCampaign({ title: `Demo TokTrend: ${seed}`, score: 88, tags: ['#TokTrend'] });
}

function renderTrends() {
  trendsEl.innerHTML = '';
  state.trends.forEach((trend) => {
    const node = trendTemplate.content.cloneNode(true);
    node.querySelector('.score').textContent = trend.score;
    node.querySelector('h3').textContent = trend.title;
    node.querySelector('p').textContent = trend.description;
    const tags = node.querySelector('.tags');
    trend.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tags.append(span);
    });
    node.querySelector('button').addEventListener('click', () => createCampaign(trend));
    trendsEl.append(node);
  });
}

function renderQueue() {
  queueCountEl.textContent = state.queue.length;
  if (!state.queue.length) {
    queueEl.className = 'cards empty';
    queueEl.textContent = 'No hay videos todavía.';
    return;
  }
  queueEl.className = 'cards';
  queueEl.innerHTML = '';
  state.queue.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'queue-card';
    card.innerHTML = `
      <strong>${item.title}</strong>
      <p>${item.hook}</p>
      <div class="meta">
        <span>${item.status}</span>
        <span>${item.platform}</span>
        <span>${item.createdAt}</span>
      </div>
      <div class="tags">${item.checklist.map(x => `<span class="tag">${x}</span>`).join('')}</div>
      <div class="row" style="margin-top:10px">
        <button class="tiny" data-copy="${item.id}">Copiar guion</button>
        <button class="tiny" data-done="${item.id}">Marcar listo</button>
        <button class="tiny" data-delete="${item.id}">Eliminar</button>
      </div>
    `;
    queueEl.append(card);
  });
}

queueEl.addEventListener('click', async (event) => {
  const copyId = event.target.dataset.copy;
  const doneId = event.target.dataset.done;
  const deleteId = event.target.dataset.delete;
  if (copyId) {
    const item = state.queue.find(x => x.id === copyId);
    await navigator.clipboard.writeText(item.hook);
    log(`Guion copiado: ${item.title}`);
  }
  if (doneId) {
    const item = state.queue.find(x => x.id === doneId);
    item.status = 'Listo para publicar';
    saveQueue();
    renderQueue();
    log(`Video marcado como listo: ${item.title}`);
  }
  if (deleteId) {
    state.queue = state.queue.filter(x => x.id !== deleteId);
    saveQueue();
    renderQueue();
    log('Elemento eliminado de la cola.');
  }
});

apiKeyEl.addEventListener('change', () => {
  state.apiKey = apiKeyEl.value.trim();
  localStorage.setItem('toktrend.apiKey', state.apiKey);
  log(state.apiKey ? 'API key guardada localmente.' : 'API key eliminada.');
});

scanBtn.addEventListener('click', buildTrends);
demoBtn.addEventListener('click', createDemoVideo);
clearLogsBtn.addEventListener('click', () => { logsEl.textContent = ''; });

document.querySelectorAll('.bottom-nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.bottom-nav a').forEach(x => x.classList.remove('active'));
    link.classList.add('active');
    const tab = link.dataset.tab;
    if (tab === 'trends') document.querySelector('.grid').scrollIntoView({ behavior: 'smooth' });
    if (tab === 'queue') document.querySelector('.grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (tab === 'logs') document.querySelector('.terminal-panel').scrollIntoView({ behavior: 'smooth' });
    if (tab === 'settings') document.querySelector('.control-panel').scrollIntoView({ behavior: 'smooth' });
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => log('PWA lista para instalación/offline.')).catch(() => log('Service worker no disponible.'));
  });
}

buildTrends();
renderQueue();
log('TokTrend Web App iniciada.');
