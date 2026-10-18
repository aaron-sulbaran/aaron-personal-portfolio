import Image from "next/image";
import { siteContent } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// A screenshot of my Talos HQ channel in Discord (the brand sheet's mock at 2x),
// in the light file on the light theme and the dark file on the dark one, as the
// modal's photos are drawn: rounded corners, quality 90, no shadow. The mock is
// about 530px wide; the image only scales, so on a phone it reads as a picture
// of a channel rather than a column of text.
export function TalosDiscord() {
  const { discord } = siteContent.cards.talos.team;
  const sizes = "(min-width: 1024px) 460px, calc(100vw - 4rem)";
  return (
    <figure data-mask={partId.discord} data-mask-kind="photo" data-talos-discord="" className="m-0 overflow-hidden rounded-xl">
      <div data-mask-media="">
        <Image src={discord.light} alt={discord.alt} width={discord.width} height={discord.height} quality={90} sizes={sizes} draggable={false} className="block h-auto w-full dark:hidden" />
        <Image src={discord.dark} alt={discord.alt} width={discord.width} height={discord.height} quality={90} sizes={sizes} draggable={false} className="hidden h-auto w-full dark:block" />
      </div>
    </figure>
  );
}
