import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteContent } from "@/lib/content";
import { HOLDING_MODE } from "@/lib/holding";
import { OG_COLORS, OG_SIZE } from "@/lib/og/constants";

export const alt = siteContent.meta.title;
export const size = OG_SIZE;
export const contentType = "image/png";

// Literal sub-folders keep the build's file tracing scoped to these assets.
const readFont = (file: string) => readFile(join(process.cwd(), "app/fonts", file));
const readCard = (file: string) => readFile(join(process.cwd(), "public/coil", file));

// The share card, built once at build time. The full site serves the card as
// designed, byte for byte: public/coil/og-share.png, Aaron's first sentence
// beside the Coil's cards on white (the cards lifted off a page 2 still taken
// with and without them, so the field and the page's words drop out). Holding
// mode ships the name alone on the page colour so the unfinished site's cards
// never leak into a share.
export default async function OpengraphImage() {
  if (!HOLDING_MODE) {
    const card = new Uint8Array(await readCard("og-share.png"));
    return new Response(card, { headers: { "Content-Type": contentType } });
  }

  const black = await readFont("ProfaTrial-Black.ttf");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          paddingLeft: 72,
          background: OG_COLORS.background,
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
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Profa Black", data: black, weight: 900, style: "normal" }],
    },
  );
}
