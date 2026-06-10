"use client";

import { siteContent } from "@/lib/content";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  const { title, body, retry } = siteContent.errorPage;

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="font-serif text-display italic leading-none tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-6 max-w-sm text-body-lg text-muted">{body}</p>
      <button
        onClick={reset}
        className="mt-10 text-base font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
      >
        {retry}
      </button>
    </main>
  );
}
