export type FieldAssignmentPayload = {
  fileName?: string;
  fileUrl?: string;
  youtubeUrl?: string;
};

export function parseFieldAssignmentResponse(raw: string | undefined | null): FieldAssignmentPayload | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t) as unknown;
    if (o && typeof o === 'object') return o as FieldAssignmentPayload;
  } catch {
    /* not JSON */
  }
  return null;
}

export function serializeFieldAssignmentPayload(p: FieldAssignmentPayload): string {
  return JSON.stringify({
    ...(p.fileName != null && p.fileName !== '' ? { fileName: p.fileName } : {}),
    ...(p.fileUrl != null && p.fileUrl !== '' ? { fileUrl: p.fileUrl } : {}),
    ...(p.youtubeUrl != null && p.youtubeUrl.trim() !== '' ? { youtubeUrl: p.youtubeUrl.trim() } : {}),
  });
}

export function isYoutubeLikeUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    const h = u.hostname.toLowerCase();
    return h === 'youtu.be' || h.endsWith('.youtube.com') || h === 'youtube.com';
  } catch {
    return false;
  }
}
