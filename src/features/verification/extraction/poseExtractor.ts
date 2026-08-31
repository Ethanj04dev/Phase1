import type { LandmarkStream } from '@/domain/calisthenicsEngine/types';

/**
 * Native platforms cannot run the browser extractor. Extraction lives in
 * the review console (web) during shadow development, and moves to the
 * server worker on the promotion path — never to candidate devices for
 * anything that matters.
 */

export interface ExtractionResult {
  stream: LandmarkStream;
  durationSeconds: number;
  fps: number;
}

export async function extractLandmarkStream(
  _videoUrl: string,
  _sourceEvidenceId: string | null,
  _sourceEvidenceHash: string | null,
  _onProgress?: (fraction: number) => void,
): Promise<ExtractionResult> {
  throw new Error('Pose extraction runs in the web review console only.');
}
