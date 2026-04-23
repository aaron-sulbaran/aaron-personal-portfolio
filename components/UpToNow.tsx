import { siteContent } from "@/lib/content";

export function UpToNow() {
  const { label, heading, items } = siteContent.upToNow;
  return (
    <section
      aria-label={label}
      className="relative w-full border-t border-border/70 px-6 py-24 md:px-10 md:py-40"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <h2 className="font-serif text-section italic md:max-w-[12ch]">{heading}</h2>
        </div>

        <ol className="grid gap-10 md:grid-cols-2 md:gap-x-16 md:gap-y-16">
          {items.map((item, i) => (
            <li key={i} className={i % 2 === 1 ? "md:translate-y-12" : ""}>
              <div className="flex items-start gap-5">
                <span className="mt-2 font-serif text-xl italic text-muted" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-lg leading-[1.55] text-foreground md:text-xl">{item}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
