import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { unstable_createElement } from 'react-native-web';

import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { TextField } from '@/components/primitives/TextField';
import type { ReviewEvidenceItem, RepLabel } from '@/data/repositories/types';
import { useRepositories } from '@/data/repositoryContext';
import { analyzePullUps } from '@/domain/calisthenicsEngine/analyze';
import {
  CALISTHENICS_ENGINE_NAME,
  CALISTHENICS_ENGINE_VERSION,
  CALISTHENICS_RULESET_VERSION,
} from '@/domain/calisthenicsEngine/ruleset';
import type {
  CalisthenicsAnalysis,
  LandmarkStream,
  PullUpDiagnostics,
} from '@/domain/calisthenicsEngine/types';
import { useTheme } from '@/theme';

import {
  EXTRACTION_FPS,
  EXTRACTOR_VERSION,
  MODEL_FILE_SHA256,
} from './extraction/constants';
import { extractLandmarkStream } from './extraction/poseExtractor';
import { SignalCharts } from './SignalCharts';
import { SkeletonOverlay } from './SkeletonOverlay.web';

/**
 * The M3C-2 workbench: extract → analyze (shadow) → label → understand.
 *
 * Everything here is measurement. The analyzer emits recommendations, the
 * shadow RPC refuses promoted engines, labels are ground truth for judging
 * the machine — nothing on this panel can create Zero Verified status.
 */

const LABELS = ['valid', 'invalid', 'uncertain'] as const;
const LABEL_REASONS = [
  'chin_below_bar',
  'incomplete_extension',
  'landmarks_occluded',
  'excessive_swing',
  'frame_loss',
  'other',
] as const;

const CORPUS_FIELDS = [
  { key: 'deviceClass', label: 'Device', options: ['iphone', 'android', 'other'] },
  { key: 'cameraAngleClass', label: 'Angle', options: ['front', 'angled', 'side'] },
  { key: 'cameraDistanceClass', label: 'Distance', options: ['near', 'medium', 'far'] },
  { key: 'lightingClass', label: 'Lighting', options: ['bright', 'dim', 'mixed'] },
  { key: 'environmentClass', label: 'Environment', options: ['gym', 'home', 'outdoor'] },
  { key: 'clothingContrastClass', label: 'Clothing', options: ['high_contrast', 'low_contrast'] },
  { key: 'bodyProportionClass', label: 'Body', options: ['short', 'average', 'tall'] },
  { key: 'movementStyle', label: 'Style', options: ['strict', 'some_swing', 'kipping'] },
] as const;

type CorpusKey = (typeof CORPUS_FIELDS)[number]['key'];

export interface PoseAnalysisPanelProps {
  /** Evidence mode: full shadow pipeline. Local mode: file-picker lab. */
  mode:
    | { kind: 'evidence'; attemptId: string; eventId: 'pull_ups'; evidence: ReviewEvidenceItem }
    | { kind: 'local' };
}

/** The real-footage calibration checklist (owner-defined, M3C-2 review). */
const CALIBRATION_SCENARIOS = [
  'ideal_side_angle',
  'camera_too_low',
  'camera_too_high',
  'camera_too_close',
  'camera_far',
  'bright_lighting',
  'dim_lighting',
  'low_contrast_clothing',
  'fast_reps',
  'slow_reps',
  'mild_sway',
  'deliberate_kipping',
  'chin_short_reps',
  'incomplete_lockout',
  'partial_final_rep',
  'brief_occlusion',
] as const;

type CalibrationScenario = (typeof CALIBRATION_SCENARIOS)[number];

/** One video's compact calibration record — copyable, comparable. */
interface CalibrationSummary {
  scenario: CalibrationScenario | null;
  fileName: string | null;
  analyzedAt: string;
  versions: {
    extractor: string;
    extractorVersion: string;
    modelSha256: string;
    engineVersion: string;
    rulesetVersion: number;
    extractionFps: number;
  };
  recommendation: string;
  reasonCodes: readonly string[];
  detectedReps: number;
  acceptedReps: number;
  uncertainReps: number;
  invalidReps: number;
  elapsedMs: number;
  bar: { provider: string; lineY: number; uncertainty: number } | null;
  visibility: { meanCore: number; minCore: number | null; framing: number };
  confidences: Record<string, number>;
  anomalies: readonly { code: string; severity: string }[];
  reps: readonly {
    n: number;
    startMs: number;
    endMs: number;
    verdict: string;
    reasons: readonly string[];
    chinClearance: number;
    lockoutDeg: number;
    bottomDeg: number;
    hipSwing: number;
    meanVis: number;
    seconds: number;
  }[];
}

function buildSummary(
  analysis: CalisthenicsAnalysis,
  diagnostics: PullUpDiagnostics | null,
  scenario: CalibrationScenario | null,
  fileName: string | null,
): CalibrationSummary {
  const minCore =
    diagnostics && diagnostics.frames.length > 0
      ? Math.min(...diagnostics.frames.map((frame) => frame.coreVisibility))
      : null;
  return {
    scenario,
    fileName,
    analyzedAt: new Date().toISOString(),
    versions: {
      extractor: analysis.extractorName,
      extractorVersion: analysis.extractorVersion,
      modelSha256: MODEL_FILE_SHA256,
      engineVersion: analysis.engineVersion,
      rulesetVersion: analysis.rulesetVersion,
      extractionFps: EXTRACTION_FPS,
    },
    recommendation: analysis.recommendation,
    reasonCodes: analysis.reasonCodes,
    detectedReps: analysis.detectedReps,
    acceptedReps: analysis.acceptedReps,
    uncertainReps: analysis.uncertainReps,
    invalidReps: analysis.invalidReps,
    elapsedMs: analysis.elapsedMs,
    bar: analysis.barReference
      ? {
          provider: analysis.barReference.provider,
          lineY: Math.round(analysis.barReference.lineY * 1000) / 1000,
          uncertainty: Math.round(analysis.barReference.uncertainty * 10000) / 10000,
        }
      : null,
    visibility: {
      meanCore: analysis.confidences.landmarkVisibility,
      minCore: minCore === null ? null : Math.round(minCore * 1000) / 1000,
      framing: analysis.confidences.framing,
    },
    confidences: analysis.confidences,
    anomalies: analysis.anomalies.map((a) => ({ code: a.code, severity: a.severity })),
    reps: analysis.reps.map((rep) => ({
      n: rep.repNumber,
      startMs: rep.startMs,
      endMs: rep.endMs,
      verdict: rep.verdict,
      reasons: rep.reasonCodes,
      chinClearance: rep.metrics.chinClearance,
      lockoutDeg: rep.metrics.lockoutAngleDeg,
      bottomDeg: rep.metrics.bottomAngleDeg,
      hipSwing: rep.metrics.hipSwingAmplitude,
      meanVis: rep.metrics.meanVisibility,
      seconds: rep.metrics.durationSeconds,
    })),
  };
}

function downloadJson(fileName: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PoseAnalysisPanel({ mode }: PoseAnalysisPanelProps) {
  const theme = useTheme();
  const { verification } = useRepositories();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<LandmarkStream | null>(null);
  const [analysis, setAnalysis] = useState<CalisthenicsAnalysis | null>(null);
  const [diagnostics, setDiagnostics] = useState<PullUpDiagnostics | null>(null);
  const [labels, setLabels] = useState<readonly RepLabel[]>([]);

  // Calibration workflow (local mode): scenario tagging + session log.
  const [scenario, setScenario] = useState<CalibrationScenario | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<CalibrationSummary[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const isEvidence = mode.kind === 'evidence';

  const loadLabels = useCallback(async () => {
    if (mode.kind !== 'evidence') {
      return;
    }
    const loaded = await verification.getRepLabels(mode.attemptId, mode.eventId);
    if (loaded.ok) {
      setLabels(loaded.value);
    }
  }, [mode, verification]);

  useEffect(() => {
    void loadLabels();
  }, [loadLabels]);

  const runOnUrl = useCallback(
    async (url: string, evidenceId: string | null, pickedFileName?: string) => {
      setBusy(true);
      setError(null);
      setStatus('Extracting landmarks…');
      setProgress(0);
      try {
        const extraction = await extractLandmarkStream(url, evidenceId, null, setProgress);
        setStream(extraction.stream);
        setStatus('Analyzing…');

        const sink: PullUpDiagnostics = { frames: [], observationGaps: [] };
        const result = analyzePullUps({ stream: extraction.stream }, sink);
        setAnalysis(result);
        setDiagnostics(sink);
        setVideoUrl(url);
        if (pickedFileName !== undefined) {
          setFileName(pickedFileName);
          // Auto-log every calibration run under the selected scenario.
          setSessionLog((current) => [
            ...current,
            buildSummary(result, sink, scenario, pickedFileName),
          ]);
        }

        if (mode.kind === 'evidence' && evidenceId) {
          setStatus('Storing artifact…');
          const path = `derived/${evidenceId}/landmarks-${EXTRACTOR_VERSION}-r${CALISTHENICS_RULESET_VERSION}.json`;
          const uploaded = await verification.uploadDerivedArtifact(
            path,
            JSON.stringify(extraction.stream),
          );
          if (uploaded.ok) {
            await verification.registerLandmarkArtifact(
              evidenceId,
              path,
              extraction.stream.extractorName,
              extraction.stream.extractorVersion,
              MODEL_FILE_SHA256,
              extraction.stream.frames.length,
              extraction.fps,
            );
          }
          setStatus('Recording shadow analysis…');
          const recorded = await verification.recordShadowAnalysis(
            mode.attemptId,
            mode.eventId,
            {
              engine: CALISTHENICS_ENGINE_NAME,
              modelName: extraction.stream.extractorName,
              modelVersion: `${extraction.stream.extractorVersion}+e${CALISTHENICS_ENGINE_VERSION}`,
              rulesetVersion: CALISTHENICS_RULESET_VERSION,
              claimedValue: null,
              detectedValue: result.detectedReps,
              acceptedValue: result.acceptedReps,
              verdict:
                result.recommendation === 'pass_candidate'
                  ? 'verified'
                  : result.recommendation === 'fail_candidate'
                    ? 'failed'
                    : 'unable_to_verify',
              confidences: result.confidences,
              reasonCodes: result.reasonCodes,
              metrics: {
                recommendation: result.recommendation,
                detectedReps: result.detectedReps,
                acceptedReps: result.acceptedReps,
                uncertainReps: result.uncertainReps,
                invalidReps: result.invalidReps,
                reps: result.reps,
                barReference: result.barReference,
                anomalies: result.anomalies,
                modelFileSha256: MODEL_FILE_SHA256,
              },
            },
          );
          if (!recorded.ok) {
            setError(`Shadow recording failed: ${recorded.error.message}`);
          }
        }
        setStatus(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Extraction failed.');
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [mode, scenario, verification],
  );

  const runOnEvidence = useCallback(async () => {
    if (mode.kind !== 'evidence' || !mode.evidence.storagePath) {
      return;
    }
    const url = await verification.getEvidenceUrl(mode.evidence.storagePath);
    if (!url.ok) {
      setError(url.error.message);
      return;
    }
    await runOnUrl(url.value, mode.evidence.id);
  }, [mode, runOnUrl, verification]);

  return (
    <Card style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="labelSm" color="accent">
          POSE ANALYSIS — SHADOW
        </Text>
        <Text variant="caption" color="textTertiary">
          {`Extractor ${EXTRACTOR_VERSION} · engine ${CALISTHENICS_ENGINE_VERSION} · ruleset r${CALISTHENICS_RULESET_VERSION} · model ${MODEL_FILE_SHA256.slice(0, 12)}…  Nothing here creates verified status.`}
        </Text>
      </View>

      {isEvidence ? (
        <Button
          label={analysis ? 'Re-run extraction & analysis' : 'Extract & analyze (shadow)'}
          loading={busy}
          onPress={() => void runOnEvidence()}
          testID="run-pose-analysis"
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="bodySm" color="textSecondary">
            Pick a local pull-up video (phone footage) to run the full extraction and
            analysis pipeline with diagnostics. Nothing is uploaded or recorded.
          </Text>

          {/* Calibration checklist: tag each video with the scenario it
              deliberately tests. Checked = at least one run logged. */}
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="labelSm" color="textTertiary">
              CALIBRATION SCENARIO (select before picking the video)
            </Text>
            <ChoiceRow
              groupLabel="Calibration scenario"
              options={CALIBRATION_SCENARIOS}
              selected={scenario}
              onSelect={(value) => setScenario(scenario === value ? null : value)}
              labelFor={(value) =>
                `${sessionLog.some((entry) => entry.scenario === value) ? '✓ ' : ''}${value}`
              }
            />
            <Text variant="caption" color="textTertiary">
              {`${new Set(sessionLog.map((entry) => entry.scenario).filter(Boolean)).size}/${CALIBRATION_SCENARIOS.length} scenarios logged this session · ${sessionLog.length} run(s) total`}
            </Text>
          </View>

          {unstable_createElement('input', {
            type: 'file',
            accept: 'video/*',
            disabled: busy,
            onChange: (event: { target: { files?: FileList; value: string } }) => {
              const file = event.target.files?.[0];
              if (file) {
                void runOnUrl(URL.createObjectURL(file), null, file.name);
              }
              // Allow re-picking the same file for repeat runs.
              event.target.value = '';
            },
          })}

          {sessionLog.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button
                label={`Copy all ${sessionLog.length} result(s)`}
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(JSON.stringify(sessionLog));
                  setCopied('session log');
                }}
              />
              <Button
                label="Download session log"
                variant="secondary"
                onPress={() =>
                  downloadJson(`pose-lab-session-${Date.now()}.json`, sessionLog)
                }
              />
            </View>
          ) : null}
        </View>
      )}

      {busy ? (
        <Text variant="bodySm" color="textSecondary">
          {`${status ?? 'Working…'} ${Math.round(progress * 100)}%`}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" color="statusOffTarget">
          {error}
        </Text>
      ) : null}

      {analysis && stream ? (
        <>
          <View style={{ gap: theme.spacing.xxs }}>
            <Text variant="headline">
              {`DETECTED ${analysis.detectedReps} · ACCEPTED ${analysis.acceptedReps} · UNCERTAIN ${analysis.uncertainReps} · INVALID ${analysis.invalidReps}`}
            </Text>
            <Text variant="bodySm" color="textSecondary">
              {`Recommendation: ${analysis.recommendation}${
                analysis.reasonCodes.length > 0 ? ` — ${analysis.reasonCodes.join(', ')}` : ''
              }`}
            </Text>
            {analysis.barReference ? (
              <Text variant="caption" color="textTertiary">
                {`Bar: ${analysis.barReference.provider} y=${analysis.barReference.lineY.toFixed(3)} ±${analysis.barReference.uncertainty.toFixed(3)} · visibility ${analysis.confidences.landmarkVisibility} · framing ${analysis.confidences.framing} · judgment ${analysis.confidences.repJudgment}`}
              </Text>
            ) : null}
          </View>

          {/* One clear calibration summary per video, exportable. */}
          <View
            style={{
              gap: theme.spacing.xxs,
              padding: theme.spacing.md,
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.backgroundSunken,
            }}
          >
            <Text variant="labelSm" color="textTertiary">
              {`CALIBRATION SUMMARY${scenario ? ` — ${scenario}` : ''}${fileName ? ` — ${fileName}` : ''}`}
            </Text>
            <Text variant="caption" color="textSecondary">
              {`verdict ${analysis.recommendation}${analysis.reasonCodes.length > 0 ? ` (${analysis.reasonCodes.join(', ')})` : ''} · bar ±${analysis.barReference ? analysis.barReference.uncertainty.toFixed(4) : '—'} · vis mean ${analysis.confidences.landmarkVisibility}${
                diagnostics && diagnostics.frames.length > 0
                  ? ` / min ${Math.min(...diagnostics.frames.map((f) => f.coreVisibility)).toFixed(3)}`
                  : ''
              } · ${(analysis.elapsedMs / 1000).toFixed(1)}s @ ${EXTRACTION_FPS}fps`}
            </Text>
            {analysis.reps.map((rep) => (
              <Text key={rep.repNumber} variant="caption" color="textTertiary">
                {`#${rep.repNumber} ${(rep.startMs / 1000).toFixed(1)}–${(rep.endMs / 1000).toFixed(1)}s ${rep.verdict}` +
                  ` · chin ${rep.metrics.chinClearance >= 0 ? '+' : ''}${rep.metrics.chinClearance}` +
                  ` · lock ${rep.metrics.lockoutAngleDeg}° · bottom ${rep.metrics.bottomAngleDeg}°` +
                  ` · swing ${rep.metrics.hipSwingAmplitude} · vis ${rep.metrics.meanVisibility}` +
                  (rep.reasonCodes.length > 0 ? ` · ${rep.reasonCodes.join(',')}` : '')}
              </Text>
            ))}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
                marginTop: theme.spacing.sm,
              }}
            >
              <Button
                label="Copy summary JSON"
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(
                    JSON.stringify(buildSummary(analysis, diagnostics, scenario, fileName)),
                  );
                  setCopied('summary');
                }}
              />
              <Button
                label="Download summary"
                variant="secondary"
                onPress={() =>
                  downloadJson(
                    `pose-summary-${scenario ?? 'untagged'}-${Date.now()}.json`,
                    buildSummary(analysis, diagnostics, scenario, fileName),
                  )
                }
              />
              <Button
                label="Download raw stream"
                variant="secondary"
                onPress={() =>
                  downloadJson(
                    `landmarks-${scenario ?? 'untagged'}-${Date.now()}.json`,
                    stream,
                  )
                }
              />
            </View>
            {copied ? (
              <Text variant="caption" color="statusOnTarget">
                {`Copied ${copied} to clipboard.`}
              </Text>
            ) : null}
          </View>

          {videoUrl ? (
            <SkeletonOverlay
              videoUrl={videoUrl}
              stream={stream}
              diagnostics={diagnostics}
              bar={analysis.barReference}
              reps={analysis.reps}
            />
          ) : null}

          {diagnostics ? (
            <SignalCharts
              diagnostics={diagnostics}
              bar={analysis.barReference}
              reps={analysis.reps}
              durationMs={analysis.elapsedMs}
            />
          ) : null}

          <Divider />
          <Text variant="labelSm" color="textTertiary">
            {isEvidence
              ? 'PER-REP: MACHINE vs GROUND TRUTH (label each rep; disagreements are recorded)'
              : 'PER-REP MACHINE RESULTS (local lab — labeling disabled)'}
          </Text>
          {analysis.reps.map((rep) => (
            <RepRow
              key={rep.repNumber}
              rep={rep}
              existing={labels.find((label) => label.repIndex === rep.repNumber) ?? null}
              enabled={isEvidence}
              onSave={async (label, reasons, notes) => {
                if (mode.kind !== 'evidence') {
                  return;
                }
                const saved = await verification.saveRepLabel(
                  mode.attemptId,
                  mode.eventId,
                  rep.repNumber,
                  rep.startMs,
                  rep.endMs,
                  label,
                  reasons,
                  notes,
                );
                if (saved.ok) {
                  await loadLabels();
                } else {
                  setError(saved.error.message);
                }
              }}
            />
          ))}

          {isEvidence ? (
            <>
              <Divider />
              <CorpusForm
                onSave={async (sample, notes) => {
                  if (mode.kind !== 'evidence') {
                    return;
                  }
                  const saved = await verification.saveCorpusSample(
                    mode.attemptId,
                    mode.eventId,
                    { ...sample, notes },
                  );
                  if (!saved.ok) {
                    setError(saved.error.message);
                  }
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function RepRow({
  rep,
  existing,
  enabled,
  onSave,
}: {
  rep: CalisthenicsAnalysis['reps'][number];
  existing: RepLabel | null;
  enabled: boolean;
  onSave: (
    label: (typeof LABELS)[number],
    reasons: string[],
    notes: string | null,
  ) => Promise<void>;
}) {
  const theme = useTheme();
  const [label, setLabel] = useState<(typeof LABELS)[number] | null>(existing?.label ?? null);
  const [reasons, setReasons] = useState<string[]>([...(existing?.reasonCodes ?? [])]);
  const disagrees = existing !== null && existing.label !== rep.verdict;

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radii.sm,
        borderWidth: theme.hairline.width,
        borderColor: disagrees ? theme.colors.statusCaution : theme.colors.border,
      }}
    >
      <Text variant="bodySm">
        {`Rep ${rep.repNumber} · ${(rep.startMs / 1000).toFixed(1)}–${(rep.endMs / 1000).toFixed(1)}s — machine: ${rep.verdict}`}
        {rep.reasonCodes.length > 0 ? ` (${rep.reasonCodes.join(', ')})` : ''}
      </Text>
      <Text variant="caption" color="textTertiary">
        {`clearance ${rep.metrics.chinClearance} · lockout ${rep.metrics.lockoutAngleDeg}° · bottom ${rep.metrics.bottomAngleDeg}° · swing ${rep.metrics.hipSwingAmplitude} · vis ${rep.metrics.meanVisibility}`}
      </Text>
      {existing ? (
        <Text
          variant="caption"
          color={disagrees ? 'statusCaution' : 'statusOnTarget'}
        >
          {`Ground truth: ${existing.label}${disagrees ? ' — DISAGREES with machine' : ' — agrees'}`}
        </Text>
      ) : null}
      {enabled ? (
        <>
          <ChoiceRow
            groupLabel={`Rep ${rep.repNumber} label`}
            options={LABELS}
            selected={label}
            onSelect={setLabel}
            labelFor={(value) => value}
          />
          <ChoiceRow
            groupLabel={`Rep ${rep.repNumber} reasons`}
            options={LABEL_REASONS}
            selected={null}
            onSelect={(value) =>
              setReasons((current) =>
                current.includes(value)
                  ? current.filter((item) => item !== value)
                  : [...current, value],
              )
            }
            labelFor={(value) => (reasons.includes(value) ? `✓ ${value}` : value)}
          />
          <Button
            label="Save ground truth"
            variant="secondary"
            disabled={label === null}
            onPress={() => {
              if (label !== null) {
                void onSave(label, reasons, null);
              }
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function CorpusForm({
  onSave,
}: {
  onSave: (
    sample: Record<CorpusKey, string | null>,
    notes: string | null,
  ) => Promise<void>;
}) {
  const theme = useTheme();
  const [values, setValues] = useState<Record<CorpusKey, string | null>>({
    deviceClass: null,
    cameraAngleClass: null,
    cameraDistanceClass: null,
    lightingClass: null,
    environmentClass: null,
    clothingContrastClass: null,
    bodyProportionClass: null,
    movementStyle: null,
  });
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="labelSm" color="textTertiary">
        DIVERSITY LEDGER (athlete/session-level — required for every labeled sample)
      </Text>
      {CORPUS_FIELDS.map((field) => (
        <View key={field.key} style={{ gap: theme.spacing.xxs }}>
          <Text variant="caption" color="textTertiary">
            {field.label}
          </Text>
          <ChoiceRow
            groupLabel={field.label}
            options={field.options}
            selected={values[field.key]}
            onSelect={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
            labelFor={(value) => value}
          />
        </View>
      ))}
      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything unusual" />
      <Button
        label={saved ? 'Ledger saved — update' : 'Save ledger entry'}
        variant="secondary"
        onPress={async () => {
          await onSave(values, notes.trim() === '' ? null : notes.trim());
          setSaved(true);
        }}
      />
    </View>
  );
}
