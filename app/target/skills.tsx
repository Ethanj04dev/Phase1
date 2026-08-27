import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AsyncBoundary } from '@/components/feedback/AsyncBoundary';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ChoiceRow } from '@/components/primitives/ChoiceRow';
import { Divider } from '@/components/primitives/Divider';
import { Text } from '@/components/primitives/Text';
import { useRepositories } from '@/data/repositoryContext';
import {
  preparationDomain,
  PROFICIENCY_LEVEL_LABELS,
  PROFICIENCY_LEVELS,
  type ProficiencyLevel,
} from '@/domain/target/domains';
import {
  ratedCount,
  skillStandings,
  type NewProficiencyRating,
  type SkillStanding,
} from '@/domain/target/proficiency';
import type { TargetDomain } from '@/domain/target/types';
import { useTarget } from '@/features/target/useTarget';
import { formatDateStamp } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * Self-assessment for skill-measured domains.
 *
 * Water confidence is the reason this exists. Comfort in the water is
 * trainable and it is usually what separates performing from panicking, but it
 * is not a stopwatch number, and forcing it into seconds would invent a
 * precision nobody has.
 *
 * The safety rules here are not decoration. Underwater work is the one thing
 * in this product that can kill someone practising it wrongly, so the notice
 * sits above the control that records it rather than in a settings screen
 * nobody opens.
 */

function SkillRow({
  standing,
  draft,
  onSelect,
}: {
  standing: SkillStanding;
  draft: ProficiencyLevel | null;
  onSelect: (level: ProficiencyLevel) => void;
}) {
  const theme = useTheme();
  const { skill } = standing;
  const selected = draft ?? standing.level;

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <Text variant="headline" style={{ flex: 1 }}>
            {skill.label}
          </Text>
          {/* Supervision is stated in words as well as position, so it does
              not depend on someone noticing where it sits. */}
          {skill.requiresSupervision ? (
            <Text variant="bodySm" color="statusCaution">
              Supervision required
            </Text>
          ) : null}
        </View>
        <Text variant="bodySm" color="textSecondary">
          {skill.description}
        </Text>
      </View>

      {/* Above the control, not below it. */}
      {skill.safetyNotice ? (
        <Text
          variant="bodySm"
          color={skill.requiresSupervision ? 'statusOffTarget' : 'textSecondary'}
        >
          {skill.safetyNotice}
        </Text>
      ) : null}

      <ChoiceRow
        options={PROFICIENCY_LEVELS}
        selected={selected}
        onSelect={onSelect}
        labelFor={(level) => PROFICIENCY_LEVEL_LABELS[level]}
        groupLabel={`${skill.label} level`}
      />

      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="caption" color="textTertiary">
          {`Suggested by Phase 1: ${PROFICIENCY_LEVEL_LABELS[skill.phase1Target]}`}
        </Text>
        <Text variant="caption" color="textTertiary">
          {standing.lastRatedAt === null
            ? 'Not rated yet'
            : `Last rated ${formatDateStamp(new Date(standing.lastRatedAt))}`}
        </Text>
      </View>
    </View>
  );
}

function DomainSection({
  domain,
  standings,
  drafts,
  onSelect,
}: {
  domain: TargetDomain;
  standings: readonly SkillStanding[];
  drafts: Readonly<Record<string, ProficiencyLevel>>;
  onSelect: (skillId: string, level: ProficiencyLevel) => void;
}) {
  const theme = useTheme();
  const info = preparationDomain(domain.id);
  const counts = ratedCount(standings);

  return (
    <View>
      <View style={{ marginBottom: theme.spacing.md, gap: theme.spacing.xxs }}>
        <Text variant="title" accessibilityRole="header">
          {info.label}
        </Text>
        <Text variant="bodySm" color="textSecondary">
          {domain.rationale}
        </Text>
        <Text variant="caption" color="textTertiary">
          {`${counts.rated} of ${counts.total} rated · ${Math.round(domain.weight * 100)}% of your readiness score`}
        </Text>
      </View>

      <Card padded={false}>
        {standings.map((standing, index) => (
          <View key={standing.skill.id}>
            {index > 0 ? <Divider /> : null}
            <SkillRow
              standing={standing}
              draft={drafts[standing.skill.id] ?? null}
              onSelect={(level) => onSelect(standing.skill.id, level)}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function SkillsScreen() {
  const theme = useTheme();
  const { proficiency } = useRepositories();
  const { state, reload } = useTarget();

  const [drafts, setDrafts] = useState<Record<string, ProficiencyLevel>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const select = useCallback((skillId: string, level: ProficiencyLevel) => {
    setDrafts((current) => ({ ...current, [skillId]: level }));
    setSaveError(null);
  }, []);

  const pending = useMemo(() => Object.keys(drafts).length, [drafts]);

  return (
    <Screen
      scroll
      testID="target-skills"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <AsyncBoundary state={state} onRetry={reload}>
        {({ target, profile, ratings }) => {
          const domains = (target?.domains ?? []).filter(
            (domain) => (domain.proficiencySkills?.length ?? 0) > 0,
          );

          if (domains.length === 0) {
            return (
              <Text variant="body" color="textSecondary">
                Your target has no skill-rated areas.
              </Text>
            );
          }

          const save = async () => {
            const entries: NewProficiencyRating[] = [];
            for (const domain of domains) {
              for (const skill of domain.proficiencySkills ?? []) {
                const level = drafts[skill.id];
                if (level) {
                  entries.push({ domainId: domain.id, skillId: skill.id, level });
                }
              }
            }
            if (entries.length === 0) {
              return;
            }

            setSaving(true);
            setSaveError(null);
            const outcome = await proficiency.recordRatings(profile.id, entries);
            setSaving(false);

            if (!outcome.ok) {
              // The repository already produced a human-readable message;
              // nothing raw from the backend reaches this string.
              setSaveError(outcome.error.message);
              return;
            }
            setDrafts({});
            reload();
            goBack('/target');
          };

          return (
            <>
              {/* The safety statement leads. Everything below it is a control
                  that could send someone into the water. */}
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="headline" color="statusCaution">
                  Before you train any of this
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  Never train in water alone, including easy surface swimming. Anything below
                  the surface needs qualified in-water supervision.
                </Text>
                <Text variant="bodySm" color="textSecondary">
                  Phase 1 does not measure, rank or reward breath-hold performance, and never
                  will. There is no record to beat here. Water confidence means being calm and
                  capable, not proving how long you can stay under.
                </Text>
              </Card>

              <Text variant="body" color="textSecondary">
                Rate yourself honestly. Nobody is checking, and a generous rating only costs
                you the accuracy of your own readiness score.
              </Text>

              {domains.map((domain) => (
                <DomainSection
                  key={domain.id}
                  domain={domain}
                  standings={skillStandings(domain, ratings)}
                  drafts={drafts}
                  onSelect={select}
                />
              ))}

              {saveError ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text variant="headline" color="statusOffTarget">
                    Not saved
                  </Text>
                  <Text variant="bodySm" color="textSecondary">
                    {saveError}
                  </Text>
                </Card>
              ) : null}

              <Button
                label={pending === 0 ? 'Nothing changed' : `Save ${pending} rating${pending === 1 ? '' : 's'}`}
                onPress={save}
                disabled={pending === 0 || saving}
                loading={saving}
                fullWidth
                testID="save-ratings"
              />

              <Text variant="caption" color="textTertiary">
                Ratings are kept as history rather than overwritten, so you can see a skill
                improve over months. Re-rate whenever it changes.
              </Text>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}
