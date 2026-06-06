import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("⚠️ WARNING: GEMINI_API_KEY variable is missing or placeholder value. Falling back to simulated AI mode.");
}

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side in-memory state
let trends = [
  {
    id: "t-1",
    hashtag: "#HistoriaDeMisterio",
    category: "Historia",
    viralityScore: 94,
    volume: "12.4M vistas",
    isEmerging: true,
    summary: "Vídeos sobre curiosidades históricas misteriosas narradas de forma dramática y envolvente con música inquietante.",
    suggestedTopic: "El misterio sin resolver de la colonia perdida de Roanoke."
  },
  {
    id: "t-2",
    hashtag: "#IAExplicada",
    category: "Tecnología",
    viralityScore: 89,
    volume: "8.2M vistas",
    isEmerging: true,
    summary: "Explicar conceptos abstractos de IA o avances tecnológicos recientes usando analogías visuales super simples.",
    suggestedTopic: "Por qué la Inteligencia Artificial realmente no 'piensa' como los humanos."
  },
  {
    id: "t-3",
    hashtag: "#DatosInsolitos",
    category: "Curiosidades",
    viralityScore: 96,
    volume: "15.1M vistas",
    isEmerging: false,
    summary: "Listas rápidas y dinámicas de 3 datos que parecen mentira pero son completamente reales.",
    suggestedTopic: "3 Animales que tienen superpoderes biológicos inexplicables."
  },
  {
    id: "t-4",
    hashtag: "#AprendeEnTikTok",
    category: "Educación",
    viralityScore: 91,
    volume: "24.3M vistas",
    isEmerging: false,
    summary: "Hack de productividad mental o aprendizaje acelerado de un idioma en un minuto.",
    suggestedTopic: "El método Feynman de 4 pasos para aprender cualquier cosa de inmediato."
  }
];

let videos: any[] = [
  {
    id: "v-1",
    trendUsed: "#DatosInsolitos",
    topic: "Animales fantásticos reales",
    title: "¡Animales con Superpoderes Reales! 🧬🐾",
    script: "Fascinante. Hay animales que viven entre nosotros con habilidades dignas de una película de superhéroes. ¿Alguna vez escuchaste hablar del pez sapo, capaz de sobrevivir fuera del agua? ¿O el increíble oso de agua que flota ileso en el vacío del espacio exterior? Pero el rey es la medusa inmortal. Si se lesiona o envejece, simplemente revierte su ciclo biológico al estado de pólipo para renacer. Básicamente vive para siempre. ¿Qué superpoder animal te gustaría tener? Déjalo en comentarios y sigue a TokTrend para más curiosidades.",
    description: "La naturaleza supera a la ciencia ficción. Estos 3 animales desafían las leyes de la biología. Descubre el rey inmortal. 🌊🔬",
    hashtags: ["DatosInsolitos", "Curiosidades", "Animales", "AprendeEnTikTok", "Naturaleza"],
    duration: 35,
    status: "published",
    progress: 100,
    publishedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    storyboard: [
      {
        sceneNum: 1,
        instruction: "Visualmente dinámico. Toma aérea de un arrecife coralino misterioso con reflejos de luz de neón cian.",
        caption: "Medusa inmortal y animales con superpoderes extraordinarios."
      },
      {
        sceneNum: 2,
        instruction: "Primer plano extremo de un tardígrado flotando plácidamente en una galaxia cósmica violeta.",
        caption: "El oso de agua resiste el frío absoluto del espacio."
      },
      {
        sceneNum: 3,
        instruction: "Ilustración neón de una medusa turquesa brillante regenerando sus células en el fondo del océano profundo.",
        caption: "La medusa Turritopsis dohrnii revierte sus células para renacer indefinidamente."
      }
    ],
    metrics: {
      views: 124000,
      likes: 8520,
      comments: 324,
      shares: 98,
      retention: 64
    }
  },
  {
    id: "v-2",
    trendUsed: "#HistoriaDeMisterio",
    topic: "La isla flotante de Roanoke",
    title: "El misterio de Roanoke: ¡La colonia que se desvaneció! 🪓👀",
    script: "Año 1590. Un barco inglés llega de vuelta a la colonia de Roanoke en América tras tres años de ausencia. ¿Qué encontraron? Absolutamente nada. Las casas habían sido desmanteladas y las ciento quince personas que allí vivían desaparecieron sin dejar rastro de violencia. La única pista fue una palabra tallada en un poste de madera: 'CROATOAN'. ¿Qué significaba? ¿Ataque nativo, hambruna o conspiración dimensional? Hasta hoy, el destino de la colonia perdida de Roanoke sigue siendo uno de los mayores acertijos de la historia norteamericana.",
    description: "Una colonia entera de pioneros desapareció sin dejar un solo rastro. ¿Qué significa la misteriosa inscripción CROATOAN? Descúbrelo aquí. 🪵🕵️‍♂️",
    hashtags: ["HistoriaDeMisterio", "Historia", "Roanoke", "Misterio", "Leyendas"],
    duration: 42,
    status: "scheduled",
    progress: 100,
    scheduledAt: new Date(Date.now() + 3600000 * 2).toISOString(),
    storyboard: [
      {
        sceneNum: 1,
        instruction: "Bosque oscuro cubierto de niebla densa en el amanecer con tonos grises y madera húmeda.",
        caption: "Una colonia británica entera se desvaneció por completo en 1587."
      },
      {
        sceneNum: 2,
        instruction: "Poste de madera rústica tallado profundamente con la palabra CROATOAN iluminado por antorcha de fuego.",
        caption: "La única pista fue una palabra extraña grabada en la madera: Croatoan."
      },
      {
        sceneNum: 3,
        instruction: "Silueta fantasmal de un navío antiguo navegando en un mar cubierto de neblina bajo la luz de la luna.",
        caption: "Hasta hoy, el enigma de Roanoke sigue sin resolverse."
      }
    ],
    metrics: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      retention: 0
    }
  }
];

let agentConfig = {
  intervalHours: 1,
  isEnabled: true,
  lastCheckAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  nextPostAt: new Date(Date.now() + 1000 * 60 * 42).toISOString(),
  currentTaskPercent: 24,
  currentTaskStatus: "INVESTIGANDO TENDENCIAS...",
  selectedCategories: ["Historia", "Tecnología", "Curiosidades", "Educación", "Noticias"]
};

// 1. GET /api/trends - Requerido para la visualización de tendencias con soporte Gemini real
app.get('/api/trends', async (req: Request, res: Response) => {
  if (!ai) {
    return res.json({ trends, isMock: true });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Genera una lista nueva de 4 temas que sean mega tendencia extrema y viral en TikTok actualmente para el público hispanohablante. Devuélvelas en formato JSON estricto estructurado.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hashtag: { type: Type.STRING, description: "Hashtag de TikTok que sea tendencia, ej: #CuriososDatos" },
              category: { type: Type.STRING, description: "Categoría del trend limitada a una de estas: Curiosidades, Educación, Informativo, Noticias, Tecnología, Historia" },
              viralityScore: { type: Type.INTEGER, description: "Un puntaje de viralidad de 80 a 100" },
              volume: { type: Type.STRING, description: "Volumen estimado de vistas, ej: '45.2M vistas'" },
              isEmerging: { type: Type.BOOLEAN, description: "Si es un formato de tendencia recién surgido" },
              summary: { type: Type.STRING, description: "Detalle rápido del formato del trend en español" },
              suggestedTopic: { type: Type.STRING, description: "Un tema concreto y provocador para un video de TikTok basado en esta tendencia" }
            },
            required: ["hashtag", "category", "viralityScore", "volume", "isEmerging", "summary", "suggestedTopic"]
          }
        }
      }
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      // Add fake/mock ids
      trends = parsed.map((item: any, idx: number) => ({
        id: `t-gen-${idx}-${Date.now()}`,
        ...item
      }));
    }
    return res.json({ trends, isMock: false });
  } catch (err: any) {
    console.error("Gemini Trends generation failed, sending local database state:", err.message);
    return res.json({ trends, isMock: true, error: err.message });
  }
});

// 2. POST /api/generate - Crea de forma autónoma o manual un nuevo vídeo de TikTok
app.post('/api/generate', async (req: Request, res: Response) => {
  const { topic, trendUsed } = req.body;
  if (!topic) {
    return res.status(400).json({ error: "El parámetro de 'topic' o tema es obligatorio." });
  }

  const videoId = `v-${Date.now()}`;
  const newVideo: any = {
    id: videoId,
    trendUsed: trendUsed || "Inspiración Manual",
    topic,
    title: `Generando: ${topic}`,
    script: "Redactando borrador de guion...",
    description: "",
    hashtags: [],
    duration: 30,
    status: "generating",
    progress: 10,
    storyboard: [
      { sceneNum: 1, instruction: "Preparando escenario...", caption: "Preparando contenido para ti..." }
    ],
    metrics: { views: 0, likes: 0, comments: 0, shares: 0, retention: 0 }
  };

  videos.unshift(newVideo);

  // If Gemini client isn't configured, perform a simulated but high-quality local generation after a short block
  if (!ai) {
    setTimeout(() => {
      const v = videos.find(x => x.id === videoId);
      if (v) {
        v.title = `¿Por qué ${topic} te sorprenderá? 🤯🔥`;
        v.script = `¿Alguna vez te has preguntado qué hay detrás del tema: ${topic}? Es sencillamente una locura. El 99% de las personas cree que esto es de una manera, pero la verdad oculta que revelamos hoy lo cambia todo por completo. Los expertos confirmaron recientemente datos que desafían el sentido común. La próxima vez que escuches hablar de esto, recordarás este clip. Cuéntanos tu opinión en la caja de comentarios, únete a la conversación de TokTrend y dale al más para contenido diario viral inteligente en español.`;
        v.description = `Todo lo que siempre quisiste saber sobre ${topic} explicado para mentes curiosas en menos de 40 segundos. ¡El final es imperdible! 🧬💻`;
        v.hashtags = ["TokTrend", "AprendeEnTikTok", "Curiosidades", "Tecnologia", "Increible"];
        v.duration = 40;
        v.status = "ready";
        v.progress = 100;
        v.storyboard = [
          {
            sceneNum: 1,
            instruction: "Primer plano de luces místicas violeta cruzándose con humo de niebla cinematográfico.",
            caption: `El gran enigma de: ${topic}.`
          },
          {
            sceneNum: 2,
            instruction: "Diseño conceptual en planos geométricos 3D brillante con destellos de neón azul.",
            caption: "Lo que la mayoría de los investigadores no te está diciendo."
          },
          {
            sceneNum: 3,
            instruction: "Escenario de laboratorio abstracto supermoderno con pantallas holográficas flotantes.",
            caption: "Un descubrimiento que podría reescribir tus conocimientos."
          }
        ];
      }
    }, 4500);

    return res.json({ success: true, video: newVideo, isMock: true });
  }

  // Use Gemini to generate high-quality Spanish copy, title, hashtags, description, and storyboard!
  try {
    const prompt = `Queremos crear un video vertical altamente viral de TikTok en español para TokTrend. 
El tema proporcionado es: "${topic}" y la tendencia/hashtag de origen es: "${trendUsed || 'Creación Manual'}".
Genera una estructura de video que tenga un hook irresistible al segundo 1, narración en español muy enérgica e intrigante, y una secuencia limpia de 3 diapositivas visuales (storyboard). Devuélvelo estrictamente en JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título llamativo para TikTok lleno de emojis (máx 60 caracteres)" },
            script: { type: Type.STRING, description: "Guion de locución completo del narrador en español de forma fluida (unas 80-120 palabras), apto para locución de voz" },
            description: { type: Type.STRING, description: "Descripción optimizada del post para TikTok con gancho publicitario y emojis" },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "5 hashtags virales sin el signo numeral (#) óptimos para el SEO"
            },
            duration: { type: Type.INTEGER, description: "Duración aproximada en segundos del video (ej: 35)" },
            storyboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNum: { type: Type.INTEGER },
                  instruction: { type: Type.STRING, description: "Instrucción de diseño visual, ej: 'Ilustración brillante estilo cyberpunk de una CPU futurista rodeada de cables cian'" },
                  caption: { type: Type.STRING, description: "Subtítulo o texto en pantalla mega impactante, de 5 a 8 palabras máximo" }
                },
                required: ["sceneNum", "instruction", "caption"]
              }
            }
          },
          required: ["title", "script", "description", "hashtags", "duration", "storyboard"]
        }
      }
    });

    const resultText = response.text || "{}";
    const resultObj = JSON.parse(resultText);

    // Update state
    const index = videos.findIndex(x => x.id === videoId);
    if (index !== -1) {
      videos[index] = {
        ...videos[index],
        status: "ready",
        progress: 100,
        title: resultObj.title || `Estudio sobre ${topic}`,
        script: resultObj.script || "Guión de video autogenerado por TokTrend.",
        description: resultObj.description || "Descubre curiosidades espectaculares en este clip.",
        hashtags: resultObj.hashtags || ["TokTrend", "TikTokAutomation"],
        duration: resultObj.duration || 30,
        storyboard: resultObj.storyboard || [
          { sceneNum: 1, instruction: "Fondo neón abstract", caption: "Descubre más sobre este tema" }
        ]
      };
    }

    return res.json({ success: true, video: videos[index], isMock: false });

  } catch (err: any) {
    console.error("Gemini copy generation failed, using high quality backup simulation:", err);
    // Fallback to updating in-memory video with simulated details
    const index = videos.findIndex(x => x.id === videoId);
    if (index !== -1) {
      videos[index].title = `El enigma de: ${topic} 🌌🔎`;
      videos[index].script = `Atención. Lo que estás a punto de escuchar sobre ${topic} podría cambiar tu perspectiva de las cosas por completo. Se ha revelado recientemente un dato fascinante que los científicos preferían mantener bajo la mesa. Resulta que su impacto va mucho más allá de lo que creíamos. ¿Increíble, verdad? Comenta debajo qué te ha parecido este nuevo dato, déjanos un like y suscríbete para más secretos virales de TokTrend. Hasta el próximo post.`;
      videos[index].description = `La explicación definitiva sobre ${topic} que te dejará pensando toda la semana. ¿Conocías este hecho real? 🤯🛰️`;
      videos[index].hashtags = ["Misterios", "Tecnologia", "AprendeEnTikTok", "TokTrend", "Viral"];
      videos[index].status = "ready";
      videos[index].progress = 100;
      videos[index].storyboard = [
        { sceneNum: 1, instruction: "Detalle conceptual de un ojo biónico luminoso de neón turquesa.", caption: "El secreto que nadie te había revelado." },
        { sceneNum: 2, instruction: "Planos abstractos geométricos flotando sobre una superficie metálica oscura.", caption: "Reescribiendo lo que sabías sobre la realidad." },
        { sceneNum: 3, instruction: "Holograma 3D girando de un cerebro digital brillante con pulsos de fuego.", caption: "La verdad explicada en 30 segundos." }
      ];
    }
    return res.json({ success: true, video: videos[index], isMock: true, error: err.message });
  }
});

// 3. POST /api/generate-scene-image - Genera una imagen IA para un storyboard utilizando gemini-2.5-flash-image
app.post('/api/generate-scene-image', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "El del prompt visual es obligatorio." });
  }

  if (!ai) {
    // Return a beautiful dynamic geometric or abstract placeholder URL based on search prompt words
    const seed = encodeURIComponent(prompt.substring(0, 15));
    return res.json({
      imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=640&q=80&sig=${seed}`,
      isMock: true
    });
  }

  try {
    // Execute image generation with gemini-2.5-flash-image in single orientation mode
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: `A gorgeous mobile phone high resolution 9:16 portrait style, cinematic composition: ${prompt}` }],
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        }
      }
    });

    let base64Image = "";
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (base64Image) {
      return res.json({ imageUrl: `data:image/png;base64,${base64Image}`, isMock: false });
    } else {
      throw new Error("No inlineData returned from image generation model.");
    }

  } catch (err: any) {
    console.error("Gemini Image generation failed, fallback to scenic Unsplash keyword image.", err);
    const keywords = prompt.split(' ').slice(0, 3).join(',');
    const fallbackUrl = `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=720&q=80&q_term=${encodeURIComponent(keywords)}`;
    return res.json({ imageUrl: fallbackUrl, isMock: true, error: err.message });
  }
});

// 4. GET /api/videos - Obtiene la lista local de publicaciones
app.get('/api/videos', (req: Request, res: Response) => {
  return res.json({ videos });
});

// 5. POST /api/publish/:id - Fuerza la simulación de publicación inmediata a TikTok
app.post('/api/publish/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = videos.findIndex(x => x.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Video no encontrado." });
  }

  // Update status to published and assign random organic metrics
  videos[index].status = "published";
  videos[index].publishedAt = new Date().toISOString();
  videos[index].scheduledAt = undefined;
  videos[index].metrics = {
    views: Math.floor(Math.random() * 85000) + 12000,
    likes: Math.floor(Math.random() * 12000) + 800,
    comments: Math.floor(Math.random() * 450) + 20,
    shares: Math.floor(Math.random() * 190) + 10,
    retention: Math.floor(Math.random() * 35) + 40
  };

  return res.json({ success: true, video: videos[index] });
});

// 6. POST /api/agent-config - Actualiza el comportamiento autónomo del Agente TokTrend
app.post('/api/agent-config', (req: Request, res: Response) => {
  agentConfig = {
    ...agentConfig,
    ...req.body,
    lastCheckAt: new Date().toISOString(),
    nextPostAt: new Date(Date.now() + 1000 * 60 * 60 * (req.body.intervalHours || agentConfig.intervalHours)).toISOString()
  };
  return res.json({ success: true, agentConfig });
});

// 7. GET /api/agent-status - Resuelve la información en vivo de las tareas autónomas
app.get('/api/agent-status', (req: Request, res: Response) => {
  // Simulate active automation ticker fluctuation slightly to feel real
  if (agentConfig.isEnabled) {
    const minSince = Math.floor((Date.now() - new Date(agentConfig.lastCheckAt).getTime()) / 60000);
    if (minSince < 5) {
      agentConfig.currentTaskStatus = "PUBLICANDO ÚLTIMO VIDEO...";
      agentConfig.currentTaskPercent = 98;
    } else if (minSince < 15) {
      agentConfig.currentTaskStatus = "MONITORIZANDO MÉTRICAS EN TIKTOK...";
      agentConfig.currentTaskPercent = 82;
    } else if (minSince < 30) {
      agentConfig.currentTaskStatus = "INVESTIGANDO NUEVAS TENDENCIAS DE HOY...";
      agentConfig.currentTaskPercent = 14;
    } else {
      agentConfig.currentTaskStatus = "ESCUCHANDO ALGORITMOS DE TIKTOK...";
      agentConfig.currentTaskPercent = 45;
    }
  } else {
    agentConfig.currentTaskStatus = "AGENTE EN PAUSA";
    agentConfig.currentTaskPercent = 0;
  }

  return res.json({ agentConfig });
});


// 8. Integration Client handler - Dev vs Prod
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    // Load Vite dynamically in dev mode to bundle TypeScript React flawlessly
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
    console.log("🚀 Vite Dev middleware connected on port 3000");
  } else {
    // Host production build
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
    console.log("📦 Serving production assets from ./dist");
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`📡 TokTrend is active and listening on http://0.0.0.0:${port}`);
  });
};

startServer().catch((err) => {
  console.error("❌ Failed to launch TokTrend server:", err);
});
