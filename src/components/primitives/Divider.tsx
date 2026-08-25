import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export interface DividerProps extends ViewProps {
  /** `strong` is for structural breaks; the default is a quiet hairline. */
  tone?: 'default' | 'strong';
  inset?: number;
}

export function Divider({ tone = 'default', inset = 0, style, ...rest }: DividerProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="none"
      style={[
        {
          height: theme.hairline.width,
          marginHorizontal: inset,
          backgroundColor: tone === 'strong' ? theme.colors.borderStrong : theme.colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}
