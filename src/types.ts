/**
 * Types definition for TOKTREND Content Automation Platform
 */

export interface Trend {
  id: string;
  hashtag: string;
  category: "Curiosidades" | "Educación" | "Informativo" | "Noticias" | "Tecnología" | "Historia";
  viralityScore: number; // 0-100
  volume: string; // e.g., "4.2M vistas"
  isEmerging: boolean;
  summary: string;
  suggestedTopic: string;
}

export interface StoryboardItem {
  sceneNum: number;
  instruction: string;
  caption: string;
  imageUrl?: string;
}

export interface TikTokVideo {
  id: string;
  trendUsed?: string;
  topic: string;
  title: string;
  script: string; // Speech text
  description: string;
  hashtags: string[];
  voiceVoice?: string;
  duration: number; // in seconds
  status: "idle" | "generating" | "ready" | "scheduled" | "published" | "failed";
  progress: number; // 0-100
  scheduledAt?: string; // ISO string
  publishedAt?: string; // ISO string
  audioProgress?: boolean;
  storyboard: StoryboardItem[];
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    retention: number; // 0-100%
  };
}

export interface TikTokAccount {
  isConnected: boolean;
  username?: string;
  nickname?: string;
  avatarUrl?: string;
  followerCount?: number;
  likesCount?: number;
  videoCount?: number;
}

export interface AgentConfig {
  intervalHours: number; // 1, 2, 4, 6, 12, 24
  isEnabled: boolean;
  lastCheckAt?: string;
  nextPostAt?: string;
  currentTaskPercent?: number;
  currentTaskStatus?: string;
  selectedCategories: string[];
}
