import { buildPersonJsonLd, jsonLdString } from "@/lib/agents/jsonld";

// The site's Person and WebSite as structured data, for crawlers and agents.
export function JsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(buildPersonJsonLd()) }} />;
}
