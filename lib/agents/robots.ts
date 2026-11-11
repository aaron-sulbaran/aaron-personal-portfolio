import { siteContent } from "@/lib/content";
import { agentsCopy } from "@/lib/content/agents";

// robots.txt is public, so it names no path but the root: one group, everything
// allowed, and the content signal that says search, AI input and AI training are welcome.
export function buildRobotsTxt(): string {
  return [
    ...agentsCopy.robotsComment.map((line) => `# ${line}`),
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    "",
    `Sitemap: ${siteContent.meta.url}/sitemap.xml`,
    "",
  ].join("\n");
}
