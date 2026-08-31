/**
 * Pose extractor identity — pinned exactly, stamped on every landmark
 * artifact and every shadow analysis. "Which model produced this stream" is
 * never a guess.
 */

export const EXTRACTOR_NAME = 'mediapipe_pose_landmarker_full';
/** The @mediapipe/tasks-vision npm package version (package.json pins it). */
export const EXTRACTOR_VERSION = '0.10.21';
/** SHA-256 of public/models/pose_landmarker_full.task (float16). */
export const MODEL_FILE_SHA256 =
  '4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad';

/** Served from the app's own origin — no CDN at extraction time. */
export const MODEL_ASSET_PATH = '/models/pose_landmarker_full.task';
export const WASM_ASSET_PATH = '/mediapipe-wasm';

/** Extraction sampling rate. Enough for 0.8s-minimum reps; cheap to raise. */
export const EXTRACTION_FPS = 15;
