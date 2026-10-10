import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteContent } from "@/lib/content";
import { HOLDING_MODE } from "@/lib/holding";
import {
  OG_COLORS,
  OG_SIZE,
  firstSentence,
} from "@/lib/og/constants";

export const alt = siteContent.meta.title;
export const size = OG_SIZE;
export const contentType = "image/png";

// Literal sub-folders keep the build's file tracing scoped to these assets.
const readFont = (file: string) => readFile(join(process.cwd(), "app/fonts", file));
const readStill = (file: string) => readFile(join(process.cwd(), "public/coil", file));

// The share card (the dark hero still keeps the cards readable against the
// name), drawn once at build time: the hero's dark still (public/coil/og-still.jpg, cut by
// scripts/make-og-still.mjs; satori cannot read WebP), a scrim
// that carries the name (and hides the still's own lettering), the name in
// Profa Black and the first sentence of the meta description in Profa Bold.
// Holding mode ships the name alone on the page colour so the unfinished
// site's cards never leak into a share.
export default async function OpengraphImage() {
  const [black, bold, still] = await Promise.all([
    readFont("ProfaTrial-Black.ttf"),
    readFont("ProfaTrial-Bold.ttf"),
    HOLDING_MODE ? Promise.resolve(null) : readStill("og-still.jpg"),
  ]);
  const stillSrc = still ? `data:image/jpeg;base64,${still.toString("base64")}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: OG_COLORS.background,
        }}
      >
        {stillSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stillSrc}
            alt=""
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: stillSrc
              ? `linear-gradient(90deg, ${OG_COLORS.background} 0%, ${OG_COLORS.background} 50%, ${OG_COLORS.backgroundClear} 66%)`
              : OG_COLORS.background,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 0,
            bottom: 0,
            width: 520,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Profa Black",
              fontSize: 108,
              lineHeight: 0.96,
              color: OG_COLORS.foreground,
              letterSpacing: -3,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {siteContent.meta.title.split(" ").map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
          {stillSrc && (
            <div
              style={{
                fontFamily: "Profa Bold",
                fontSize: 30,
                lineHeight: 1.3,
                marginTop: 30,
                maxWidth: 420,
                color: OG_COLORS.accent,
                display: "flex",
              }}
            >
              {firstSentence(siteContent.meta.description)}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Profa Black", data: black, weight: 900, style: "normal" },
        { name: "Profa Bold", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
