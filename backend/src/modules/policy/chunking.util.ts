export function chunkPolicyDocument(
  content: string,
  chunkSize = 700,
  overlap = 150,
): string[] {
  const clean = content.replace(/\s+/g, ' ').trim();
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    let end = Math.min(cursor + chunkSize, clean.length);
    if (end < clean.length) {
      const window = clean.slice(cursor, end);
      const lastBreak =
        window.lastIndexOf('. ') !== -1 ? window.lastIndexOf('. ') + 1 : window.lastIndexOf(' ');
      if (lastBreak > chunkSize * 0.5) end = cursor + lastBreak;
    }
    chunks.push(clean.slice(cursor, end).trim());
    cursor += end - cursor > overlap ? end - cursor - overlap : end - cursor;
    if (end >= clean.length) break;
  }
  return chunks.filter((c) => c.length > 0);
}

export function contentKeyFor(schemeName: string, index: number): string {
  const slug = schemeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${slug}#chunk-${index}`;
}
