import { siteContent } from "@/lib/content";
import { agentsCopy } from "@/lib/content/agents";

const BASE = siteContent.meta.url;
const PERSON_ID = `${BASE}/#person`;
const SITE_ID = `${BASE}/#website`;

// The profiles Connect shows, without the calendar and the email: the email
// never goes in structured data.
const PROFILE_KEYS = new Set(["linkedin", "github", "x", "instagram"]);

export function buildPersonJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: BASE,
        name: siteContent.meta.title,
        description: siteContent.meta.description,
        inLanguage: "en",
        author: { "@id": PERSON_ID },
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: siteContent.meta.title,
        url: BASE,
        // The share card: the site's one fixed image (app/opengraph-image.tsx).
        image: `${BASE}/opengraph-image`,
        description: siteContent.meta.description,
        jobTitle: agentsCopy.jobTitle,
        alumniOf: { "@type": "CollegeOrUniversity", name: agentsCopy.alumniOf },
        affiliation: { "@type": "CollegeOrUniversity", name: agentsCopy.alumniOf },
        sameAs: siteContent.connect.links.filter((entry) => PROFILE_KEYS.has(entry.key)).map((entry) => entry.href),
        mainEntityOfPage: { "@id": SITE_ID },
      },
    ],
  };
}

// Next's documented pattern: stringify, and escape "<" so the data can never close the script.
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
