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

  it("asks for an opaque context by default and one with alpha for the intro's glow", () => {
    const asked: unknown[] = [];
    const canvas = { getContext: (_: string, attributes: unknown) => (asked.push(attributes), null) } as unknown as HTMLCanvasElement;
    createFooterFieldGl(canvas);
    createFooterFieldGl(canvas, { alpha: true });
    expect(asked[0]).toMatchObject({ alpha: false, premultipliedAlpha: false });
    expect(asked[1]).toMatchObject({ alpha: true, premultipliedAlpha: true });
  });
});
