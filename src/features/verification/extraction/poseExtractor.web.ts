import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

import type {
  CalisthenicsLandmarks,
  LandmarkFrame,
  LandmarkPoint,
  LandmarkStream,
} from '@/domain/calisthenicsEngine/types';

import {
  EXTRACTION_FPS,
  EXTRACTOR_NAME,
  EXTRACTOR_VERSION,
  MODEL_ASSET_PATH,
  WASM_ASSET_PATH,
} from './constants';

/**
 * Video → landmark stream, in the browser (the review console).
 *
 * Shadow-side measurement only: the stream this produces feeds the M3C-1
 * analyzer and the labeling workflow; nothing here can touch a verdict. The
 * source video is read, never written — extraction produces a separate
 * derived artifact.
 *
 * Deterministic-leaning by construction: frames are visited by seeking at a
 * fixed cadence (not by racing playback), so the same video yields the same
 * timestamps every run. MediaPipe inference itself may vary at floating-
 * point margins across machines; the extractor identity is stamped so any
 * such drift is attributable.
 */

// MediaPipe pose landmark indices.
const MP = {
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function getLandmarker(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ASSET_PATH);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_ASSET_PATH },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  })();
  return landmarkerPromise;
}

function toPoint(
  landmark: { x: number; y: number; visibility?: number } | undefined,
): LandmarkPoint {
  if (!landmark) {
    return { x: 0, y: 0, visibility: 0 };
  }
  return { x: landmark.x, y: landmark.y, visibility: landmark.visibility ?? 0 };
}

function midpoint(a: LandmarkPoint, b: LandmarkPoint): LandmarkPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', () => reject(new Error('video seek failed')), {
      once: true,
    });
    video.currentTime = seconds;
  });
}

export interface ExtractionResult {
  stream: LandmarkStream;
  durationSeconds: number;
  fps: number;
}

/**
 * Extracts a landmark stream from a video URL (signed evidence URL or a
 * local object URL from the lab's file picker).
 */
export async function extractLandmarkStream(
  videoUrl: string,
  sourceEvidenceId: string | null,
  sourceEvidenceHash: string | null,
  onProgress?: (fraction: number) => void,
): Promise<ExtractionResult> {
  const landmarker = await getLandmarker();

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('video failed to load')), {
      once: true,
    });
  });

  const durationSeconds = video.duration;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('video has no readable duration');
  }

  const stepSeconds = 1 / EXTRACTION_FPS;
  const frames: LandmarkFrame[] = [];

  for (let tSeconds = 0; tSeconds < durationSeconds; tSeconds += stepSeconds) {
    await seekTo(video, tSeconds);
    const tMs = Math.round(tSeconds * 1000);
    const result = landmarker.detectForVideo(video, tMs);
    const pose = result.landmarks?.[0];

    const get = (index: number) => toPoint(pose?.[index]);
    const landmarks: CalisthenicsLandmarks = {
      // MediaPipe has no chin point; the mouth-corner midpoint is the chin
      // proxy. Its offset from the true chin is an M3C-2 finding to
      // measure, not to hide — the extractor name on the stream says
      // exactly which proxy produced it.
      chin: midpoint(get(MP.mouthLeft), get(MP.mouthRight)),
      leftWrist: get(MP.leftWrist),
      rightWrist: get(MP.rightWrist),
      leftElbow: get(MP.leftElbow),
      rightElbow: get(MP.rightElbow),
      leftShoulder: get(MP.leftShoulder),
      rightShoulder: get(MP.rightShoulder),
      leftHip: get(MP.leftHip),
      rightHip: get(MP.rightHip),
      leftKnee: get(MP.leftKnee),
      rightKnee: get(MP.rightKnee),
      leftAnkle: get(MP.leftAnkle),
      rightAnkle: get(MP.rightAnkle),
    };
    frames.push({ tMs, landmarks });
    onProgress?.(Math.min(1, tSeconds / durationSeconds));
  }

  video.src = '';

  return {
    stream: {
      formatVersion: 1,
      extractorName: EXTRACTOR_NAME,
      extractorVersion: EXTRACTOR_VERSION,
      sourceEvidenceId,
      sourceEvidenceHash,
      frames,
    },
    durationSeconds,
    fps: EXTRACTION_FPS,
  };
}
