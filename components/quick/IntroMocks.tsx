import { quickCopy } from "@/lib/content/quick";

// The two invitations, drawn over the social card's still so the lab can
// compare them without booting the Coil. Neither one blocks the hero.
export function IntroMocks() {
  return (
    <section className="mb-20 grid gap-6 lg:grid-cols-2">
      <figure className="overflow-hidden rounded-2xl border border-border">
        <div className="relative h-64 bg-cover bg-center" style={{ backgroundImage: "url(/coil/og-still.jpg)" }}>
          <p className="absolute bottom-4 left-4 rounded-full bg-glass-strong px-3 py-1 font-label text-label text-foreground">
            {quickCopy.rushLink}
          </p>
        </div>
        <figcaption className="px-4 py-3 font-label text-label text-muted">A. A label under the name. Always there.</figcaption>
      </figure>
      <figure className="overflow-hidden rounded-2xl border border-border">
        <div className="relative h-64 bg-cover bg-center" style={{ backgroundImage: "url(/coil/og-still.jpg)" }}>
          <div className="absolute bottom-4 right-4 w-64 rounded-2xl bg-glass-strong p-4 text-foreground">
            <p className="font-display text-xl">{quickCopy.rushTitle}</p>
            <p className="mt-1 text-sm text-muted">{quickCopy.rushBody}</p>
            <p className="mt-3 flex gap-2 font-label text-label">
              <span className="rounded-full bg-accent px-3 py-1 text-background">{quickCopy.rushYes}</span>
              <span className="rounded-full px-3 py-1 shadow-[inset_0_0_0_1px_var(--color-border)]">{quickCopy.rushNo}</span>
            </p>
          </div>
        </div>
        <figcaption className="px-4 py-3 font-label text-label text-muted">B. A toast, once, after the entrance. It leaves on scroll.</figcaption>
      </figure>
    </section>
  );
}
