// The pure half of scripts/export-photos.mjs: reads the photo export manifest
// (docs/content/photo-export-manifest.json, untracked because it holds local
// paths) into a list of jobs, and sizes each output. No file access here.
import { basename, join } from "node:path";
import { z } from "zod";

export const CARD_SIZE = { width: 1200, height: 1600 };
export const CARD_MIN_WIDTH = 768;
export const MODAL_LONG_EDGE = 1600;
export const POP_LONG_EDGE = 800;
export const BYTE_BUDGET = 300_000;
export const QUALITIES = [85, 82, 80, 78, 75];
// A crop box's own aspect may miss 3:4 by a rounding pixel; the export trims the rest.
const CARD_ASPECT_SLACK = 0.01;

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const box = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().positive(), z.number().int().positive()])
  .refine(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0, "a crop box is x0,y0,x1,y1 with x1 > x0 and y1 > y0");

const cardPicture = z.object({ card: kebab, id: kebab, source: z.string().min(1), crop: box.nullable(), flipHorizontal: z.boolean() });
const modalPhoto = z.object({ card: kebab, id: kebab, source: z.string().min(1), crop: box.nullable(), transform: z.literal("flipHorizontal").nullable(), spare: z.boolean() });
const popover = z.object({ key: kebab, source: z.string().min(1), crop: box.nullable() });
const logo = z.object({ card: kebab, files: z.array(z.string().min(1)).min(1) });

export const manifestSchema = z.object({
  root: z.string().min(1),
  cardPictures: z.array(cardPicture),
  modalPhotos: z.array(modalPhoto),
  popovers: z.array(popover),
  logos: z.array(logo),
});

// Mirrored selfies whose text reads backwards in the approved previews (EXIF orientation 5, like
// Building in public): the poster and the jacket logo. Flipped here so the manifest stays as Aaron
// approved it; his veto removes an id. Prefer `transform: "flipHorizontal"` in a future manifest.
export const FLIP_OVERRIDES = new Set(["capital-one-3-2026", "hackathons-2-vercel"]);

// Folders the manifest lists for later slices (the Talos animation) and files
// already in the repo (app/icon.svg) are not exported.
function isExportedLogo(file) {
  return !file.endsWith("/") && !file.startsWith("app/");
}

export function exportJobs(input) {
  const manifest = manifestSchema.parse(input);
  const jobs = [
    ...manifest.cardPictures.map((entry) => ({ kind: "card", id: entry.id, source: entry.source, crop: entry.crop, flip: entry.flipHorizontal, out: `photos/cards/${entry.id}.jpg` })),
    ...manifest.modalPhotos.filter((entry) => !entry.spare).map((entry) => ({ kind: "modal", id: entry.id, source: entry.source, crop: entry.crop, flip: entry.transform === "flipHorizontal" || FLIP_OVERRIDES.has(entry.id), out: `photos/cards/${entry.id}.jpg` })),
    ...manifest.popovers.map((entry) => ({ kind: "pop", id: entry.key, source: entry.source, crop: entry.crop, flip: false, out: `photos/pops/${entry.key}.jpg` })),
    ...manifest.logos.flatMap((entry) =>
      entry.files.filter(isExportedLogo).map((file) => ({ kind: "logo", id: `${entry.card}/${basename(file)}`, source: join(manifest.root, file), crop: null, flip: false, out: `work/logos/${entry.card}/${basename(file)}` })),
    ),
  ];
  const seen = new Set();
  for (const job of jobs) {
    if (seen.has(job.out)) throw new Error(`two manifest entries write ${job.out}`);
    seen.add(job.out);
  }
  return jobs;
}

// The box to cut from the auto-oriented source, as sharp's extract() takes it.
export function cropRegion(crop, source) {
  if (!crop) return { left: 0, top: 0, width: source.width, height: source.height };
  const [x0, y0, x1, y1] = crop;
  if (x1 > source.width || y1 > source.height) {
    throw new Error(`crop ${crop.join(",")} falls outside the ${source.width} by ${source.height} source`);
  }
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

// The written file's pixels. Never upscales.
export function outputSize(kind, region) {
  const { width, height } = region;
  if (kind === "card") {
    if (Math.abs(width / height - 3 / 4) > CARD_ASPECT_SLACK) throw new Error(`a card picture's crop must be 3:4, got ${width} by ${height}`);
    const outWidth = Math.min(CARD_SIZE.width, width, Math.floor((height * 3) / 4));
    if (outWidth < CARD_MIN_WIDTH) throw new Error(`a card picture must be at least ${CARD_MIN_WIDTH} px wide, got ${outWidth}`);
    return { width: outWidth, height: Math.round((outWidth * 4) / 3) };
  }
  const longEdge = kind === "pop" ? POP_LONG_EDGE : MODAL_LONG_EDGE;
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
