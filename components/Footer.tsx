import { FooterStage } from "@/components/footer/FooterStage";
import { lastUpdatedMonth } from "@/lib/buildDate";
import { siteContent } from "@/lib/content";

// The footer (slice C6): the giant "build.stuff" wordmark with the hero's
// field ending in it, and over it the two small lines, in the row where the
// footer lab's Connect row sat (Connect itself is the section above). The
// row keeps that row's height (its padding and its content's 168px, 100px
// from md), so the field rises and fades where Aaron saw it. Stays a Server
// Component: the lines and the word's text alternative render here, and
// FooterStage is the client part (the field, the letters, the egg).
export function Footer() {
  const { wordmark, dropPeriod, tagline, copyright } = siteContent.footer;
  return (
    <FooterStage text={wordmark} eggLabel={dropPeriod}>
      <div data-footer-lines data-wave-words className="relative z-10 flex min-h-[224px] flex-col justify-end gap-1 px-6 pt-14 md:min-h-[180px] md:items-end md:px-10 md:pt-20">
        <p className="font-label text-label-sm text-foreground">{tagline(lastUpdatedMonth())}</p>
        <p className="font-label text-label-sm text-foreground">{copyright}</p>
      </div>
      <p className="sr-only">{wordmark}</p>
    </FooterStage>
  );
}
