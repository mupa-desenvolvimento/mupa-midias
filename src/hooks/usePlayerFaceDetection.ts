import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';

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
  gender: 'masculino' | 'feminino' | 'indefinido';
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

const FACE_MATCH_THRESHOLD = 0.45;
const FACE_TIMEOUT_MS = 2000;
const DETECTION_INTERVAL_MS = 800;
const MIN_ATTENTION_DURATION = 1; // Segundos mínimos para registrar

const getAgeGroup = (age: number): string => {
  if (age <= 12) return '0-12';
  if (age <= 18) return '13-18';
  if (age <= 25) return '19-25';
  if (age <= 35) return '26-35';
  if (age <= 50) return '36-50';
  return '51+';
};

const getGender = (gender: string, probability: number): 'masculino' | 'feminino' | 'indefinido' => {
  if (probability < 0.7) return 'indefinido';
  if (gender === 'female') return 'feminino';
  if (gender === 'male') return 'masculino';
  return 'indefinido';
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
  // Use external ref if provided, otherwise use internal
  const videoRef = externalVideoRef || internalVideoRef;
  
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackedFacesRef = useRef<Map<string, TrackedFace>>(new Map());
  const pendingLogsRef = useRef<any[]>([]);

  // Load models including expression detection
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);

        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        // Warm-up detection to initialize backend
        try {
          const dummyCanvas = document.createElement('canvas');
          dummyCanvas.width = 20;
          dummyCanvas.height = 20;
          await faceapi.detectAllFaces(dummyCanvas, new faceapi.TinyFaceDetectorOptions());
          console.log('[PlayerDetection] Warm-up OK, backend:', (faceapi.tf as any)?.getBackend?.());
        } catch (e) {
          console.warn('[PlayerDetection] Warm-up failed:', e);
        }
        
        setIsModelsLoaded(true);
        console.log('[PlayerDetection] Models loaded (including expressions)');
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
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      streamRef.current = stream;
      
      // If we don't have an external ref and haven't created an internal one, create it now
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
        // Ensure properties are set for inline playback
        videoEl.setAttribute('autoplay', '');
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('playsinline', '');
        
        await videoEl.play();
        console.log('[PlayerDetection] Camera started');
        return true;
      } else {
        console.warn('[PlayerDetection] No video element available to attach stream');
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
    
    // Clear srcObject for both internal and external refs
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.srcObject = null;
    }
    
    // Only remove the internal video element if we created it
    if (internalVideoRef.current && internalVideoRef.current.parentNode) {
      internalVideoRef.current.parentNode.removeChild(internalVideoRef.current);
      internalVideoRef.current = null;
    }
  }, []); // Remove dependency on videoRef since it's derived or stable ref

  // Send logs to server
  const sendLogsToServer = useCallback(async () => {
    if (pendingLogsRef.current.length === 0) return;
    
    const logsToSend = [...pendingLogsRef.current];
    pendingLogsRef.current = [];
    
    try {
      const { error } = await supabase.functions.invoke('device-detection', {
        body: {
          device_serial: deviceCode,
          detections: logsToSend
        }
      });
      
      if (error) {
        console.error('[PlayerDetection] Error sending logs:', error);
        // Put logs back on failure
        pendingLogsRef.current = [...logsToSend, ...pendingLogsRef.current];
      } else {
        setTotalDetectionsToday(prev => prev + logsToSend.length);
        console.log(`[PlayerDetection] Sent ${logsToSend.length} detections`);
      }
    } catch (error) {
      console.error('[PlayerDetection] Send error:', error);
      pendingLogsRef.current = [...logsToSend, ...pendingLogsRef.current];
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
      } catch (error) {
        console.error('[PlayerDetection] Descriptor comparison error:', error);
      }
    }
    return bestMatch?.trackId || null;
  }, []);

  // Main detection loop
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !isModelsLoaded || !isActive) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withAgeAndGender()
        .withFaceExpressions();

      const now = new Date();
      const currentTrackIds = new Set<string>();

      for (let index = 0; index < detections.length; index++) {
        const detection = detections[index];
        
        // Skip faces not looking at camera
        if (!isFacingCamera(detection.landmarks)) continue;

        const rawAge = detection.age;
        const gender = getGender(detection.gender, detection.genderProbability);
        const confidence = detection.detection.score;
        
        // Get dominant expression
        const expressions = detection.expressions;
        const sortedExpressions = Object.entries(expressions)
          .sort(([, a], [, b]) => b - a);
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
          if (existingTracked.ageEstimates.length > 10) {
            existingTracked.ageEstimates.shift();
          }
          existingTracked.emotions.push({
            expression: dominantExpression[0],
            probability: dominantExpression[1]
          });
          if (existingTracked.emotions.length > 10) {
            existingTracked.emotions.shift();
          }
          existingTracked.confidence = confidence;
        } else {
          // Create new tracked face
          trackId = `track_${now.getTime()}_${index}`;
          
          trackedFacesRef.current.set(trackId, {
            descriptor: detection.descriptor,
            firstSeenAt: now,
            lastSeenAt: now,
            gender,
            ageEstimates: [rawAge],
            emotions: [{ expression: dominantExpression[0], probability: dominantExpression[1] }],
            confidence,
            loggedToServer: false
          });
        }

        currentTrackIds.add(trackId);
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
            gender: tracked.gender,
            age: avgAge,
            ageGroup: getAgeGroup(avgAge),
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
    }
  }, [isModelsLoaded, isActive, findMatchingTrackedFace]);

  // Clean up old faces and log to server
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [trackId, tracked] of trackedFacesRef.current.entries()) {
        if (now - tracked.lastSeenAt.getTime() > FACE_TIMEOUT_MS) {
          const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
          const avgAge = calculateAverageAge(tracked.ageEstimates);
          const emotion = getMostFrequentEmotion(tracked.emotions);
          
          // Log to server if duration >= minimum and not already logged
          if (duration >= MIN_ATTENTION_DURATION && !tracked.loggedToServer) {
            pendingLogsRef.current.push({
              confidence: tracked.confidence,
              is_facing_camera: true,
              detected_at: tracked.firstSeenAt.toISOString(),
              age: avgAge,
              age_group: getAgeGroup(avgAge),
              gender: tracked.gender,
              emotion: emotion.expression,
              emotion_confidence: emotion.probability,
              attention_duration: duration,
              content_id: currentContent?.contentId || null,
              content_name: currentContent?.contentName || null,
              playlist_id: currentContent?.playlistId || null,
              metadata: {
                track_id: trackId,
                session_end: tracked.lastSeenAt.toISOString()
              }
            });
          }
          
          trackedFacesRef.current.delete(trackId);
        }
      }
    }, 500);

    return () => clearInterval(cleanupInterval);
  }, [currentContent]);

  // Periodic server sync
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pendingLogsRef.current.length > 0) {
        sendLogsToServer();
      }
    }, 5000);

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
