import { describe, expect, it } from "vitest";

import { dmMediaRef, parseDmMedia } from "./dmMedia";

describe("DM media references", () => {
  it("round-trips a reference", () => {
    expect(parseDmMedia(dmMediaRef("dm-images", "t1/abc.jpg"))).toEqual({ bucket: "dm-images", path: "t1/abc.jpg" });
    expect(parseDmMedia(dmMediaRef("dm-voice", "t1/abc.webm"))).toEqual({ bucket: "dm-voice", path: "t1/abc.webm" });
  });

  it("reads an old year-long signed URL back to its object", () => {
    const old = "https://xyz.supabase.co/storage/v1/object/sign/dm-images/3f2a/9c1e%20b.jpg?token=eyJhbGci";
    expect(parseDmMedia(old)).toEqual({ bucket: "dm-images", path: "3f2a/9c1e b.jpg" });
  });

  it("leaves outside links and other buckets alone", () => {
    expect(parseDmMedia("https://example.com/a.png")).toBeNull();
    expect(parseDmMedia("https://xyz.supabase.co/storage/v1/object/public/avatars/u/me.png")).toBeNull();
    expect(parseDmMedia("storage:avatars/u/me.png")).toBeNull();
    expect(parseDmMedia("")).toBeNull();
    expect(parseDmMedia(null)).toBeNull();
  });
});
