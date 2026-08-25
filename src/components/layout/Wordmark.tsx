import { Text } from '@/components/primitives/Text';
import { branding } from '@/config/branding';
import type { TypographyVariant } from '@/theme';

export interface WordmarkProps {
  variant?: TypographyVariant;
}

/**
 * The product wordmark. The numeral carries the accent colour, which is the
 * only place the brand asserts itself in the chrome.
 */
export function Wordmark({ variant = 'label' }: WordmarkProps) {
  return (
    <Text variant={variant} accessibilityLabel={branding.productName}>
      {`${branding.wordmark.lead} `}
      <Text variant={variant} color="accent">
        {branding.wordmark.numeral}
      </Text>
    </Text>
  );
}
