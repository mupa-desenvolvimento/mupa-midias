import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { usePeopleRegistry } from './usePeopleRegistry';
import { useDetectionLog } from './useDetectionLog';
import { useAttentionHistory } from './useAttentionHistory';
import { initializeFaceApiBackend, isFaceApiBackendError, switchFaceApiToCpu } from '@/lib/faceApiBackend';
import { ensureBlazeFaceDetector, quickDetectFaces } from '@/lib/blazeFaceDetector';
// Emotion types from face-api.js
export type EmotionType = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised';

export interface EmotionData {
  emotion: EmotionType;
  confidence: number;
  allEmotions: Record<EmotionType, number>;
}

// Face currently being tracked (looking at camera now)
export interface ActiveFace {
  trackId: string;
  personId?: string;
  name?: string;
  cpf?: string;
  gender: 'masculino' | 'feminino' | 'indefinido';
  ageGroup: '0-12' | '13-18' | '19-25' | '26-35' | '36-50' | '51+';
  age: number;
  ageEstimates: number[]; // Store multiple age readings for averaging
  confidence: number;
  position: { x: number; y: number; width: number; height: number };
  isRegistered: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lookingDuration: number;
  emotion: EmotionData;
}

interface TrackedFaceData {
  descriptor: Float32Array;
  firstSeenAt: Date;
  lastSeenAt: Date;
  personId?: string;
  personName?: string;
  personCpf?: string;
  isRegistered: boolean;
  gender: 'masculino' | 'feminino' | 'indefinido';
  ageGroup: '0-12' | '13-18' | '19-25' | '26-35' | '36-50' | '51+';
  ageEstimates: number[];
  confidence: number;
  position: { x: number; y: number; width: number; height: number };
  loggedToHistory: boolean;
  emotion: EmotionData;
}

const getAgeGroup = (age: number): '0-12' | '13-18' | '19-25' | '26-35' | '36-50' | '51+' => {
  if (age <= 12) return '0-12';
  if (age <= 18) return '13-18';
  if (age <= 25) return '19-25';
  if (age <= 35) return '26-35';
  if (age <= 50) return '36-50';
  return '51+';
};

const getGender = (gender: string, genderProbability: number): 'masculino' | 'feminino' | 'indefinido' => {
  // Only classify if confidence is above 70%
  if (genderProbability < 0.7) return 'indefinido';
  if (gender === 'female') return 'feminino';
  if (gender === 'male') return 'masculino';
  return 'indefinido';
};

// Calculate average age from estimates, removing outliers
const calculateAverageAge = (estimates: number[]): number => {
  if (estimates.length === 0) return 0;
  if (estimates.length === 1) return Math.round(estimates[0]);
  
  // Sort and remove top/bottom 20% as outliers if we have enough samples
  const sorted = [...estimates].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.2);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  
  if (trimmed.length === 0) return Math.round(sorted[Math.floor(sorted.length / 2)]);
  
  const sum = trimmed.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / trimmed.length);
};

// Check if face is looking at camera using landmarks
const isFacingCamera = (landmarks: faceapi.FaceLandmarks68): boolean => {
  const positions = landmarks.positions;
  
  // Get key facial points
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  
  // Calculate eye centers
  const leftEyeCenter = {
    x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
    y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
  };
  const rightEyeCenter = {
    x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
    y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length
  };
  
  // Get nose tip (index 30 in 68-point model)
  const noseTip = positions[30];
  
  // Calculate face width (distance between eyes)
  const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
  
  // Calculate center point between eyes
  const eyesCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  
  // Calculate horizontal offset of nose from eyes center
  const noseOffset = Math.abs(noseTip.x - eyesCenterX);
  
  // Calculate ratio - if nose is too far from center, face is turned
  const turnRatio = noseOffset / eyeDistance;
  
  // Threshold: if nose offset is more than 25% of eye distance, face is turned away
  const horizontalThreshold = 0.25;
  
  // Also check vertical alignment - get jaw outline for face tilt
  const jawOutline = landmarks.getJawOutline();
  const jawLeft = jawOutline[0];
  const jawRight = jawOutline[16];
  
  // Calculate face tilt (if one side of jaw is much higher than other)
  const jawTilt = Math.abs(jawLeft.y - jawRight.y) / eyeDistance;
  const tiltThreshold = 0.4;
  
  const isFacingHorizontally = turnRatio < horizontalThreshold;
  const isNotTilted = jawTilt < tiltThreshold;
  
  return isFacingHorizontally && isNotTilted;
};

const FACE_MATCH_THRESHOLD = 0.45; // Stricter threshold for better matching
const FACE_TIMEOUT_MS = 2000; // Remove tracked face after 2 seconds of not being seen
const DETECTION_INTERVAL_MS = 500; // Faster detection for smoother tracking

export const useFaceDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  isActive: boolean
) => {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [activeFaces, setActiveFaces] = useState<ActiveFace[]>([]); // Currently looking
  const [isLoading, setIsLoading] = useState(false);
  const [totalSessionsToday, setTotalSessionsToday] = useState(0);
  
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false);
  const isSwitchingBackendRef = useRef(false);
  const lastDetectedPersonsRef = useRef<Set<string>>(new Set());
  const trackedFacesRef = useRef<Map<string, TrackedFaceData>>(new Map());
  
  const { registeredPeople } = usePeopleRegistry();
  const { logDetection } = useDetectionLog();
  const { addAttentionRecord } = useAttentionHistory();
  const registeredPeopleRef = useRef(registeredPeople);
  const logDetectionRef = useRef(logDetection);


  useEffect(() => {
    registeredPeopleRef.current = registeredPeople;
  }, [registeredPeople]);

  useEffect(() => {
    logDetectionRef.current = logDetection;
  }, [logDetection]);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        
        const MODEL_URL = '/models';
        
        // Load TinyFaceDetector (lighter) + SSD as fallback
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        const backend = await initializeFaceApiBackend(faceapi);
        console.log('[FaceDetection] Warm-up successful, backend:', backend);

        // Warm up BlazeFace pre-filter (non-blocking — failures degrade gracefully)
        ensureBlazeFaceDetector().then((d) => {
          console.log('[FaceDetection] BlazeFace pre-filter:', d ? 'ready' : 'unavailable (using face-api only)');
        });

        setIsModelsLoaded(true);
        console.log('[FaceDetection] Models loaded successfully');
      } catch (error) {
        console.error('[FaceDetection] Error loading models:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Find matching tracked face by descriptor
  const findMatchingTrackedFace = useCallback((descriptor: Float32Array): string | null => {
    const trackedFaces = trackedFacesRef.current;
    let bestMatch: { trackId: string; distance: number } | null = null;
    
    for (const [trackId, tracked] of trackedFaces.entries()) {
      try {
        const distance = faceapi.euclideanDistance(descriptor, tracked.descriptor);
        if (distance < FACE_MATCH_THRESHOLD) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { trackId, distance };
          }
        }
      } catch (error) {
        console.error('Error comparing face descriptors:', error);
      }
    }
    return bestMatch?.trackId || null;
  }, []);

  // Default emotion when not detected yet
  const defaultEmotion: EmotionData = {
    emotion: 'neutral',
    confidence: 0,
    allEmotions: { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 }
  };

  // Update active faces state from tracked faces
  const updateActiveFacesState = useCallback(() => {
    const now = Date.now();
    const active: ActiveFace[] = [];
    
    trackedFacesRef.current.forEach((tracked, trackId) => {
      // Only include faces seen in the last FACE_TIMEOUT_MS
      if (now - tracked.lastSeenAt.getTime() <= FACE_TIMEOUT_MS) {
        const avgAge = calculateAverageAge(tracked.ageEstimates);
        const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
        
        active.push({
          trackId,
          personId: tracked.personId,
          name: tracked.personName,
          cpf: tracked.personCpf,
          gender: tracked.gender,
          ageGroup: getAgeGroup(avgAge),
          age: avgAge,
          ageEstimates: tracked.ageEstimates,
          confidence: tracked.confidence,
          position: tracked.position,
          isRegistered: tracked.isRegistered,
          firstSeenAt: tracked.firstSeenAt,
          lastSeenAt: tracked.lastSeenAt,
          lookingDuration: duration,
          emotion: tracked.emotion || defaultEmotion
        });
      }
    });
    
    setActiveFaces(active);
  }, []);

  // Clean up old tracked faces and save attention history
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const trackedFaces = trackedFacesRef.current;
      
      for (const [trackId, tracked] of trackedFaces.entries()) {
        if (now - tracked.lastSeenAt.getTime() > FACE_TIMEOUT_MS) {
          const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
          const avgAge = calculateAverageAge(tracked.ageEstimates);
          
          console.log(`Face saiu do frame: ${tracked.personName || 'Desconhecido'} - duração: ${duration.toFixed(1)}s, idade média: ${avgAge}`);
          
          // Save to attention history only if duration >= 1 second
          if (duration >= 1) {
            addAttentionRecord(
              trackId,
              tracked.personId,
              tracked.personName,
              tracked.isRegistered,
              tracked.gender,
              tracked.ageGroup,
              avgAge,
              tracked.firstSeenAt,
              tracked.lastSeenAt,
              duration
            );
            setTotalSessionsToday(prev => prev + 1);
          }
          
          trackedFaces.delete(trackId);
        }
      }
      
      updateActiveFacesState();
    }, 500);

    return () => clearInterval(cleanupInterval);
  }, [addAttentionRecord, updateActiveFacesState]);

  const detectFaces = useCallback(async () => {
    if (isDetectingRef.current || isSwitchingBackendRef.current) {
      return;
    }

    if (!videoRef.current || !canvasRef.current || !isModelsLoaded || !isActive) {
      console.log('[FaceDetection] Skip: ref=', !!videoRef.current, 'canvas=', !!canvasRef.current, 'models=', isModelsLoaded, 'active=', isActive);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('[FaceDetection] Skip: video dimensions', video.videoWidth, 'x', video.videoHeight, 'readyState=', video.readyState);
      return;
    }

    isDetectingRef.current = true;

    try {
      // Match canvas internal dimensions to CSS display size for proper overlay alignment
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate scale factors for object-cover video
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = displayWidth / displayHeight;
      let scaleX: number, scaleY: number, offsetX = 0, offsetY = 0;
      
      if (videoAspect > canvasAspect) {
        // Video is wider - cropped horizontally
        scaleY = displayHeight / video.videoHeight;
        scaleX = scaleY;
        offsetX = (displayWidth - video.videoWidth * scaleX) / 2;
      } else {
        // Video is taller - cropped vertically
        scaleX = displayWidth / video.videoWidth;
        scaleY = scaleX;
        offsetY = (displayHeight - video.videoHeight * scaleY) / 2;
      }

      // Fast pre-filter with BlazeFace: skip the heavy face-api pipeline when
      // no face is present. Falls back to running face-api directly if the
      // pre-filter is unavailable (returns []).
      const blazeBoxes = await quickDetectFaces(video);
      const blazeAvailable = blazeBoxes.length > 0 || (await ensureBlazeFaceDetector()) !== null;
      if (blazeAvailable && blazeBoxes.length === 0) {
        // No face on screen — skip expensive inference this tick.
        updateActiveFacesState();
        return;
      }

      // Use TinyFaceDetector for speed, with full pipeline
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withAgeAndGender()
        .withFaceExpressions();

      if (detections.length > 0) {
        console.log(`[FaceDetection] Detected ${detections.length} face(s)`);
      }

      const now = new Date();
      const currentTrackIds = new Set<string>();

      for (let index = 0; index < detections.length; index++) {
        const detection = detections[index];
        const box = detection.detection.box;
        const rawAge = detection.age;
        const genderProbability = detection.genderProbability;
        const genderString = detection.gender;
        const gender = getGender(genderString, genderProbability);
        const detectionConfidence = detection.detection.score;
        const isLooking = isFacingCamera(detection.landmarks);

        // Transform box coordinates to canvas space
        const drawX = box.x * scaleX + offsetX;
        const drawY = box.y * scaleY + offsetY;
        const drawW = box.width * scaleX;
        const drawH = box.height * scaleY;

        // Always draw the raw detection box, even if the face is not yet considered "looking"
        const previewColor = isLooking ? '#00ff88' : '#facc15';
        ctx.strokeStyle = previewColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX, drawY, drawW, drawH);

        ctx.font = 'bold 14px Arial';
        const previewLabel = isLooking ? `${gender} | ${Math.round(rawAge)} anos` : 'Face detectada';
        const previewLabelY = drawY > 50 ? drawY - 12 : drawY + drawH + 20;
        const previewTextWidth = ctx.measureText(previewLabel).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(drawX - 2, previewLabelY - 14, previewTextWidth + 8, 20);
        ctx.fillStyle = previewColor;
        ctx.fillText(previewLabel, drawX + 2, previewLabelY);

        // Keep the business logic filter for tracking/logging only
        if (!isLooking) {
          continue;
        }

        // Extract emotion data
        const expressions = detection.expressions;
        const emotionEntries = Object.entries(expressions) as [EmotionType, number][];
        const sortedEmotions = emotionEntries.sort((a, b) => b[1] - a[1]);
        const dominantEmotion = sortedEmotions[0];
        
        const emotionData: EmotionData = {
          emotion: dominantEmotion[0],
          confidence: dominantEmotion[1],
          allEmotions: {
            neutral: expressions.neutral,
            happy: expressions.happy,
            sad: expressions.sad,
            angry: expressions.angry,
            fearful: expressions.fearful,
            disgusted: expressions.disgusted,
            surprised: expressions.surprised
          }
        };

        // Find or create tracked face
        let trackId: string | null = null;
        let existingTracked: TrackedFaceData | undefined;
        
        if (detection.descriptor) {
          trackId = findMatchingTrackedFace(detection.descriptor);
          
          if (trackId) {
            existingTracked = trackedFacesRef.current.get(trackId);
          }
        }

        // Identify registered person
        let identifiedPerson: { id: string; name: string; cpf: string; confidence: number } | null = null;
        if (detection.descriptor) {
          for (const person of registeredPeopleRef.current) {
            try {
              const distance = faceapi.euclideanDistance(detection.descriptor, person.averageDescriptor);
              if (distance < 0.55) {
                identifiedPerson = {
                  id: person.id,
                  name: person.name,
                  cpf: person.cpf,
                  confidence: 1 - distance
                };
                break;
              }
            } catch (error) {
              console.error('Erro ao comparar face descriptor:', error);
            }
          }
        }

        const isRegistered = !!identifiedPerson;
        
        if (trackId && existingTracked) {
          existingTracked.lastSeenAt = now;
          existingTracked.descriptor = detection.descriptor;
          existingTracked.ageEstimates.push(rawAge);
          if (existingTracked.ageEstimates.length > 10) {
            existingTracked.ageEstimates.shift();
          }
          existingTracked.confidence = detectionConfidence;
          existingTracked.position = { x: box.x, y: box.y, width: box.width, height: box.height };
          
          if (identifiedPerson && !existingTracked.personId) {
            existingTracked.personId = identifiedPerson.id;
            existingTracked.personName = identifiedPerson.name;
            existingTracked.personCpf = identifiedPerson.cpf;
            existingTracked.isRegistered = true;
          }
          existingTracked.emotion = emotionData;
        } else {
          trackId = isRegistered ? identifiedPerson!.id : `track_${now.getTime()}_${index}`;
          
          trackedFacesRef.current.set(trackId, {
            descriptor: detection.descriptor,
            firstSeenAt: now,
            lastSeenAt: now,
            personId: identifiedPerson?.id,
            personName: identifiedPerson?.name,
            personCpf: identifiedPerson?.cpf,
            isRegistered,
            gender,
            ageGroup: getAgeGroup(rawAge),
            ageEstimates: [rawAge],
            confidence: detectionConfidence,
            position: { x: box.x, y: box.y, width: box.width, height: box.height },
            loggedToHistory: false,
            emotion: emotionData
          });
        }

        currentTrackIds.add(trackId);
        
        if (isRegistered && !lastDetectedPersonsRef.current.has(identifiedPerson!.id)) {
          logDetectionRef.current(
            identifiedPerson!.id,
            identifiedPerson!.name,
            identifiedPerson!.cpf,
            identifiedPerson!.confidence
          );
          
          lastDetectedPersonsRef.current.add(identifiedPerson!.id);
          setTimeout(() => {
            lastDetectedPersonsRef.current.delete(identifiedPerson!.id);
          }, 30000);
        }

        const tracked = trackedFacesRef.current.get(trackId);
        if (!tracked) continue;
        
        const avgAge = calculateAverageAge(tracked.ageEstimates);
        const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
        const color = tracked.isRegistered ? '#00ff00' : '#ff6600';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX, drawY, drawW, drawH);
        
        const label = tracked.isRegistered ? tracked.personName! : `${gender} | ${avgAge} anos`;
        const labelY = drawY > 50 ? drawY - 30 : drawY + drawH + 20;
        
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(drawX - 2, labelY - 14, textWidth + 8, 20);
        
        ctx.fillStyle = color;
        ctx.fillText(label, drawX + 2, labelY);
        
        ctx.font = '12px Arial';
        const durationLabel = `⏱ ${duration.toFixed(1)}s`;
        const durationY = drawY > 50 ? drawY - 10 : drawY + drawH + 38;
        const durationWidth = ctx.measureText(durationLabel).width;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(drawX - 2, durationY - 12, durationWidth + 8, 16);
        
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(durationLabel, drawX + 2, durationY);
      }

      updateActiveFacesState();
      
    } catch (error) {
      console.error('[FaceDetection] Error during face detection:', error);

      if (isFaceApiBackendError(error) && !isSwitchingBackendRef.current) {
        isSwitchingBackendRef.current = true;
        try {
          const backend = await switchFaceApiToCpu(faceapi);
          console.warn('[FaceDetection] Backend recovered with fallback:', backend);
        } catch (fallbackError) {
          console.error('[FaceDetection] CPU fallback failed:', fallbackError);
        } finally {
          isSwitchingBackendRef.current = false;
        }
      }
    } finally {
      isDetectingRef.current = false;
    }
  }, [videoRef, canvasRef, isModelsLoaded, isActive, findMatchingTrackedFace, updateActiveFacesState]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (isActive && isModelsLoaded) {
      console.log('[FaceDetection] Starting detection interval');
      detectionIntervalRef.current = setInterval(detectFaces, DETECTION_INTERVAL_MS);
    } else {
      isDetectingRef.current = false;
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      isDetectingRef.current = false;
    };
  }, [isActive, isModelsLoaded, detectFaces]);

  // Clear tracked faces when camera stops
  useEffect(() => {
    if (!isActive) {
      // Save all remaining tracked faces to history before clearing
      const now = new Date();
      trackedFacesRef.current.forEach((tracked, trackId) => {
        const duration = (tracked.lastSeenAt.getTime() - tracked.firstSeenAt.getTime()) / 1000;
        if (duration >= 1) {
          const avgAge = calculateAverageAge(tracked.ageEstimates);
          addAttentionRecord(
            trackId,
            tracked.personId,
            tracked.personName,
            tracked.isRegistered,
            tracked.gender,
            tracked.ageGroup,
            avgAge,
            tracked.firstSeenAt,
            tracked.lastSeenAt,
            duration
          );
        }
      });
      trackedFacesRef.current.clear();
      setActiveFaces([]);
    }
  }, [isActive, addAttentionRecord]);

  return {
    isModelsLoaded,
    isLoading,
    activeFaces, // Currently looking at camera
    totalLooking: activeFaces.length,
    totalSessionsToday
  };
};
