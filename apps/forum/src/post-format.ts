type BodyPart =
  | { kind: "text"; start: number; text: string }
  | { kind: "anchor"; start: number; text: string; number: number };

export function splitAnchors(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(/[>＞]{2}(\d{1,4})/gu)) {
    if (match.index > cursor)
      parts.push({ kind: "text", start: cursor, text: body.slice(cursor, match.index) });
    parts.push({
      kind: "anchor",
      start: match.index,
      text: match[0],
      number: Number(match[1]),
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) parts.push({ kind: "text", start: cursor, text: body.slice(cursor) });
  return parts;
}
