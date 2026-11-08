import type { Item } from "./contracts";
import { photoUrl } from "./upload";

const hues = [
  "#c2703d",
  "#3d7cc2",
  "#4f9a55",
  "#a0529c",
  "#b8902f",
  "#2f9e98",
  "#c24d5e",
  "#6b6bc2",
];

function hueOf(key: string) {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hues[hash % hues.length];
}

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

function initialOf(name: string) {
  for (const { segment } of graphemes.segment(name)) return segment;
  return "";
}

function Thumbnail({ item }: { item: Item }) {
  const [cover] = item.photos;
  if (cover !== undefined)
    return <img src={photoUrl(cover.id, "thumb")} alt="" loading="lazy" decoding="async" />;
  return (
    <span
      className="thing-letter"
      style={{ backgroundColor: hueOf(item.category || item.name) }}
      aria-hidden="true"
    >
      {initialOf(item.name)}
    </span>
  );
}

export function ItemCard({ item, onSelect }: { item: Item; onSelect: () => void }) {
  const place = item.location || item.category || "場所は未設定";
  return (
    <button type="button" className="thing-card" onClick={onSelect}>
      <span className="thing-thumb">
        <Thumbnail item={item} />
        {item.quantity > 1 && <span className="thing-badge">×{item.quantity}</span>}
      </span>
      <span className="thing-name">{item.name}</span>
      <span className="thing-place">{place}</span>
    </button>
  );
}
