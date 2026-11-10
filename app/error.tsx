"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { reportClientError } from "@/components/SiteAnalytics";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
    reportClientError("error-page", error);
  }, [error]);

  return <ErrorPanel reset={reset} />;
}
