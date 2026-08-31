import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { unstable_createElement } from 'react-native-web';

import { Text } from '@/components/primitives/Text';
import type {
  BarReference,
  CalisthenicsLandmarks,
  LandmarkStream,
  PullUpDiagnostics,
  RepRecord,
} from '@/domain/calisthenicsEngine/types';
import { useTheme } from '@/theme';

/**
 * Evidence video with the machine's eyes drawn on top: pose skeleton, the
 * estimated bar line, the current state-machine phase and rep windows. Web
 * only — this is review-console tooling, not a candidate surface.
 */

const BONES: [keyof CalisthenicsLandmarks, keyof CalisthenicsLandmarks][] = [
  ['leftWrist', 'leftElbow'],
  ['leftElbow', 'leftShoulder'],
  ['rightWrist', 'rightElbow'],
  ['rightElbow', 'rightShoulder'],
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['rightHip', 'rightKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightKnee', 'rightAnkle'],
];

const PHASE_COLORS: Record<string, string> = {
  seeking: '#8a95a1',
  hang: '#4d9fff',
  pull: '#4dc38f',
  return: '#e3b34c',
  blind: '#e06c5f',
};

export interface SkeletonOverlayProps {
  videoUrl: string;
  stream: LandmarkStream;
  diagnostics: PullUpDiagnostics | null;
  bar: BarReference | null;
  reps: readonly RepRecord[];
}

export function SkeletonOverlay({
  videoUrl,
  stream,
  diagnostics,
  bar,
  reps,
}: SkeletonOverlayProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        return;
      }
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
      }
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      const w = canvas.width;
      const h = canvas.height;
      context.clearRect(0, 0, w, h);

      const tMs = video.currentTime * 1000;
      // Nearest extracted frame.
      let nearest = stream.frames[0];
      for (const frame of stream.frames) {
        if (!nearest || Math.abs(frame.tMs - tMs) < Math.abs(nearest.tMs - tMs)) {
          nearest = frame;
        }
      }
      if (!nearest) {
        return;
      }

      // Bar line.
      if (bar) {
        context.strokeStyle = 'rgba(77,159,255,0.9)';
        context.setLineDash([8, 6]);
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, bar.lineY * h);
        context.lineTo(w, bar.lineY * h);
        context.stroke();
        context.setLineDash([]);
      }

      // Skeleton.
      context.strokeStyle = 'rgba(77,195,143,0.9)';
      context.lineWidth = 3;
      for (const [from, to] of BONES) {
        const a = nearest.landmarks[from];
        const b = nearest.landmarks[to];
        if (a.visibility < 0.4 || b.visibility < 0.4) {
          continue;
        }
        context.beginPath();
        context.moveTo(a.x * w, a.y * h);
        context.lineTo(b.x * w, b.y * h);
        context.stroke();
      }
      // Chin marker.
      const chin = nearest.landmarks.chin;
      if (chin.visibility >= 0.4) {
        context.fillStyle = 'rgba(227,179,76,0.95)';
        context.beginPath();
        context.arc(chin.x * w, chin.y * h, 5, 0, Math.PI * 2);
        context.fill();
      }

      // Phase + rep badge.
      const phase = diagnostics?.frames.reduce<null | { tMs: number; phase: string }>(
        (best, frame) =>
          frame.tMs <= tMs && (!best || frame.tMs > best.tMs) ? frame : best,
        null,
      );
      const rep = reps.find((item) => tMs >= item.startMs && tMs <= item.endMs);
      context.font = '13px monospace';
      context.fillStyle = PHASE_COLORS[phase?.phase ?? 'seeking'] ?? '#fff';
      context.fillText(
        `${phase?.phase ?? '—'}${rep ? ` · rep ${rep.repNumber} (${rep.verdict})` : ''}`,
        10,
        20,
      );
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bar, diagnostics, reps, stream]);

  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View style={{ position: 'relative', borderRadius: theme.radii.md, overflow: 'hidden' }}>
        {unstable_createElement('video', {
          ref: videoRef,
          src: videoUrl,
          controls: true,
          playsInline: true,
          crossOrigin: 'anonymous',
          style: { width: '100%', display: 'block' },
        })}
        {unstable_createElement('canvas', {
          ref: canvasRef,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          },
        })}
      </View>
      <Text variant="caption" color="textTertiary">
        Skeleton, estimated bar line (dashed), state-machine phase and rep windows are
        drawn from the extracted stream — the machine&rsquo;s view, on top of the evidence.
      </Text>
    </View>
  );
}
