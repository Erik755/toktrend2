import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Cpu, 
  CheckCircle, 
  Clock, 
  Volume2, 
  Play, 
  Pause, 
  TrendingUp, 
  HelpCircle, 
  Heart, 
  MessageCircle, 
  Share2, 
  Plus, 
  ChevronRight, 
  Image as ImageIcon, 
  Eye, 
  Trash, 
  Settings, 
  ShieldCheck, 
  ListChecks, 
  BarChart2, 
  Users, 
  Zap, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { Trend, TikTokVideo, AgentConfig, TikTokAccount } from './types';

export default function App() {
  // State variables synchronized with backend
  const [trends, setTrends] = useState<Trend[]>([]);
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<TikTokVideo | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    intervalHours: 1,
    isEnabled: true,
    selectedCategories: ["Historia", "Tecnología", "Curiosidades"]
  });

  // UI Local States
  const [promptTopic, setPromptTopic] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isScanningTrends, setIsScanningTrends] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('Todas');
  const [connectionStatus, setConnectionStatus] = useState<boolean>(true);
  const [showTokenManager, setShowTokenManager] = useState<boolean>(false);
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);

  // Video Simulator Player state
  const [playingSceneIdx, setPlayingSceneIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isVoiceSynthesisActive, setIsVoiceSynthesisActive] = useState<boolean>(false);
  const [isRenderingAIImage, setIsRenderingAIImage] = useState<boolean>(false);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'control' | 'analytics' | 'history'>('control');

  // Slide interval refs
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial database state on load
  useEffect(() => {
    fetchTrends();
    fetchVideos();
    fetchAgentStatus();

    // Constant status checking for simulating AI telemetry every 10 seconds
    const interval = setInterval(() => {
      fetchAgentStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Sync slides with playback
  useEffect(() => {
    if (isPlaying && activeVideo && activeVideo.storyboard.length > 0) {
      const sceneDuration = Math.max(3000, (activeVideo.duration * 1000) / activeVideo.storyboard.length);
      slideshowTimerRef.current = setTimeout(() => {
        setPlayingSceneIdx((prev) => {
          if (prev >= activeVideo.storyboard.length - 1) {
            // End of script
            setIsPlaying(false);
            if (isVoiceSynthesisActive) {
              window.speechSynthesis?.cancel();
              setIsVoiceSynthesisActive(false);
            }
            return 0;
          }
          return prev + 1;
        });
      }, sceneDuration);
    } else {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    }

    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  }, [isPlaying, playingSceneIdx, activeVideo, isVoiceSynthesisActive]);

  // Methods
  const fetchTrends = async () => {
    setIsScanningTrends(true);
    addLog("Escaneando el algoritmo de TikTok...");
    try {
      const response = await fetch('/api/trends');
      const data = await response.json();
      if (data.trends) {
        setTrends(data.trends);
        addLog("Nuevas tendencias extraídas directamente utilizando Gemini Search Grounding.");
      }
    } catch (e) {
      console.error(e);
      addLog("Fallo de conexión con la IA. Cargando tendencias de respaldo locales.");
    } finally {
      setIsScanningTrends(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos');
      const data = await response.json();
      if (data.videos) {
        setVideos(data.videos);
        // Set first video as active if none selected
        if (data.videos.length > 0 && !activeVideo) {
          setActiveVideo(data.videos[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/agent-status');
      const data = await response.json();
      if (data.agentConfig) {
        setAgentConfig(data.agentConfig);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAgentConfig = async (updatedFields: Partial<AgentConfig>) => {
    try {
      const response = await fetch('/api/agent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...agentConfig, ...updatedFields })
      });
      const data = await response.json();
      if (data.success && data.agentConfig) {
        setAgentConfig(data.agentConfig);
        addLog(`Configuración autónoma modificada. Publicando cada ${data.agentConfig.intervalHours}h.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptTopic.trim()) return;

    setIsGenerating(true);
    addLog(`Generando guion creativo sobre: "${promptTopic}"...`);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: promptTopic,
          trendUsed: selectedTrendId ? trends.find(t => t.id === selectedTrendId)?.hashtag : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        addLog(`Guión de vídeo y storyboard para TikTok estructurados por Gemini. Rápido y optimizado.`);
        setPromptTopic('');
        setSelectedTrendId(null);
        await fetchVideos(); // Refresh list to get top new active
        
        // Find newly added video and set it
        if (data.video) {
          setActiveVideo(data.video);
          setPlayingSceneIdx(0);
        }
      }
    } catch (e) {
      console.error(e);
      addLog("Hubo un problema al contactar con el generador de IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    addLog("Iniciando publicación directa y segura en la API de TikTok...");
    try {
      const response = await fetch(`/api/publish/${id}`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        addLog(`¡Éxito! Post '${data.video.title}' publicado orgánicamente en tu cuenta de TikTok.`);
        fetchVideos();
        // Update active video metrics
        if (activeVideo && activeVideo.id === id) {
          setActiveVideo(data.video);
        }
      }
    } catch (e) {
      console.error(e);
      addLog("La conexión de red de publicación falló inesperadamente.");
    }
  };

  const handleGenerateAIImage = async () => {
    if (!activeVideo) return;
    const currentScene = activeVideo.storyboard[playingSceneIdx];
    if (!currentScene) return;

    setIsRenderingAIImage(true);
    addLog(`Invocando a gemini-2.5-flash-image para renderizar la escena ${currentScene.sceneNum}...`);
    try {
      const response = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentScene.instruction })
      });
      const data = await response.json();
      if (data.imageUrl) {
        // Update video list and active local state
        const updatedStoryboard = activeVideo.storyboard.map((item, idx) => {
          if (idx === playingSceneIdx) {
            return { ...item, imageUrl: data.imageUrl };
          }
          return item;
        });

        const updatedVideo = { ...activeVideo, storyboard: updatedStoryboard };
        setActiveVideo(updatedVideo);
        setVideos(prev => prev.map(v => v.id === activeVideo.id ? updatedVideo : v));
        addLog(`Imagen de la escena ${currentScene.sceneNum} regenerada con IA vertical 9:16.`);
      }
    } catch (err) {
      console.error(err);
      addLog("Error al renderizar el lienzo 9:16 con Gemini Imagen.");
    } finally {
      setIsRenderingAIImage(false);
    }
  };

  const toggleNarratorVoice = () => {
    if (!activeVideo) return;

    if (isVoiceSynthesisActive) {
      window.speechSynthesis?.cancel();
      setIsVoiceSynthesisActive(false);
      setIsPlaying(false);
    } else {
      setIsVoiceSynthesisActive(true);
      setIsPlaying(true);

      // Web speech synthesis in Spanish
      const utterance = new SpeechSynthesisUtterance(activeVideo.script);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05; // Slightly faster for energetic TikTok delivery

      // Try to find a nice male or female Spanish voice if available
      const voices = window.speechSynthesis?.getVoices();
      const spanishVoice = voices?.find(v => v.lang.includes('es'));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onend = () => {
        setIsVoiceSynthesisActive(false);
        setIsPlaying(false);
        setPlayingSceneIdx(0);
      };

      utterance.onerror = () => {
        setIsVoiceSynthesisActive(false);
        setIsPlaying(false);
      };

      window.speechSynthesis?.speak(utterance);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    setRenderLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 50)]);
  };

  const handleSelectTrend = (trend: Trend) => {
    setSelectedTrendId(trend.id);
    setPromptTopic(trend.suggestedTopic);
    addLog(`Tendencia seleccionada: ${trend.hashtag}. Tema recomendado cargado en Creación Manual.`);
  };

  // Filter trends
  const filteredTrends = trends.filter(trend => {
    if (activeCategoryFilter === 'Todas') return true;
    return trend.category === activeCategoryFilter;
  });

  // Calculate high-level simulated metrics
  const totalViewsSim = videos
    .filter(v => v.status === 'published')
    .reduce((acc, current) => acc + (current.metrics?.views || 0), 1200000);

  const totalLikesSim = videos
    .filter(v => v.status === 'published')
    .reduce((acc, current) => acc + (current.metrics?.likes || 0), 84200);

  return (
    <div id="toktrend-root" className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/30">
      
      {/* Premium Astro Header */}
      <header id="toktrend-header" className="sticky top-0 z-50 bg-[#0a0a0c]/85 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 sm:px-6 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-[#7213ff] to-fuchsia-500 p-[2px] shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <div className="w-full h-full bg-[#0d0d11] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 id="brand-title" className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                TOKTREND
              </h1>
              <span className="text-[10px] tracking-widest font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 font-bold">
                AGENT ENGINE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Automatización de TikTok impulsada por IA en Español</p>
          </div>
        </div>

        {/* Connection Token Control */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            id="auth-manage-btn"
            onClick={() => setShowTokenManager(!showTokenManager)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              connectionStatus 
                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/30' 
                : 'bg-rose-950/20 text-rose-400 border-rose-800/40 hover:bg-rose-900/30'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></div>
            <span className="hidden sm:inline">TikTok:</span>
            {connectionStatus ? 'Conectado' : 'Desconectado'}
          </button>

          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shadow">
            <img 
              alt="TokTrend Creator Avatar" 
              className="w-full h-full object-cover"
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" 
            />
          </div>
        </div>
      </header>

      {/* Sub-Header Widget indicating Agent Live Operations */}
      <div className="bg-[#0b0c10] border-b border-zinc-800/40 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="text-zinc-400 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#7213ff]" />
            <span>Estado del Agente Autónomo:</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#7213ff] font-bold animate-pulse">{agentConfig.currentTaskStatus || "ESCUCHANDO ALGORITMOS..."}</span>
            {agentConfig.isEnabled && (
              <div className="w-24 bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-400 to-[#7213ff] h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${agentConfig.currentTaskPercent || 24}%` }}
                ></div>
              </div>
            )}
            <span className="text-zinc-500">[{agentConfig.currentTaskPercent || 24}%]</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-400">Próxima publicación automática:</span>
          <span className="text-cyan-400 font-mono font-semibold">
            {agentConfig.isEnabled ? "00:42:15" : "En pausa"}
          </span>
        </div>
      </div>

      {/* Interactive Authorization / Secret Key Overlay */}
      {showTokenManager && (
        <div id="auth-modal" className="bg-[#0d0d12] border-b border-cyan-800/20 p-4 sm:p-6 transition-all duration-300">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Consola de Integración Segura API TikTok
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Conecta con OAuth, gestiona tus tokens locales e introduce tus variables de entorno con total seguridad.</p>
              </div>
              <button 
                onClick={() => setShowTokenManager(false)}
                className="text-xs text-zinc-400 hover:text-white font-mono bg-zinc-800/60 px-2 py-1 rounded"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 space-y-2">
                <span className="text-[10px] tracking-wider text-[#7213ff] uppercase font-bold block">Conexión de Cuenta</span>
                <div className="text-center py-2">
                  <p className="text-xs text-zinc-300">Usuario Activo: <strong className="text-zinc-100">@toktrend_creator</strong></p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Seguidores: 14.2K · Me gusta: 254K</p>
                </div>
                <button 
                  onClick={() => setConnectionStatus(!connectionStatus)}
                  className={`w-full py-1.5 rounded text-xs font-semibold ${
                    connectionStatus 
                      ? 'bg-rose-950/40 text-rose-400 hover:bg-rose-900/40 border border-rose-800/40' 
                      : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-800/40'
                  }`}
                >
                  {connectionStatus ? "Desconectar Cuenta" : "Autenticar con TikTok"}
                </button>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 space-y-2">
                <span className="text-[10px] tracking-wider text-cyan-400 uppercase font-bold block">Protección y Cifrado</span>
                <div className="text-xs text-zinc-400 space-y-1 bg-zinc-950/50 p-2 rounded text-[11px]">
                  <p>✓ Cifrado Simétrico AES-256</p>
                  <p>✓ OAuth 2.0 integrado en el back</p>
                  <p>✓ Client Secret e ID protegidos</p>
                  <p>✓ Rotación automática de tokens</p>
                </div>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 space-y-2">
                <span className="text-[10px] tracking-wider text-fuchsia-400 uppercase font-bold block">Métricas Totales Estimadas</span>
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-zinc-950/60 p-1.5 rounded">
                    <p className="text-[10px] text-zinc-400">Alcance Total</p>
                    <p className="text-xs font-bold text-cyan-400">{(totalViewsSim / 1000000).toFixed(1)}M</p>
                  </div>
                  <div className="bg-zinc-950/60 p-1.5 rounded">
                    <p className="text-[10px] text-zinc-400">Me Gusta</p>
                    <p className="text-xs font-bold text-fuchsia-400">{(totalLikesSim / 1000).toFixed(1)}K</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout containing both Desktop Sidebar-Grid, Phone Simulator, and responsive elements */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:px-6 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT HAND SIDE COLUMN FOR DESKTOP (or Top on Mobile) OR MULTI-TAB CONTROLLER */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Autonomous Configuration Card */}
          <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#7213ff]" />
                Modo de Operación Autónoma
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={agentConfig.isEnabled} 
                  onChange={(e) => handleUpdateAgentConfig({ isEnabled: e.target.checked })} 
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-350 after:border after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7213ff]"></div>
              </label>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              El agente AI analiza tendencias, genera guiones, renderiza storyboard y publica automáticamente en tu TikTok sin intervención.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Intervalo de Publicación Estimada:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 4, 24].map((h) => (
                    <button
                      key={h}
                      onClick={() => handleUpdateAgentConfig({ intervalHours: h })}
                      className={`py-1.5 px-1 rounded text-xs font-semibold border transition-all ${
                        agentConfig.intervalHours === h
                          ? 'bg-[#7213ff]/20 text-indigo-300 border-[#7213ff]/60 shadow-[0_0_8px_rgba(114,19,255,0.15)]'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {h === 24 ? "Once Daily" : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-zinc-400 mb-1">Niches / Enfoques Temáticos seleccionados:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Historia", "Tecnología", "Curiosidades", "Noticias", "Educación"].map(cat => {
                    const active = agentConfig.selectedCategories?.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          const list = agentConfig.selectedCategories || [];
                          const updated = list.includes(cat) 
                            ? list.filter(c => c !== cat) 
                            : [...list, cat];
                          handleUpdateAgentConfig({ selectedCategories: updated });
                        }}
                        className={`text-[10px] px-2 py-1 rounded transition-all border ${
                          active 
                            ? 'bg-cyan-950/50 text-cyan-400 border-cyan-800/50' 
                            : 'bg-zinc-900/40 text-zinc-500 border-zinc-850 hover:text-zinc-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Manual Generator Card */}
          <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-fuchsia-400" />
              Creación Manual de Video
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Fuerza una creación de contenido inmediata en Español. Gemini redactará un guion excelente y estructurado a partir del tema.
            </p>

            <form onSubmit={handleManualGeneration} className="space-y-3">
              <div className="relative">
                <textarea
                  value={promptTopic}
                  onChange={(e) => setPromptTopic(e.target.value)}
                  placeholder="Ej: Curiosidades ocultas de la antigua civilización Maya o Hitos revolucionarios de la robótica cuántica"
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-zinc-200 placeholder:text-zinc-500 min-h-[90px] focus:outline-none focus:border-zinc-700 transition"
                  maxLength={180}
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-zinc-600 font-mono">
                  {promptTopic.length}/180
                </span>
              </div>

              {selectedTrendId && (
                <div className="bg-cyan-950/25 border border-cyan-900/40 rounded px-2 py-1 flex justify-between items-center">
                  <span className="text-[10px] text-cyan-400 font-medium">Conectado al trend {trends.find(t => t.id === selectedTrendId)?.hashtag}</span>
                  <button 
                    type="button" 
                    onClick={() => { setSelectedTrendId(null); setPromptTopic(''); }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Remover
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || !promptTopic.trim()}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-[#7213ff] to-fuchsia-500 font-semibold text-xs text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98] duration-150 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    GENERANDO AUDIO Y GUION...
                  </span>
                ) : (
                  "CREAR Y PRODUCIR VIDEO AHORA"
                )}
              </button>
            </form>
          </div>

          {/* Quick Metrics Bar Chart Preview */}
          <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Rendimiento Histórico</h4>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40 font-bold">+12.4% Alcance</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-850">
                <span className="text-[10px] text-zinc-500 block">Vistas</span>
                <span className="text-sm font-bold text-zinc-200">1.2M</span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-850">
                <span className="text-[10px] text-zinc-500 block">Engagement</span>
                <span className="text-sm font-bold text-zinc-200">84.2K</span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded border border-zinc-850">
                <span className="text-[10px] text-zinc-500 block">Videos IA</span>
                <span className="text-sm font-bold text-zinc-200">{videos.length}</span>
              </div>
            </div>
          </div>

        </section>

        {/* ACTIVE SMARTPHONE MOCKUP 9:16 INTERACTIVE MEDIA PLAYER PREVIEW */}
        <section className="lg:col-span-4 flex flex-col items-center justify-center">
          
          <div className="text-center mb-2 lg:hidden w-full">
            <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Toca para reproducir simulación de video y locución voz
            </p>
          </div>

          {/* Phone Frame wrapper */}
          <div className="relative w-full max-w-[320px] aspect-[9/16] bg-[#0c0d12] rounded-[48px] p-3 border-[10px] border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.1)] overflow-hidden flex flex-col group">
            
            {/* Phone Speaker & Camera Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-855 rounded-full z-30 flex justify-center items-center">
              <div className="w-12 h-1 bg-zinc-700 rounded-full mb-1"></div>
            </div>

            {/* Simulated Live Broadcast Display content */}
            {activeVideo ? (
              <div className="relative w-full h-full rounded-[38px] overflow-hidden flex flex-col justify-between bg-zinc-950">
                
                {/* Visual Imagery Stack based on Active Scene */}
                <div className="absolute inset-0 z-0">
                  {activeVideo.storyboard && activeVideo.storyboard[playingSceneIdx] && (
                    <img 
                      key={playingSceneIdx}
                      className="w-full h-full object-cover opacity-90 transition-all duration-1000 transform scale-105"
                      src={activeVideo.storyboard[playingSceneIdx].imageUrl || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=720&q=80&sig=${playingSceneIdx}`}
                      alt="TikTok Video Slide" 
                    />
                  )}
                  {/* Subtle dark film overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/50"></div>
                </div>

                {/* Simulated Header inside TikTok Interface */}
                <div className="relative z-10 p-4 pt-10 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 opacity-80 backdrop-blur-sm bg-black/30 px-2 py-1 rounded-full text-[9px] text-white">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
                    <span>TENDENCIA ACTIVA: {activeVideo.trendUsed}</span>
                  </div>
                  
                  <span className="text-[10px] font-mono text-cyan-400 tracking-wider font-bold">
                    {playingSceneIdx + 1}/{activeVideo.storyboard ? activeVideo.storyboard.length : 1} escena
                  </span>
                </div>

                {/* Big Play / Pause Hover overlay helper */}
                <div className="absolute inset-x-0 top-1/3 bottom-1/4 z-10 flex items-center justify-center cursor-pointer" onClick={toggleNarratorVoice}>
                  {!isPlaying && (
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-zinc-750 flex items-center justify-center backdrop-blur-sm shadow hover:scale-110 transition active:scale-95">
                      <Play className="w-6 h-6 text-cyan-400 fill-cyan-400 translate-x-[2px]" />
                    </div>
                  )}
                </div>

                {/* Sidebar controls for TikTok (Likes, comments, shares, audio renewal) */}
                <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-4 text-white">
                  
                  {/* Audio Narrator Synthesize indicator */}
                  <button 
                    onClick={toggleNarratorVoice}
                    className={`w-9 h-9 rounded-full bg-black/70 border flex items-center justify-center backdrop-blur-sm shadow hover:scale-105 active:scale-95 transition ${
                      isVoiceSynthesisActive ? 'border-cyan-400 text-cyan-400 animate-bounce' : 'border-zinc-800 text-zinc-300'
                    }`}
                    title="Reproducir locución narrada"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={handleGenerateAIImage}
                    disabled={isRenderingAIImage}
                    className="w-9 h-9 rounded-full bg-black/70 border border-zinc-800/80 flex items-center justify-center backdrop-blur-sm shadow hover:scale-105 active:scale-95 disabled:opacity-40 transition text-fuchsia-400"
                    title="Regenerar con IA"
                  >
                    {isRenderingAIImage ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-fuchsia-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-fuchsia-400" />
                    )}
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm hover:scale-105 cursor-pointer">
                      <Heart className="w-4 h-4 text-zinc-300 fill-current hover:text-red-500 transition-colors" />
                    </div>
                    <span className="text-[10px] font-mono mt-0.5 mt-1 font-semibold">{activeVideo.metrics?.likes || '1.1K'}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm hover:scale-105 cursor-pointer">
                      <MessageCircle className="w-4 h-4 text-zinc-300" />
                    </div>
                    <span className="text-[10px] font-mono mt-0.5 mt-1 font-semibold">{activeVideo.metrics?.comments || '142'}</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm hover:scale-105 cursor-pointer">
                      <Share2 className="w-4 h-4 text-zinc-300" />
                    </div>
                    <span className="text-[10px] font-mono mt-0.5 mt-1 font-semibold">{activeVideo.metrics?.shares || '48'}</span>
                  </div>

                </div>

                {/* Subtitles & Teleprompter overlaid at bottom */}
                <div className="relative z-10 p-4 bg-gradient-to-t from-black via-black/85 to-transparent space-y-2">
                  
                  {/* Scene visual instruction indicator */}
                  <div className="text-[9px] text-zinc-400 italic bg-zinc-950/80 p-2 rounded border border-zinc-800/50">
                    💡 <span className="font-semibold text-zinc-300">Prompt visual:</span> {activeVideo.storyboard[playingSceneIdx]?.instruction}
                  </div>

                  {/* Highlighted caption/subtitle text in center overlay style */}
                  <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800/30 text-center animate-fade-in">
                    <p className="text-xs font-black text-cyan-400 uppercase tracking-wide">
                      {activeVideo.storyboard[playingSceneIdx]?.caption}
                    </p>
                  </div>

                  {/* Post details */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-zinc-100 flex items-center gap-1">
                      @toktrend_creator 
                      <span className="text-[9px] font-normal text-cyan-400 bg-cyan-950 border border-cyan-900 px-1 py-0.2 rounded">SaaS AI</span>
                    </p>
                    <p className="text-[10px] text-zinc-300 line-clamp-2 leading-tight">
                      {activeVideo.description || "Inspiración automática para el algoritmo de TikTok."}
                    </p>
                    <p className="text-[9px] text-cyan-400 font-medium">
                      {activeVideo.hashtags?.map(tag => `#${tag} `) || '#TokTrend #Viral'}
                    </p>
                  </div>

                  {/* Progress slide timeline indicator */}
                  <div className="w-full h-1 bg-zinc-850 rounded-full overflow-hidden">
                    <div 
                      className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${((playingSceneIdx + (isPlaying ? 1 : 0)) / activeVideo.storyboard.length) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="w-full h-full rounded-[38px] overflow-hidden bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-zinc-600" />
                <h4 className="text-sm font-semibold text-zinc-300">Ningún video producido</h4>
                <p className="text-xs text-zinc-500">Selecciona una tendencia de la izquierda o escribe un tema para generar tu primer video con inteligencia artificial.</p>
                <button
                  onClick={() => handleManualGeneration(new Event('submit') as any)}
                  className="px-4 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-xs text-cyan-400 font-semibold border border-zinc-700/60"
                >
                  Probar demo rápida
                </button>
              </div>
            )}
          </div>

          {/* Simulated Controls directly below player */}
          {activeVideo && (
            <div className="mt-3 flex items-center gap-4">
              <button 
                onClick={toggleNarratorVoice}
                className={`text-xs px-3 py-1 bg-zinc-950 border rounded-full font-medium transition flex items-center gap-1.5 ${
                  isVoiceSynthesisActive ? 'text-cyan-400 border-cyan-800' : 'text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {isVoiceSynthesisActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isVoiceSynthesisActive ? "Pausar Locución" : "Escuchar Locución en Vivo"}
              </button>

              {activeVideo.status !== 'published' && (
                <button 
                  onClick={() => handlePublishNow(activeVideo.id)}
                  className="text-[11px] px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-[#7213ff] text-white font-bold tracking-tight hover:shadow-lg hover:shadow-cyan-500/10 active:scale-95 transition"
                >
                  Publicar en TikTok
                </button>
              )}
            </div>
          )}

        </section>

        {/* LEFT COLUMN FOR DESKTOP (or Bottom on Mobile): Trends & History queue */}
        <section className="lg:col-span-4 space-y-6">

          {/* Navigation Tab for the right-hand column */}
          <div className="flex bg-zinc-900/60 border border-zinc-850 p-1 rounded-lg">
            {(['control', 'analytics', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 px-2 text-xs font-semibold rounded capitalize transition-all ${
                  activeTab === tab 
                    ? 'bg-[#0b0c10] text-[#7213ff] shadow border border-zinc-800' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab === 'control' ? 'Tendencias' : tab === 'analytics' ? 'Dashboard' : 'Cola de Post'}
              </button>
            ))}
          </div>

          {activeTab === 'control' && (
            <div className="space-y-4">
              {/* Scan trends triggers */}
              <div className="flex justify-between items-center bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-4">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Algoritmo de Tendencias</h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Analizados con Gemini Search Grounding</p>
                </div>
                <button
                  onClick={fetchTrends}
                  disabled={isScanningTrends}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 active:scale-95 disabled:opacity-40 transition-all rounded-lg border border-zinc-800 text-cyan-400 self-center"
                  title="Escanear algoritmo"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanningTrends ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Niche Categories Filters */}
              <div className="flex gap-1.5 overflow-x-auto py-1">
                {["Todas", "Historia", "Tecnología", "Curiosidades", "Educación"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border shrink-0 transition-all ${
                      activeCategoryFilter === cat 
                        ? 'bg-[#7213ff]/20 text-indigo-300 border-[#7213ff]/60' 
                        : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Trends Board List */}
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {filteredTrends.map(trend => (
                  <div 
                    key={trend.id}
                    onClick={() => handleSelectTrend(trend)}
                    className={`bg-zinc-900/60 hover:bg-zinc-900 p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                      selectedTrendId === trend.id 
                        ? 'border-[#7213ff] shadow-[0_0_12px_rgba(114,19,255,0.1)]' 
                        : 'border-zinc-850 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-cyan-400 font-mono">{trend.hashtag}</span>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] text-zinc-500">{trend.category}</span>
                          <span className="text-[9px] font-mono px-1 bg-zinc-950 text-[#7213ff] border border-zinc-900 rounded">{trend.volume}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[#7213ff] tracking-tight block font-bold">↑ {trend.viralityScore}%</span>
                        <span className="text-[9px] text-zinc-500">viralidad</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                      {trend.summary}
                    </p>

                    <div className="bg-[#0b0c10] border border-zinc-850/40 p-2 rounded flex justify-between items-center text-[11px]">
                      <span className="text-zinc-500 truncate mr-2">Idea: {trend.suggestedTopic}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Aprendizaje Continuo y Métricas
              </h4>
              <p className="text-xs text-zinc-400">
                El motor analiza de forma constante la retención, me gusta y compartidos de los videos publicados para ajustar dinámicamente los ganchos y palabras claves de futuras creaciones.
              </p>

              <div className="space-y-3 pt-2">
                <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-zinc-200 font-bold block">Tasa de Engagement Promedio</span>
                    <span className="text-[10px] text-zinc-500">Para videos generados por el agente</span>
                  </div>
                  <span className="text-lg font-mono font-bold text-[#7213ff]">6.8%</span>
                </div>

                <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-zinc-200 font-bold block">Retención de Audiencia Media</span>
                    <span className="text-[10px] text-zinc-500">Visualizaciones hasta el segundo 15</span>
                  </div>
                  <span className="text-lg font-mono font-bold text-cyan-400">54%</span>
                </div>

                <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-zinc-200 font-bold block">Crecimiento de Audiencia</span>
                    <span className="text-[10px] text-zinc-500">Nuevos seguidores este mes</span>
                  </div>
                  <span className="text-lg font-mono font-bold text-green-400">+1.4K</span>
                </div>
              </div>

              <div className="border-t border-zinc-800/60 pt-3 text-center">
                <button 
                  onClick={() => addLog("Optimizando prompts con machine learning de métricas...")}
                  className="text-[11px] px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-805 text-zinc-300 font-medium border border-zinc-800"
                >
                  Forzar Optimización del Algoritmo
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Cola y Registro de Publicación</h4>
                <span className="text-[10px] text-zinc-500">{videos.length} videos totales</span>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {videos.map(video => (
                  <div 
                    key={video.id}
                    onClick={() => { setActiveVideo(video); setPlayingSceneIdx(0); }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-1.5 ${
                      activeVideo?.id === video.id 
                        ? 'bg-zinc-900 border-cyan-800/60 shadow-[0_0_10px_rgba(6,182,212,0.06)]' 
                        : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-[70%]">
                        <span className="text-xs block text-white font-bold font-display truncate">
                          {video.title}
                        </span>
                        <div className="flex gap-2 items-center text-[10px] text-zinc-400 mt-1">
                          <span className="font-mono bg-zinc-950 px-1 rounded truncate">Nicho: {video.trendUsed}</span>
                          <span className="shrink-0">{video.duration}s</span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        video.status === 'published' 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' 
                          : video.status === 'scheduled' 
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' 
                          : 'bg-cyan-950/40 text-cyan-400 border-cyan-800/40'
                      }`}>
                        {video.status === 'published' ? 'PUBLICADO' : video.status === 'scheduled' ? 'PROGRAMADO' : 'GENERADO'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-850/40">
                      <span>
                        {video.publishedAt 
                          ? `Publicado hace ${Math.max(1, Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / 3600000))}h` 
                          : video.scheduledAt 
                          ? `Programado: ${new Date(video.scheduledAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` 
                          : 'Listo para publicar'}
                      </span>
                      {video.status === 'published' ? (
                        <div className="flex items-center gap-1 text-zinc-400 font-mono text-[9px]">
                          <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                          <span>{video.metrics?.likes || 0}</span>
                          <Eye className="w-3 h-3 ml-1 text-cyan-400" />
                          <span>{video.metrics?.views || 0}</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePublishNow(video.id); }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                          Publicar ya 🚀
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time telemetry log feed of the server-side operations */}
          <div className="bg-[#0b0c10] border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#7213ff]" />
              Consola del Renderizador de Video
            </h4>
            <div className="bg-black/80 font-mono text-[10px] text-zinc-400 p-3 rounded-lg max-h-[140px] overflow-y-auto space-y-1.5 border border-zinc-850">
              {renderLogs.length === 0 ? (
                <p className="text-center py-4 text-zinc-600">[Inicio de sesión en TokTrend... Conectado con éxito]</p>
              ) : (
                renderLogs.map((log, idx) => (
                  <p key={idx} className="leading-tight truncate">{log}</p>
                ))
              )}
            </div>
          </div>

        </section>

      </main>

      {/* Modern, non-obtrusive responsive mobile friendly indicators & metadata */}
      <footer id="toktrend-footer" className="bg-[#0b0c10]/40 border-t border-zinc-800/30 py-4 text-center text-[11px] text-zinc-500 px-4">
        <p>CONSOLA DE CONTROL TOKTREND V1.0 · Creada en español para uso adaptativo multidispositivo.</p>
        <p className="mt-1">© 2026 TokTrend Inc. Todos los derechos reservados.</p>
      </footer>

    </div>
  );
}
