import { View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import type { Source, Verified } from '@/domain/target/provenance';
import { VERIFICATION_REQUIRED } from '@/domain/target/provenance';
import { useTheme } from '@/theme';

export interface ProvenanceMarkProps {
  /** The claim whose provenance is being marked. */
  value: Verified<unknown>;
  /** Sources the target defines, to resolve the citation by id. */
  sources: readonly Source[];
}

/**
 * The calibration sticker.
 *
 * One glyph pair, used everywhere the product shows something as official: a
 * solid mark with the source named, or a hollow one with "Verification
 * required". The same two shapes on every screen make provenance something an
 * athlete reads at a glance, the way a stamped instrument reads as calibrated
 * before its numbers are trusted.
 *
 * The wording never varies and the glyph never appears without words. A dot
 * whose meaning lives only in its fill would be status by colour alone, which
 * the design rules ban.
 */
export function ProvenanceMark({ value, sources }: ProvenanceMarkProps) {
  const theme = useTheme();
  const verified = value.status === 'verified';
  const source = verified
    ? sources.find((candidate) => candidate.id === value.sourceId)
    : undefined;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: verified ? theme.colors.accent : theme.colors.statusCaution,
          backgroundColor: verified ? theme.colors.accent : theme.colors.transparent,
        }}
      />
      <Text
        variant="caption"
        color={verified ? 'textSecondary' : 'statusCaution'}
        style={{ flexShrink: 1 }}
        numberOfLines={2}
      >
        {verified
          ? // A verified figure with a dangling source id is a content bug the
            // tests catch; the fallback wording is for the render in between.
            (source ? `${source.title} — ${source.organization}` : 'Verified')
          : VERIFICATION_REQUIRED}
      </Text>
    </View>
  );
}
