// UX-10 P3: the profile's picture and header: what is refused before any request, what Save writes, and the crop Avatar shows.

import { beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({
  updates: [] as { table: string; values: Record<string, unknown>; id: unknown }[],
  uploads: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "11111111-1111-4111-8111-111111111111" } } } }) },
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => {
          stand.updates.push({ table, values, id });
          return { error: null };
        },
      }),
    }),
  },
}));

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  uploadMedia: vi.fn(async (input: { onProgress?: (fraction: number) => void }) => {
    stand.uploads.push(input);
    input.onProgress?.(0.5);
    input.onProgress?.(1);
    return { bucket: "profile-assets", path: "u/x.jpg", url: "https://cdn.test/u/x.jpg", kind: "image", mime: "image/jpeg", bytes: 10, width: 1200, height: 800 };
  }),
}));

import { cropFromUrl, plainUrl, profilePictureRejection, removeProfileImage, saveProfileImage, uploadProfilePicture, urlWithCrop } from "./pictures";

const file = (name: string, type: string, size = 1000) => {
  const one = new File(["x"], name, { type });
  Object.defineProperty(one, "size", { value: size });
  return one;
};

beforeEach(() => {
  stand.updates = [];
  stand.uploads = [];
});

describe("refusing a file", () => {
  it("refuses a video, a GIF and a file over the limit, before any request", async () => {
    expect(profilePictureRejection(file("a.mp4", "video/mp4"))).toMatch(/still picture/);
    expect(profilePictureRejection(file("a.gif", "image/gif"))).toMatch(/still picture/);
    expect(profilePictureRejection(file("a.png", "image/png", 30 * 1024 * 1024))).toMatch(/under 25.0MB/);
    expect(profilePictureRejection(file("a.png", "image/png"))).toBeNull();
    await expect(uploadProfilePicture(file("a.mp4", "video/mp4"), "avatar", () => undefined)).rejects.toThrow(/still picture/);
    expect(stand.uploads).toHaveLength(0);
  });

  it("uploads a still through uploadMedia under the reader's id, with progress", async () => {
    const percents: number[] = [];
    const uploaded = await uploadProfilePicture(file("a.jpg", "image/jpeg"), "banner", (percent) => percents.push(percent));
    expect(uploaded).toEqual({ url: "https://cdn.test/u/x.jpg", width: 1200, height: 800 });
    expect(stand.uploads[0]).toMatchObject({ profileId: "11111111-1111-4111-8111-111111111111" });
    expect(percents).toEqual([50, 100]);
  });
});

describe("saving", () => {
  it("writes the picture with its crop in the URL and the columns, and the ALT", async () => {
    const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.75 };
    await saveProfileImage("avatar", { url: "https://cdn.test/me.jpg", crop, alt: " Maya " });
    expect(stand.updates).toEqual([
      {
        table: "profiles",
        id: "11111111-1111-4111-8111-111111111111",
        values: { avatar_url: "https://cdn.test/me.jpg#crop=0.1,0.2,0.5,0.75", avatar_crop: crop, avatar_alt: "Maya" },
      },
    ]);
  });

  it("writes a header's URL plain, and its crop in banner_crop", async () => {
    const crop = { x: 0, y: 0.3, w: 1, h: 0.4 };
    await saveProfileImage("banner", { url: "https://cdn.test/h.jpg#crop=0,0,1,1", crop, alt: "" });
    expect(stand.updates[0].values).toEqual({ banner_url: "https://cdn.test/h.jpg", banner_crop: crop, banner_alt: null });
  });

  it("refuses an ALT over 1,000 characters without a request", async () => {
    await expect(saveProfileImage("avatar", { url: "https://cdn.test/me.jpg", crop: null, alt: "a".repeat(1001) })).rejects.toThrow();
    expect(stand.updates).toHaveLength(0);
  });

  it("removes the picture, its crop and its ALT", async () => {
    await removeProfileImage("avatar");
    expect(stand.updates[0].values).toEqual({ avatar_url: null, avatar_crop: null, avatar_alt: null });
  });
});

describe("the crop in the URL", () => {
  it("goes in as a fragment and comes back out", () => {
    const url = urlWithCrop("https://cdn.test/me.jpg", { x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(url).toBe("https://cdn.test/me.jpg#crop=0.25,0,0.5,1");
    expect(cropFromUrl(url)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(plainUrl(url)).toBe("https://cdn.test/me.jpg");
    expect(urlWithCrop(url, null)).toBe("https://cdn.test/me.jpg");
  });

  it("ignores a fragment that is not a crop inside the picture", () => {
    expect(cropFromUrl("https://cdn.test/me.jpg")).toBeNull();
    expect(cropFromUrl("https://cdn.test/me.jpg#crop=0.8,0,0.5,1")).toBeNull();
    expect(cropFromUrl(null)).toBeNull();
  });
});
