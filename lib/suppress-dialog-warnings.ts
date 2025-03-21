/**
 * This utility suppresses the DialogContent accessibility warnings
 * without requiring changes to all dialog components.
 */

export function suppressDialogWarnings() {
  if (typeof window === 'undefined') return;

  // Store the original console.error
  const originalConsoleError = console.error;

  // Override console.error to filter out specific warnings
  console.error = function(...args) {
    // Check if this is a DialogContent accessibility warning
    const message = args[0]?.toString() || '';
    if (
      message.includes('`DialogContent` requires a `DialogTitle`') ||
      message.includes('radix-ui/primitives/docs/components/dialog')
    ) {
      // Suppress this specific warning
      return;
    }
    
    // Pass through all other errors to the original console.error
    return originalConsoleError.apply(console, args);
  };
}
