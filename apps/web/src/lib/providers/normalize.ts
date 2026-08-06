export function normalizeProviderName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
  return cleaned.replace(/\s+/g, " ");
}
