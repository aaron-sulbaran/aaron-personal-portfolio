"use client";

import { useEffect } from "react";
import { reportIntroLoad } from "@/lib/home/introLoad";
import { maskCss, type NameFieldMask } from "@/lib/home/nameField";

// The field's stand-in: the hero's poster (public/coil/field-{light,dark}.avif,
// the live field's first frame) under the same radial mask, both themes drawn
// and the document's theme picking one by CSS (so the first paint is right
// before any script). It carries the page where the live field cannot run
// (reduced motion, no WebGL 2, a failed chunk) and sits under the live canvas
// until that has drawn. Static: reduced motion and the off-screen pause both
// ask for nothing that moves. The poster keeps its old orange; only the live
// field leans bluer.
const POSTER = { light: "/coil/field-light.avif", dark: "/coil/field-dark.avif" } as const;

// The poster is the field's first frame, 1440 by 900; the stage shows its
// lower middle, where the blue mass is and the orange lobe is not.
const SHOW = "bg-cover bg-no-repeat [background-position:50%_78%]";

export function PosterNameField({ mask, hidden, report }: { mask: NameFieldMask; hidden: boolean; report: boolean }) {
  const image = maskCss(mask);
  // Where the poster is what shows, the load waits for it to decode.
  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    const done = () => {
      if (!cancelled) reportIntroLoad("field");
    };
    const img = new Image();
    img.onload = done;
    img.onerror = done;
    img.src = POSTER.light;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [report]);

  const style = (src: string) => ({ backgroundImage: `url(${src})`, maskImage: image, WebkitMaskImage: image });
  return (
    <div aria-hidden="true" data-name-poster="" className={`absolute inset-0 ${hidden ? "invisible" : ""}`}>
      <div className={`absolute inset-0 dark:hidden ${SHOW}`} style={style(POSTER.light)} />
      <div className={`absolute inset-0 hidden dark:block ${SHOW}`} style={style(POSTER.dark)} />
    </div>
  );
}
