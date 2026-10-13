import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";

const links = [
  siteContent.connect.links.find((link) => link.key === "linkedin")!,
  siteContent.connect.links.find((link) => link.key === "email")!,
  siteContent.connect.links.find((link) => link.key === "github")!,
];

export function QuickHeader({ backHref = "/" }: { backHref?: string }) {
  return (
    <header className="mb-16 max-w-3xl">
      <p className="font-label text-label text-accent">{quickCopy.kicker}</p>
      <h1 className="mt-3 font-display text-display text-foreground">{quickCopy.title}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">{quickCopy.lede}</p>
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-label text-label">
        {links.map((link) => (
          <li key={link.key}>
            <a href={link.href} className="text-accent" {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <a href={backHref} className="mt-6 inline-block font-label text-label text-muted">
        {quickCopy.back}
      </a>
    </header>
  );
}
