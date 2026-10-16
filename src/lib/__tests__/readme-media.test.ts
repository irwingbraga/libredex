import { describe, expect, it } from "vitest";
import { extractImages, pickReadmeMedia, resolveImageUrl } from "../readme-media";

const ctx = { owner: "acme", repo: "app", branch: "main" };

describe("resolveImageUrl", () => {
  it("resolves relative paths against raw.githubusercontent.com", () => {
    expect(resolveImageUrl("./docs/shot.png", ctx)).toBe("https://raw.githubusercontent.com/acme/app/main/docs/shot.png");
    expect(resolveImageUrl("/img/a.png", { ...ctx, dir: "docs" })).toBe("https://raw.githubusercontent.com/acme/app/main/img/a.png");
    expect(resolveImageUrl("../a.png", { ...ctx, dir: "docs/en" })).toBe("https://raw.githubusercontent.com/acme/app/main/docs/a.png");
  });

  it("rewrites github blob links", () => {
    expect(resolveImageUrl("https://github.com/acme/app/blob/main/s.png?raw=true", ctx)).toBe("https://raw.githubusercontent.com/acme/app/main/s.png");
  });

  it("drops data URIs and anchors", () => {
    expect(resolveImageUrl("data:image/png;base64,xx", ctx)).toBeNull();
    expect(resolveImageUrl("#top", ctx)).toBeNull();
  });
});

describe("extractImages", () => {
  it("finds markdown, reference and html images in document order", () => {
    const md = [
      '<p align="center"><img src="logo.png" width="120" alt="Acme"></p>',
      "![Screenshot](shots/main.png \"Main\")",
      "![demo][d]",
      "[d]: https://example.com/demo.gif",
    ].join("\n");
    expect(extractImages(md).map((i) => i.url)).toEqual(["logo.png", "shots/main.png", "https://example.com/demo.gif"]);
  });
});

describe("pickReadmeMedia", () => {
  it("skips badges and picks logo and screenshot", () => {
    const md = [
      "[![Build](https://img.shields.io/github/actions/x.svg)](link)",
      '<img src="assets/icon.svg" width="96">',
      "![F-Droid](https://fdroid.gitlab.io/artwork/badge/get-it-on.png)",
      "![](assets/random.png)",
      "![App screenshot](assets/screen1.png)",
    ].join("\n");
    expect(pickReadmeMedia(md, ctx)).toEqual({
      logo: "https://raw.githubusercontent.com/acme/app/main/assets/icon.svg",
      screenshot: "https://raw.githubusercontent.com/acme/app/main/assets/screen1.png",
    });
  });

  it("falls back to the first raster image", () => {
    const md = "![](https://github.com/user-attachments/assets/1234-abcd)";
    expect(pickReadmeMedia(md, ctx).screenshot).toBe("https://github.com/user-attachments/assets/1234-abcd");
  });

  it("returns nulls when only badges exist", () => {
    expect(pickReadmeMedia("![license](https://img.shields.io/badge/license-MIT-blue.svg)", ctx)).toEqual({ logo: null, screenshot: null });
  });
});
