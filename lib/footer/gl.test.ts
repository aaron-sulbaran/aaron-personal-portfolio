import { describe, expect, it } from "vitest";
import { createFooterFieldGl } from "@/components/footer/gl/footerFieldGl";

// The field's chunk without a context: no WebGL 2, or one already lost. The
// footer shows the poster stand-in then (components/footer/FooterField.tsx).

const canvasWith = (context: unknown) => ({ getContext: () => context }) as unknown as HTMLCanvasElement;

describe("the field's chunk", () => {
  it("makes no field without a WebGL 2 context", () => {
    expect(createFooterFieldGl(canvasWith(null))).toBeNull();
  });

  it("makes no field on a lost context, nor when asking throws", () => {
    expect(createFooterFieldGl(canvasWith({ isContextLost: () => true }))).toBeNull();
    const throwing = { getContext: () => { throw new Error("blocked"); } } as unknown as HTMLCanvasElement;
    expect(createFooterFieldGl(throwing)).toBeNull();
  });
});
