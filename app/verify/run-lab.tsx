import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import { analyzeRun } from '@/domain/runEngine/analyze';
import type { RunAnalysis, RunTrace } from '@/domain/runEngine/types';
import { RunTracker, type RunCaptureResult } from '@/features/verification/RunTracker';
import { formatDistance, formatDuration } from '@/lib/format';
import { parseRepsInput } from '@/lib/parse';
import { useTheme } from '@/theme';

/**
 * Run Lab — internal calibration tooling, not a candidate feature.
 *
 * Record a real GPS trace outside any verification session, enter the
 * measured reference distance of the course (a track, a wheel-measured
 * route), and inspect everything the engine concluded. "Copy trace" exports
 * the raw trace JSON — wrap it as
 * {"referenceMeters": <course length>, "trace": <paste>} and drop it into
 * src/domain/runEngine/fixtures/ to add it to the accuracy benchmark.
 */

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text variant="bodySm" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodySm" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

export default function RunLabScreen() {
  const theme = useTheme();
  const [captured, setCaptured] = useState<RunCaptureResult | null>(null);
  const [referenceText, setReferenceText] = useState('2414');
  const [analysis, setAnalysis] = useState<RunAnalysis | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const referenceMeters = parseRepsInput(referenceText);

  const analyze = (trace: RunTrace) => {
    if (referenceMeters === null || referenceMeters <= 0) {
      return;
    }
    setAnalysis(analyzeRun({ trace, requiredDistanceMeters: referenceMeters }));
  };

  const copy = async (label: string, payload: unknown) => {
    await Clipboard.setStringAsync(JSON.stringify(payload));
    setCopied(label);
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      testID="run-lab"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Card style={{ gap: theme.spacing.sm }}>
        <Text variant="labelSm" color="accent">
          RUN LAB — INTERNAL
        </Text>
        <Text variant="bodySm" color="textSecondary">
          Calibration tooling. Record a run on a course whose true length you know, then
          compare what the engine measured. Nothing here creates evidence or touches
          verification.
        </Text>
      </Card>

      <TextField
        label="Reference distance (metres)"
        value={referenceText}
        onChangeText={setReferenceText}
        keyboardType="numbers-and-punctuation"
        helper="The measured course length — 2414 for 1.5 miles, 1609 for a mile, 400 per track lap."
        testID="lab-reference"
      />

      <RunTracker
        challengeCode="RUN-LAB"
        requiredDistanceMeters={referenceMeters ?? 2414}
        onCaptured={(result) => {
          setCaptured(result);
          analyze(result.trace);
        }}
      />

      {captured && analysis ? (
        <>
          <Card padded={false}>
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
              <Text variant="labelSm" color="textTertiary">
                MEASUREMENT
              </Text>
              <Row label="Verdict" value={analysis.verdict} />
              <Row label="Reasons" value={analysis.reasonCodes.join(', ') || '—'} />
              <Row label="Raw distance" value={formatDistance(analysis.rawDistanceMeters)} />
              <Row
                label="Computed distance"
                value={formatDistance(analysis.computedDistanceMeters)}
              />
              <Row
                label="Reference"
                value={referenceMeters === null ? '—' : formatDistance(referenceMeters)}
              />
              <Row
                label="Error vs reference"
                value={
                  referenceMeters === null
                    ? '—'
                    : `${(
                        ((analysis.computedDistanceMeters - referenceMeters) /
                          referenceMeters) *
                        100
                      ).toFixed(2)}%`
                }
              />
              <Row
                label="Uncertainty"
                value={`±${formatDistance(analysis.distanceUncertaintyMeters)}`}
              />
              <Row
                label="Accepted time @ reference"
                value={
                  analysis.acceptedTimeSeconds === null
                    ? '—'
                    : `${formatDuration(analysis.acceptedTimeSeconds)} ±${
                        analysis.acceptedTimeUncertaintySeconds ?? 0
                      }s`
                }
              />
              <Row label="Elapsed" value={formatDuration(analysis.elapsedSeconds)} />
            </View>
            <Divider />
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
              <Text variant="labelSm" color="textTertiary">
                SIGNAL & CONTINUITY
              </Text>
              <Row label="Samples" value={`${analysis.quality.sampleCount}`} />
              <Row label="Dropped" value={`${analysis.quality.droppedSampleCount}`} />
              <Row
                label="Median accuracy"
                value={
                  analysis.quality.medianAccuracyMeters === null
                    ? '—'
                    : `${analysis.quality.medianAccuracyMeters.toFixed(1)}m`
                }
              />
              <Row label="Coverage" value={`${(analysis.quality.coverage * 100).toFixed(1)}%`} />
              <Row
                label="Gaps"
                value={`${analysis.quality.gapCount} (max ${analysis.quality.maxGapSeconds}s)`}
              />
              <Row
                label="Backgrounded"
                value={`${analysis.continuity.backgroundInterruptions}×`}
              />
              <Row
                label="Confidences"
                value={`sig ${analysis.confidences.signalQuality} · cont ${analysis.confidences.continuity} · plaus ${analysis.confidences.plausibility}`}
              />
            </View>
            {analysis.anomalies.length > 0 ? (
              <>
                <Divider />
                <View style={{ padding: theme.spacing.lg, gap: theme.spacing.xxs }}>
                  <Text variant="labelSm" color="textTertiary">
                    ANOMALIES
                  </Text>
                  {analysis.anomalies.map((anomaly) => (
                    <Text key={anomaly.code} variant="caption" color="textSecondary">
                      {`[${anomaly.severity}] ${anomaly.detail}`}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </Card>

          <Button
            label="Copy raw trace JSON"
            variant="secondary"
            onPress={() => void copy('trace', captured.trace)}
          />
          <Button
            label="Copy analysis JSON"
            variant="secondary"
            onPress={() => void copy('analysis', analysis)}
          />
          {copied ? (
            <Text variant="caption" color="statusOnTarget">
              {`Copied ${copied}. For the benchmark: {"referenceMeters": ${referenceMeters ?? 0}, "trace": <paste>} → src/domain/runEngine/fixtures/`}
            </Text>
          ) : null}
          <Button
            label="Re-analyse with current reference"
            variant="ghost"
            onPress={() => captured && analyze(captured.trace)}
          />
        </>
      ) : null}
    </Screen>
  );
}
