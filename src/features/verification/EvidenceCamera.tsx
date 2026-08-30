import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

/**
 * In-app evidence capture. The camera the app controls is the whole point:
 * no camera-roll uploads, no gallery picker, no path for pre-existing
 * footage. Recording duration is measured from timestamps, not ticks.
 *
 * The challenge overlay is rendered on screen for the candidate, and the
 * candidate reads it aloud at the start — the spoken code in the audio track
 * is what binds the footage to the session. (Burning pixels into the video
 * file needs post-processing no Expo Go build can do; the audio challenge,
 * the hash committed at stop, and the server-clocked window carry the
 * binding instead.)
 */

export interface EvidenceCameraProps {
  challengeCode: string;
  /** Extra line under the challenge, e.g. "Event 3 of 5 — Push-Ups". */
  contextLabel: string;
  onCaptured: (localUri: string, durationSeconds: number) => void;
  disabled?: boolean;
}

export function EvidenceCamera({
  challengeCode,
  contextLabel,
  onCaptured,
  disabled = false,
}: EvidenceCameraProps) {
  const theme = useTheme();
  const cameraRef = useRef<CameraView | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [microphonePermission, requestMicrophone] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (Platform.OS === 'web') {
    return (
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="headline">Camera capture needs the phone</Text>
        <Text variant="bodySm" color="textSecondary">
          Verified evidence is recorded through the app on your phone. Open Zero Phase in
          Expo Go to record this event.
        </Text>
      </Card>
    );
  }

  if (!cameraPermission?.granted || !microphonePermission?.granted) {
    return (
      <Card style={{ gap: theme.spacing.lg }}>
        <Text variant="bodySm" color="textSecondary">
          Recording needs the camera and microphone. The spoken session code is part of the
          evidence.
        </Text>
        <Button
          label="Allow camera and microphone"
          onPress={async () => {
            await requestCamera();
            await requestMicrophone();
          }}
          testID="grant-camera"
        />
      </Card>
    );
  }

  const start = async () => {
    const camera = cameraRef.current;
    if (!camera || recording) {
      return;
    }
    setFailure(null);
    setRecording(true);
    startedAtRef.current = Date.now();
    try {
      const video = await camera.recordAsync({ maxDuration: 60 * 15 });
      const startedAt = startedAtRef.current;
      if (video?.uri && startedAt) {
        onCaptured(video.uri, Math.round((Date.now() - startedAt) / 1000));
      } else {
        setFailure('The recording did not produce a file. Try again.');
      }
    } catch {
      setFailure('Recording failed. Check storage space and try again.');
    } finally {
      setRecording(false);
      startedAtRef.current = null;
    }
  };

  const stop = () => {
    cameraRef.current?.stopRecording();
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          borderRadius: theme.radii.md,
          overflow: 'hidden',
          borderWidth: theme.hairline.width,
          borderColor: theme.colors.border,
        }}
      >
        <CameraView
          ref={cameraRef}
          mode="video"
          facing="back"
          style={{ aspectRatio: 3 / 4, width: '100%' }}
        />
        {/* The on-screen challenge. Read it aloud on camera at the start. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: theme.spacing.md,
            left: theme.spacing.md,
            right: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.overlay,
          }}
        >
          <Text variant="metricMd" color="accent">
            {challengeCode}
          </Text>
          <Text variant="caption" color="textSecondary">
            {contextLabel}
          </Text>
        </View>
      </View>

      {failure ? (
        <Text variant="caption" color="statusOffTarget">
          {failure}
        </Text>
      ) : null}

      {recording ? (
        <Button label="Stop recording" variant="destructive" onPress={stop} testID="stop-recording" />
      ) : (
        <Button
          label="Start recording"
          disabled={disabled}
          onPress={start}
          testID="start-recording"
        />
      )}
      <Text variant="caption" color="textTertiary">
        Say the session code out loud as your first words on camera. Recording stops the
        moment you tap stop; the file is fingerprinted immediately.
      </Text>
    </View>
  );
}
