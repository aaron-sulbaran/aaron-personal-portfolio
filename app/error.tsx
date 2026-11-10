"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  return <ErrorPanel reset={reset} />;
}
