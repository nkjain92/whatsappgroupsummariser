/**
 * Simple GPT token counter approximation
 * This is not as accurate as tiktoken but works without WebAssembly
 */
export function estimateTokenCount(text: string): number {
  // Split on whitespace and punctuation
  const words = text.trim().split(/[\s\n.,!?;:'"()\[\]{}|\\/<>+=\-_~`@#$%^&*]+/);

  // Filter out empty strings
  const nonEmptyWords = words.filter(word => word.length > 0);

  // Count special characters (non-ASCII)
  const specialChars = text.match(/[^\x00-\x7F]/g) || [];

  // Approximate token count:
  // - Each word is roughly 1-1.5 tokens
  // - Each special character is roughly 1 token
  // - Add 10% overhead for safety
  const approximateTokens = Math.ceil((nonEmptyWords.length * 1.5 + specialChars.length) * 1.1);

  return approximateTokens;
}
