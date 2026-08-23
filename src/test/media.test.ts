// Acceptance cover for the media data layer (NS-P11).
//
// The Supabase client is replaced with a stub, so what these assertions prove
// is what src/lib/build/media.ts does — the guards it applies before writing,
// the order it writes in, what it undoes when a write half-fails, and the
// shape of the URLs it hands out.
//
// The stub's getPublicUrl reproduces storage-js's own implementation, query
// string and render path included, so the URL assertions are not asserting
// against a convenient fiction.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_URL = "https://project.supabase.co";

interface TransformStub {
  width?: number;
  height?: number;
  resize?: string;
  quality?: number;
}

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
  deleted: [] as string[],
  uploaded: [] as { path: string; contentType?: string }[],
  removed: [] as string[][],
  insertError: null as { message: string } | null,
  uploadError: null as { message: string } | null,
  removeError: null as { message: string } | null,
  selectError: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const publicUrl = (bucket: string, path: string, transform?: TransformStub) => {
    const query = new URLSearchParams();
    if (transform) {
      if (transform.width) query.set("width", String(transform.width));
      if (transform.height) query.set("height", String(transform.height));
      if (transform.resize) query.set("resize", transform.resize);
      if (transform.quality) query.set("quality", String(transform.quality));
    }
    const renderPath = transform ? "render/image" : "object";
    const queryString = query.toString();
    return (
      `${PROJECT_URL}/storage/v1/${renderPath}/public/${bucket}/${path}` +
      (queryString ? `?${queryString}` : "")
    );
  };

  const table = () => {
    const filters: [string, unknown][] = [];

    const result = () => ({
      data: state.rows.filter((row) =>
        filters.every(([column, value]) => row[column] === value)
      ),
      error: state.selectError,
    });

    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      order: () => Promise.resolve(result()),
      maybeSingle: () =>
        Promise.resolve({
          data: state.selectError ? null : result().data[0] ?? null,
          error: state.selectError,
        }),
      single: () =>
        Promise.resolve({
          data: state.selectError ? null : result().data[0] ?? null,
          error: state.selectError,
        }),
    };

    return {
      select: () => query,
      insert: (row: Record<string, unknown>) => {
        state.inserted.push(row);
        const stored = { id: "media-new", created_at: "2026-08-23T10:00:00Z", ...row };
        if (!state.insertError) state.rows.push(stored);
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                state.insertError
                  ? { data: null, error: state.insertError }
                  : { data: stored, error: null }
              ),
          }),
        };
      },
      delete: () => ({
        eq: (_column: string, value: string) => {
          state.deleted.push(value);
          state.rows = state.rows.filter((row) => row.id !== value);
          return Promise.resolve({ error: null });
        },
      }),
    };
  };

  return {
    supabase: {
      from: () => table(),
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
      storage: {
        from: (bucket: string) => ({
          getPublicUrl: (path: string, options?: { transform?: TransformStub }) => ({
            data: { publicUrl: publicUrl(bucket, path, options?.transform) },
          }),
          createSignedUrl: (
            path: string,
            expiresIn: number,
            options?: { transform?: TransformStub }
          ) =>
            Promise.resolve({
              data: {
                signedUrl: `${publicUrl(bucket, path, options?.transform)}&token=t&expires=${expiresIn}`,
              },
              error: null,
            }),
          upload: (path: string, _file: File, options?: { contentType?: string }) => {
            if (state.uploadError) {
              return Promise.resolve({ data: null, error: state.uploadError });
            }
            state.uploaded.push({ path, contentType: options?.contentType });
            return Promise.resolve({ data: { path }, error: null });
          },
          remove: (paths: string[]) => {
            state.removed.push(paths);
            return Promise.resolve({ data: null, error: state.removeError });
          },
        }),
      },
    },
  };
});

import {
  DEFAULT_MEDIA_QUALITY,
  DEFAULT_MEDIA_WIDTH,
  MEDIA_MAX_BYTES,
  acceptedMediaTypes,
  deleteMedia,
  getMediaById,
  getMediaForBuild,
  mediaKindFor,
  mediaPath,
  mediaUrl,
  signedMediaUrl,
  uploadMedia,
} from "@/lib/build/media";

const BUILD_ID = "11111111-0000-4000-8000-000000000001";
const NODE_ID = "22222222-0000-4000-8000-000000000002";

const image = {
  id: "m1",
  bucket: "build-media",
  path: `${BUILD_ID}/${NODE_ID}/abc.png`,
  kind: "image",
};

const clip = { ...image, id: "m2", kind: "video", path: `${BUILD_ID}/unplaced/abc.mp4` };

/** A File of a stated size without allocating it. */
function file(name: string, type: string, size = 1024): File {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
}

// jsdom decodes nothing, so an unstubbed probe would sit out its five second
// ceiling on every upload. A bitmap decoder that answers immediately gives the
// image path real dimensions to record; withdrawing createObjectURL sends the
// video and audio path straight to its tolerated no-answer.
beforeEach(() => {
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 800,
    height: 600,
    close: () => undefined,
  }));
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: undefined,
    revokeObjectURL: () => undefined,
  });

  state.rows = [];
  state.inserted = [];
  state.deleted = [];
  state.uploaded = [];
  state.removed = [];
  state.insertError = null;
  state.uploadError = null;
  state.removeError = null;
  state.selectError = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mediaUrl", () => {
  it("always transforms an image", () => {
    const url = mediaUrl(image);
    expect(url).toContain(`width=${DEFAULT_MEDIA_WIDTH}`);
    expect(url).toContain(`quality=${DEFAULT_MEDIA_QUALITY}`);
    expect(url).toContain("/render/image/");
  });

  it("honours an explicit width and quality", () => {
    const url = mediaUrl(image, { width: 32, quality: 60 });
    expect(url).toContain("width=32");
    expect(url).toContain("quality=60");
  });

  it("serves the original only when the caller says so explicitly", () => {
    const url = mediaUrl(image, { width: "original" });
    expect(url).not.toContain("width=");
    expect(url).not.toContain("quality=");
    expect(url).toContain("/object/");
  });

  it("never transforms a non-image", () => {
    const url = mediaUrl(clip);
    expect(url).not.toContain("width=");
    expect(url).not.toContain("/render/image/");
  });

  it("addresses the authenticated endpoint, because the bucket is private", () => {
    expect(mediaUrl(image)).toContain("/render/image/authenticated/");
    expect(mediaUrl(clip)).toContain("/object/authenticated/");
    expect(mediaUrl(image)).not.toContain("/public/");
  });

  it("signs a URL with the same transform discipline", async () => {
    const signed = await signedMediaUrl(image, { width: 480 });
    expect(signed).toContain("width=480");
    expect(signed).toContain("token=");

    const original = await signedMediaUrl(image, { width: "original" });
    expect(original).not.toContain("width=");
  });
});

describe("mediaPath", () => {
  it("puts the build id first and the node id second", () => {
    const path = mediaPath(BUILD_ID, NODE_ID, "png");
    expect(path).toMatch(
      new RegExp(`^${BUILD_ID}/${NODE_ID}/[0-9a-f-]{36}\\.png$`)
    );
  });

  it("marks material with no node as unplaced", () => {
    expect(mediaPath(BUILD_ID, null, "mp4")).toContain(`${BUILD_ID}/unplaced/`);
  });
});

describe("accepted types", () => {
  it("maps a mime to its kind", () => {
    expect(mediaKindFor("image/png")).toBe("image");
    expect(mediaKindFor("video/mp4")).toBe("video");
    expect(mediaKindFor("audio/mpeg")).toBe("audio");
    expect(mediaKindFor("application/pdf")).toBe("file");
    expect(mediaKindFor("image/png; charset=binary")).toBe("image");
    expect(mediaKindFor("application/x-msdownload")).toBeNull();
    expect(mediaKindFor(null)).toBeNull();
  });

  it("does not accept SVG", () => {
    expect(acceptedMediaTypes()).not.toContain("image/svg+xml");
  });
});

describe("uploadMedia", () => {
  it("refuses a file over the limit before writing anything", async () => {
    await expect(
      uploadMedia({
        buildId: BUILD_ID,
        file: file("huge.png", "image/png", MEDIA_MAX_BYTES + 1),
      })
    ).rejects.toThrow(/limit is 25/);
    expect(state.uploaded).toHaveLength(0);
  });

  it("refuses a type that is not on the list", async () => {
    await expect(
      uploadMedia({ buildId: BUILD_ID, file: file("x.exe", "application/x-msdownload") })
    ).rejects.toThrow(/not an accepted upload type/);
    expect(state.uploaded).toHaveLength(0);
  });

  it("refuses a build id that would break the path convention", async () => {
    await expect(
      uploadMedia({ buildId: "../other", file: file("a.png", "image/png") })
    ).rejects.toThrow(/not a uuid/);
    expect(state.uploaded).toHaveLength(0);
  });

  it("uploads, then records the row", async () => {
    const media = await uploadMedia({
      buildId: BUILD_ID,
      nodeId: NODE_ID,
      file: file("shot.png", "image/png", 2048),
    });

    expect(state.uploaded).toHaveLength(1);
    expect(state.uploaded[0].path).toMatch(new RegExp(`^${BUILD_ID}/${NODE_ID}/`));
    expect(state.inserted[0]).toMatchObject({
      build_id: BUILD_ID,
      node_id: NODE_ID,
      bucket: "build-media",
      kind: "image",
      mime: "image/png",
      bytes: 2048,
    });
    expect(state.inserted[0].path).toBe(state.uploaded[0].path);
    expect(media.id).toBe("media-new");
  });

  it("records an image's dimensions, read before the row is written", async () => {
    await uploadMedia({ buildId: BUILD_ID, file: file("shot.png", "image/png") });
    expect(state.inserted[0]).toMatchObject({ width: 800, height: 600 });
  });

  it("leaves the dimensions null when nothing can decode the file", async () => {
    await uploadMedia({ buildId: BUILD_ID, file: file("clip.mp4", "video/mp4") });
    expect(state.inserted[0]).toMatchObject({ width: null, height: null, duration: null });
  });

  it("keeps the uploaded file's extension", async () => {
    await uploadMedia({ buildId: BUILD_ID, file: file("clip.mp4", "video/mp4") });
    expect(state.uploaded[0].path).toMatch(/\.mp4$/);
  });

  it("falls back to the mime's extension when the name has none", async () => {
    await uploadMedia({ buildId: BUILD_ID, file: file("clipboard", "image/webp") });
    expect(state.uploaded[0].path).toMatch(/\.webp$/);
  });

  it("removes the object when the row will not insert", async () => {
    state.insertError = { message: "new row violates row-level security policy" };

    await expect(
      uploadMedia({ buildId: BUILD_ID, file: file("shot.png", "image/png") })
    ).rejects.toThrow(/uploadMedia \(insert\)/);

    expect(state.removed).toEqual([[state.uploaded[0].path]]);
  });

  it("reports progress and ends at one", async () => {
    const seen: number[] = [];
    await uploadMedia({
      buildId: BUILD_ID,
      file: file("shot.png", "image/png"),
      onProgress: (fraction) => seen.push(fraction),
    });
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it("does not record a row when the upload itself fails", async () => {
    state.uploadError = { message: "bucket not found" };
    await expect(
      uploadMedia({ buildId: BUILD_ID, file: file("shot.png", "image/png") })
    ).rejects.toThrow(/uploadMedia \(storage\)/);
    expect(state.inserted).toHaveLength(0);
  });
});

describe("deleteMedia", () => {
  it("removes the row first, then the object", async () => {
    state.rows = [{ ...image }];
    await deleteMedia("m1");
    expect(state.deleted).toEqual(["m1"]);
    expect(state.removed).toEqual([[image.path]]);
  });

  it("tolerates an object that has already gone", async () => {
    state.rows = [{ ...image }];
    state.removeError = { message: "Object not found" };
    await expect(deleteMedia("m1")).resolves.toBeUndefined();
    expect(state.deleted).toEqual(["m1"]);
  });

  it("does nothing for a row that is not there", async () => {
    await deleteMedia("gone");
    expect(state.deleted).toHaveLength(0);
    expect(state.removed).toHaveLength(0);
  });
});

describe("reads", () => {
  it("returns a build's media", async () => {
    state.rows = [{ ...image, build_id: BUILD_ID }];
    await expect(getMediaForBuild(BUILD_ID)).resolves.toHaveLength(1);
  });

  it("returns null for a media id that is not there", async () => {
    await expect(getMediaById("nope")).resolves.toBeNull();
  });

  it("names the operation that failed", async () => {
    state.selectError = { message: "permission denied" };
    await expect(getMediaById("m1")).rejects.toThrow(/getMediaById failed/);
  });
});
