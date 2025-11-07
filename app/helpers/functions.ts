export const getMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}
