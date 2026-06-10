import Link from "next/link";
import { siteContent } from "@/lib/content";

export default function NotFound() {
  const { title, body, cta } = siteContent.notFound;

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="font-serif text-display italic leading-none tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-6 max-w-sm text-body-lg text-muted">{body}</p>
      <Link
        href="/"
        className="mt-10 text-base font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
      >
        {cta}
      </Link>
    </main>
  );
}
