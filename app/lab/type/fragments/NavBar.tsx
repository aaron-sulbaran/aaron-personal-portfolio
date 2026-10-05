import { Moon } from "lucide-react";
import { AsMark } from "@/components/menu/BrandMark";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/SiteNav.tsx and components/menu: the bar past the hero (mark,
// Work active, About, Connect) with the Menu pill and its Listen note, then
// the open panel's foot row (chips, email, socials). Static, no menu store.
const NAV_ITEMS = siteContent.menu.items.filter((item) => item.key !== "home");
const ACTIVE = "#work";
const CHIP =
  "inline-flex h-[34px] items-center gap-2 rounded-[17px] pl-2.5 pr-3.5 text-[13px] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-muted)]";

export function NavBar() {
  const m = siteContent.menu;
  const s = siteContent.soundtrack;
  const menuTag = role("nav", 14, true);
  const chipTag = role("nav", 13, true);
  const chip = { "data-role": chipTag["data-role"], "data-strong": "", style: { ...chipTag.style, gap: "var(--lab-icon-gap, 8px)" } };
  return (
    <div className="flex flex-col gap-12">
      <div className="relative h-[72px] w-full overflow-hidden rounded-sm">
        <div aria-hidden="true" className="absolute inset-0 border-b border-border bg-[var(--nav-bar)]" />
        <span className="absolute left-6 top-5 block h-8 w-8 text-foreground">
          <AsMark className="block h-full w-full" />
        </span>
        <nav aria-label="Specimen sections" className="absolute left-1/2 top-0 flex h-[72px] -translate-x-1/2 items-center gap-8 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const active = item.href === ACTIVE;
            return (
              <a
                key={item.key}
                href="#nav"
                className={`relative transition-colors duration-200 hover:text-foreground ${
                  active
                    ? "text-foreground after:absolute after:-bottom-2 after:left-1/2 after:-ml-0.5 after:h-1 after:w-1 after:rounded-full after:bg-accent after:content-['']"
                    : "text-muted"
                }`}
                {...role("nav", 14, true)}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="absolute right-5 top-4 min-h-10 rounded-[20px] bg-[var(--menu-pill)] text-foreground backdrop-blur-[8px] [box-shadow:inset_0_0_0_1px_var(--color-border)]">
          <div className="relative flex h-10 items-center justify-end">
            <span className="flex h-10 w-[34px] items-center justify-center">
              <NoteIcon on={false} className="lab-icon block h-[15px] w-[9.5px] text-muted" />
            </span>
            <span
              className="flex h-10 items-center rounded-full pl-1.5 pr-[17px] text-sm font-medium tracking-[0.005em]"
              data-role={menuTag["data-role"]}
              data-strong=""
              style={{ ...menuTag.style, paddingLeft: "var(--lab-icon-gap, 6px)" }}
            >
              {m.pillLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[440px] rounded-sm bg-[var(--menu-panel)] px-8 py-7 [box-shadow:inset_0_0_0_1px_var(--color-border)]">
        <div className="flex shrink-0 flex-col gap-[18px] border-t border-border pt-5">
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className={CHIP} {...chip}>
              <Moon aria-hidden="true" className="lab-icon h-4 w-4" strokeWidth={1.6} />
              <span>{m.themeToggleToDark}</span>
            </button>
            <button type="button" className={CHIP} {...chip}>
              <span aria-hidden="true" className="lab-icon flex h-4 w-4 items-center justify-center">
                <NoteIcon on={false} className="block h-[15px] w-[9.5px] text-muted" />
              </span>
              <span>{s.menuToggleOff}</span>
            </button>
          </div>
          <div className="flex flex-wrap justify-between gap-x-5 gap-y-2.5 text-[13px]">
            <a href={m.email.href} className="text-muted transition-colors duration-200 hover:text-foreground" {...role("nav", 13)}>
              {m.email.label}
            </a>
            <span className="flex gap-4">
              {m.socials.map((social) => (
                <a
                  key={social.key}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted transition-colors duration-200 hover:text-foreground"
                  {...role("nav", 13)}
                >
                  {social.label}
                </a>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
