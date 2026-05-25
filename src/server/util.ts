// Server-side utility helpers.

export function uuid(): string {
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}
