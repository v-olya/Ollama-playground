export const getMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function confirmBeforeChange(restartChats?: () => void) {
  const confirmed = window.confirm(
    "Attention: this change will clear the current chat.\n Are you sure you want to restart?"
  );
  if (!confirmed) return false;
  if (restartChats) restartChats();
  return true;
}
