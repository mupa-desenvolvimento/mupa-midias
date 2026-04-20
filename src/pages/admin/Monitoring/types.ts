export type Gender = "male" | "female";

export type Emotion =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised";

export interface DetectedFace {
  id: number;
  box: { x: number; y: number; width: number; height: number };
  age: number;
  gender: Gender;
  genderProbability: number;
  emotion: Emotion;
  emotionConfidence: number;
}

export interface DetectionLogEntry {
  timestamp: string;
  age: number;
  gender: Gender;
  emotion: Emotion;
}

export type CameraStatus =
  | "idle"
  | "loading-models"
  | "requesting-camera"
  | "active"
  | "denied"
  | "no-camera"
  | "error";

export interface AudienceSession {
  personId: string;
  startTime: number;
  lastSeen: number;
  durationMs: number;
  gender: Gender;
  age: number;
  dominantEmotion: Emotion;
  longSession: boolean;
  isLooking: boolean;
  isCurrentlyVisible: boolean;
  box?: { x: number; y: number; width: number; height: number };
}

export interface AudienceMetrics {
  totalUniquePeople: number;
  averageAttentionTimeMs: number;
  totalAudienceTimeMs: number;
  genderDistribution: { male: number; female: number };
  dominantEmotion: Emotion | "none";
}
