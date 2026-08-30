import { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextStyle } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Quiet hint under the field, e.g. the expected format. */
  helper?: string;
  /** Replaces the helper and turns the field red when present. */
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Trailing unit, e.g. "REPS". */
  suffix?: string;
  /** Masks input and disables autocorrect. For passwords. */
  secureTextEntry?: boolean;
  editable?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next';
  /** For identifier-like fields (handles) where autocasing corrupts input. */
  autoCapitalize?: 'none' | 'sentences';
  autoCorrect?: boolean;
  maxLength?: number;
  /** Grows to a taller, top-aligned field. For bios and notes. */
  multiline?: boolean;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  keyboardType = 'default',
  suffix,
  secureTextEntry = false,
  editable = true,
  onSubmitEditing,
  returnKeyType = 'done',
  autoCapitalize,
  autoCorrect,
  maxLength,
  multiline = false,
  testID,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.statusOffTarget
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  const inputStyle: TextStyle = {
    ...theme.typography.metricMd,
    color: editable ? theme.colors.textPrimary : theme.colors.textDisabled,
    flex: 1,
    // Height rather than padding so the touch target is predictable and the
    // baseline does not shift when the suffix is present.
    ...(multiline
      ? { minHeight: 88, paddingVertical: theme.spacing.md, textAlignVertical: 'top' as const }
      : { height: 52, padding: 0 }),
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="labelSm" color="textTertiary">
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: theme.hairline.width,
          borderColor,
          backgroundColor: editable ? theme.colors.surface : theme.colors.backgroundSunken,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          editable={editable}
          keyboardType={keyboardType}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDisabled}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={
            autoCapitalize ??
            (secureTextEntry || keyboardType === 'email-address' ? 'none' : 'sentences')
          }
          autoCorrect={autoCorrect ?? !secureTextEntry}
          maxLength={maxLength}
          multiline={multiline}
          selectionColor={theme.colors.accent}
          style={inputStyle}
          testID={testID}
          value={value}
        />
        {suffix ? (
          <Text variant="labelSm" color="textTertiary">
            {suffix}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color="statusOffTarget">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
