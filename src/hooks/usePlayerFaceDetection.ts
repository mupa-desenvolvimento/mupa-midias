import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { initializeFaceApiBackend, initTensorFlow, isFaceApiBackendError, switchFaceApiToCpu, isBackendReady, ensureBackendReady } from '@/lib/faceApiBackend';

export interface DetectedFace {
  trackId: string;
  gender: 'masculino' | 'feminino' | 'indefinido';
  age: number;
  ageGroup: string;
  emotion: string;
  emotionConfidence: number;
  confidence: number;
  attentionDuration: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface TrackedFace {
  descriptor: Float32Array;
  firstSeenAt: Date;
  lastSeenAt: Date;
  gender: 'male' | 'female' | 'unknown'; // DB-compatible values
  genderDisplay: 'masculino' | 'feminino' | 'indefinido';
  ageEstimates: number[];
  emotions: { expression: string; probability: number }[];
  confidence: number;
  loggedToServer: boolean;
}

interface CurrentContent {
  contentId: string;
  contentName: string;
  playlistId: string;
}

const FACE_MATCH_THRESHOLD = 0.5; // Slightly more relaxed for player mode
const FACE_TIMEOUT_MS = 2500;
const DETECTION_INTERVAL_MS = 1000;
const MIN_ATTENTION_DURATION = 0.5; // Reduced from 1 to capture more short looks
const BATCH_SEND_INTERVAL_MS = 5_000; // More frequent (5s instead of 10s) to avoid data loss
const MAX_PENDING_LOGS = 50;

const getAgeGroup = (age: number): string => {
  if (age <= 12) return 'child';
  if (age <= 18) return 'teen';
  if (age <= 25) return 'young_adult';
  if (age <= 50) return 'adult';
  return 'senior';
};

const getAgeGroupDisplay = (age: number): string => {
  if (age <= 12) return '0-12';
  if (age <= 18) return '13-18';
  if (age <= 25) return '19-25';
  if (age <= 35) return '26-35';
  if (age <= 50) return '36-50';
  return '51+';
};

const getGender = (gender: string, probability: number): { db: 'male' | 'female' | 'unknown'; display: 'masculino' | 'feminino' | 'indefinido' } => {
  if (probability < 0.7) return { db: 'unknown', display: 'indefinido' };
  if (gender === 'female') return { db: 'female', display: 'feminino' };
  if (gender === 'male') return { db: 'male', display: 'masculino' };
  return { db: 'unknown', display: 'indefinido' };
};

const calculateAverageAge = (estimates: number[]): number => {
  if (estimates.length === 0) return 0;
  if (estimates.length === 1) return Math.round(estimates[0]);
  
  const sorted = [...estimates].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.2);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  
  if (trimmed.length === 0) return Math.round(sorted[Math.floor(sorted.length / 2)]);
  
  const sum = trimmed.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / trimmed.length);
};

const getMostFrequentEmotion = (emotions: { expression: string; probability: number }[]): { expression: string; probability: number } => {
  if (emotions.length === 0) return { expression: 'neutral', probability: 0 };
  
  const emotionCounts = emotions.reduce((acc, e) => {
    acc[e.expression] = (acc[e.expression] || 0) + e.probability;
    return acc;
  }, {} as Record<string, number>);
  
  let maxEmotion = 'neutral';
  let maxScore = 0;
  
  for (const [expression, score] of Object.entries(emotionCounts)) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = expression;
    }
  }
  
  return { expression: maxEmotion, probability: maxScore / emotions.length };
};

const isFacingCamera = (landmarks: faceapi.FaceLandmarks68): boolean => {
  const positions = landmarks.positions;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  const leftEyeCenter = {
    x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
    y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
  };
  const rightEyeCenter = {
    x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
    y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length
  };
  
  const noseTip = positions[30];
  const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
  if (eyeDistance < 1) return false; // Avoid division by zero
  
  const eyesCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const noseOffset = Math.abs(noseTip.x - eyesCenterX);
  const turnRatio = noseOffset / eyeDistance;
  
  const jawOutline = landmarks.getJawOutline();
  const jawTilt = Math.abs(jawOutline[0].y - jawOutline[16].y) / eyeDistance;
  
  return turnRatio < 0.25 && jawTilt < 0.4;
};

export const usePlayerFaceDetection = (
  deviceCode: string,
  isActive: boolean,
  currentContent: CurrentContent | null,
  externalVideoRef?: React.RefObject<HTMLVideoElement>
) => {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFaces, setActiveFaces] = useState<DetectedFace[]>([]);
  const [totalDetectionsToday, setTotalDetectionsToday] = useState(0);
  
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false); // Concurrency lock
  const isSwitchingBackendRef = useRef(false);
  const trackedFacesRef = useRef<Map<string, TrackedFace>>(new Map());
  const pendingLogsRef = useRef<any[]>([]);
  const currentContentRef = useRef(currentContent);

  // Keep currentContent ref fresh without re-triggering effects
  useEffect(() => {
    currentContentRef.current = currentContent;
  }, [currentContent]);

  // Load ONLY lightweight models (no SSD)
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);

        // CRITICAL: init TF backend BEFORE loading model weights
        await initTensorFlow();

        const MODEL_URL = '/models';

        // Only load TinyFaceDetector (fast) + needed pipelines
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        const backend = await initializeFaceApiBackend(faceapi);
        console.log('[PlayerDetection] Models loaded, backend:', backend);
        setIsModelsLoaded(true);
      } catch (error) {
        console.error('[PlayerDetection] Error loading models:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 480 },  // Lower resolution for performance
          height: { ideal: 360 }
        }
      });
      
      streamRef.current = stream;
      
      if (!externalVideoRef && !internalVideoRef.current) {
        const v = document.createElement('video');
        v.setAttribute('autoplay', '');
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        v.style.display = 'none';
        document.body.appendChild(v);
        internalVideoRef.current = v;
      }
      
      const videoEl = videoRef.current;
      
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('autoplay', '');
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('playsinline', '');
        await videoEl.play();
        console.log('[PlayerDetection] Camera started');
        return true;
      } else {
        console.warn('[PlayerDetection] No video element available');
        return false;
      }
    } catch (error) {
      console.error('[PlayerDetection] Camera error:', error);
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.srcObject = null;
    }
    
    if (internalVideoRef.current && internalVideoRef.current.parentNode) {
      internalVideoRef.current.parentNode.removeChild(internalVideoRef.current);
      internalVideoRef.current = null;
    }
  }, []);

  // Send logs to server
  const sendLogsToServer = useCallback(async () => {
    if (pendingLogsRef.current.length === 0) return;
    
    const logsToSend = pendingLogsRef.current.splice(0, MAX_PENDING_LOGS);
    
    try {
      const { error } = await supabase.functions.invoke('device-detection', {
        body: {
          device_serial: deviceCode,
          detections: logsToSend
        }
      });
      
      if (error) {
        console.error('[PlayerDetection] Error sending logs:', error);
        pendingLogsRef.current.unshift(...logsToSend);
      } else {
        setTotalDetectionsToday(prev => prev + logsToSend.length);
        console.log(`[PlayerDetection] Sent ${logsToSend.length} detections`);
      }
    } catch (error) {
      console.error('[PlayerDetection] Send error:', error);
      pendingLogsRef.current.unshift(...logsToSend);
    }
  }, [deviceCode]);

  // Find matching tracked face
  const findMatchingTrackedFace = useCallback((descriptor: Float32Array): string | null => {
    let bestMatch: { trackId: string; distance: number } | null = null;
    
    for (const [trackId, tracked] of trackedFacesRef.current.entries()) {
      try {
        const distance = faceapi.euclideanDistance(descriptor, tracked.descriptor);
        if (distance < FACE_MATCH_THRESHOLD) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { trackId, distance };
          }
        }
      } catch {
        // Skip invalid descriptors
      }
    }
    return bestMatch?.trackId || null;
  }, []);

  // Main detection loop - uses TinyFaceDetector for speed
  const detectFaces = useCallback(async () => {
    // Concurrency lock
    if (isDetectingRef.current || isSwitchingBackendRef.current) return;
    if (!videoRef.current || !isModelsLoaded || !isActive) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) return;

    // Guard: backend pode estar undefined após context loss
    if (!isBackendReady()) {
      const ok = await ensureBackendReady();
      if (!ok) {
        try { await switchFaceApiToCpu(faceapi); } catch { /* noop */ }
        return;
      }
    }

    isDetectingRef.current = true;

    try {
      // Use TinyFaceDetector (much faster than SSD)
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 224,      // Smaller input = faster
          scoreThreshold: 0.5 
        }))
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withAgeAndGender()
        .withFaceExpressions();

      const now = new Date();

      for (let index = 0; index < detections.length; index++) {
        const detection = detections[index];
        
        // Allow detection even if not looking perfectly (for impressions)
        const isLooking = isFacingCamera(detection.landmarks);

        const rawAge = detection.age;
        const genderResult = getGender(detection.gender, detection.genderProbability);
        const confidence = detection.detection.score;
        
        // Get dominant expression
        const expressions = detection.expressions;
        const sortedExpressions = Object.entries(expressions)
          .sort(([, a], [, b]) => (b as number) - (a as number));
        const dominantExpression = sortedExpressions[0];

        // Find or create tracked face
        let trackId: string | null = null;
        let existingTracked: TrackedFace | undefined;

        if (detection.descriptor) {
          trackId = findMatchingTrackedFace(detection.descriptor);
          if (trackId) {
            existingTracked = trackedFacesRef.current.get(trackId);
          }
        }

        if (trackId && existingTracked) {
          // Update existing face
          existingTracked.lastSeenAt = now;
          existingTracked.descriptor = detection.descriptor;
          existingTracked.ageEstimates.push(rawAge);
          if (existingTracked.ageEstimates.length > 8) {
            existingTracked.ageEstimates.shift();
          }
          existingTracked.emotions.push({
            expression: dominantExpression[0],
            probability: dominantExpression[1] as number
          });
          if (existingTracked.emotions.length > 8) {
            existingTracked.emotions.shift();
          }
          existingTracked.confidence = confidence;
          // Keep highest "looking" confidence
          if (isLooking) (existingTracked as any).isLooking = true;
        } else {
          // Create new tracked face
          trackId = `track_${now.getTime()}_${index}`;
          
          trackedFacesRef.current.set(trackId, {
            descriptor: detection.descriptor,
            firstSeenAt: now,
            lastSeenAt: now,
            gender: genderResult.db,
            genderDisplay: genderResult.display,
            ageEstimates: [rawAge],
            emotions: [{ expression: dominantExpression[0], probability: dominantExpression[1] as number }],
            confidence,
            loggedToServer: false,
            // Custom field to track if they ever looked at camera
            ...( { isLooking } as any)
          });
        }
      }

      // Update active faces state
      const active: DetectedFace[] = [];
      
      trackedFacesRef.current.forEach((tracked, trackId) => {
        if (now.getTime() - tracked.lastSeenAt.getTime() <= FACE_TIMEOUT_MS) {
          const avgAge = calculateAverageAge(tracked.ageEstimates);
          const emotion = getMostFrequentEmotion(tracked.emotions);
          const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
          
          active.push({
            trackId,
            gender: tracked.genderDisplay,
            age: avgAge,
            ageGroup: getAgeGroupDisplay(avgAge),
            emotion: emotion.expression,
            emotionConfidence: emotion.probability,
            confidence: tracked.confidence,
            attentionDuration: duration,
            firstSeenAt: tracked.firstSeenAt,
            lastSeenAt: tracked.lastSeenAt
          });
        }
      });
      
      setActiveFaces(active);
      
    } catch (error) {
      console.error('[PlayerDetection] Detection error:', error);

      if (isFaceApiBackendError(error) && !isSwitchingBackendRef.current) {
        isSwitchingBackendRef.current = true;
        try {
          const backend = await switchFaceApiToCpu(faceapi);
          console.warn('[PlayerDetection] Backend recovered:', backend);
        } catch (fallbackError) {
          console.error('[PlayerDetection] CPU fallback failed:', fallbackError);
        } finally {
          isSwitchingBackendRef.current = false;
        }
      }
    } finally {
      isDetectingRef.current = false;
    }
  }, [isModelsLoaded, isActive, findMatchingTrackedFace]);

  // Clean up old faces and queue logs for server
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [trackId, tracked] of trackedFacesRef.current.entries()) {
        if (now - tracked.lastSeenAt.getTime() > FACE_TIMEOUT_MS) {
          const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
          const avgAge = calculateAverageAge(tracked.ageEstimates);
          const emotion = getMostFrequentEmotion(tracked.emotions);
          
          // Queue log if meaningful attention and not already sent
          if (duration >= MIN_ATTENTION_DURATION && !tracked.loggedToServer) {
            const content = currentContentRef.current;
            pendingLogsRef.current.push({
              confidence: tracked.confidence,
              is_facing_camera: (tracked as any).isLooking ?? false,
              detected_at: tracked.firstSeenAt.toISOString(),
              age: avgAge,
              age_group: getAgeGroup(avgAge),
              gender: tracked.gender, // DB-compatible: 'male'/'female'/'unknown'
              emotion: emotion.expression,
              emotion_confidence: emotion.probability,
              attention_duration: Math.round(duration * 10) / 10,
              content_id: content?.contentId || null,
              content_name: content?.contentName || null,
              playlist_id: content?.playlistId || null,
              // Convert descriptor (Float32Array) to basic array for JSON
              face_descriptor: Array.from(tracked.descriptor || []),
              metadata: {
                track_id: trackId,
                session_end: tracked.lastSeenAt.toISOString()
              }
            });
            tracked.loggedToServer = true;
          }
          
          trackedFacesRef.current.delete(trackId);
        }
      }
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Periodic server sync - less frequent to reduce load
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pendingLogsRef.current.length > 0) {
        sendLogsToServer();
      }
    }, BATCH_SEND_INTERVAL_MS);

    return () => clearInterval(syncInterval);
  }, [sendLogsToServer]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (isActive && isModelsLoaded) {
      startCamera().then(success => {
        if (success) {
          detectionIntervalRef.current = setInterval(detectFaces, DETECTION_INTERVAL_MS);
        }
      });
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      stopCamera();
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      stopCamera();
    };
  }, [isActive, isModelsLoaded, startCamera, stopCamera, detectFaces]);

  // Flush logs on unmount
  useEffect(() => {
    return () => {
      if (pendingLogsRef.current.length > 0) {
        sendLogsToServer();
      }
    };
  }, [sendLogsToServer]);

  return {
    isModelsLoaded,
    isLoading,
    activeFaces,
    totalDetectionsToday
  };
};
