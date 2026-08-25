import { Pressable, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface ChoiceRowProps<T extends string | number> {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  labelFor: (value: T) => string;
  /** Names the group for assistive technology, e.g. "Swimming". */
  groupLabel: string;
}

/**
 * A compact single-select row. Used wherever a short closed set of options has
 * to fit without a full-width card each -- experience levels, training days,
 * effort ratings.
 */
export function ChoiceRow<T extends string | number>({
  options,
  selected,
  onSelect,
  labelFor,
  groupLabel,
}: ChoiceRowProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
    >
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${groupLabel}: ${labelFor(option)}`}
            onPress={() => onSelect(option)}
            style={({ pressed }) => ({
              flexGrow: 1,
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radii.md,
              borderWidth: theme.hairline.width,
              borderColor: isSelected ? theme.colors.accent : theme.colors.border,
              backgroundColor: isSelected
                ? theme.colors.accentSurface
                : pressed
                  ? theme.colors.surfacePressed
                  : theme.colors.surface,
            })}
          >
            <Text
              variant="labelSm"
              color={isSelected ? 'accent' : 'textSecondary'}
              numberOfLines={1}
            >
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
