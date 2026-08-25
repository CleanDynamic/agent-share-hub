import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LegacyUploadBanner } from "./LegacyUploadBanner";

/* ────────────────────────────────────────────────
   The standing notice on the old blueprint editor.

   What matters is that it points somewhere without taking anyone
   anywhere, and that it does not fight the centre column for height.
──────────────────────────────────────────────── */

function renderAtBlueprint() {
  return render(
    <MemoryRouter initialEntries={["/upload/blueprint?draft=abc"]}>
      <Routes>
        <Route
          path="/upload/blueprint"
          element={
            <>
              <LegacyUploadBanner />
              <div data-testid="old-editor">the old editor</div>
            </>
          }
        />
        <Route path="/compose/new" element={<div data-testid="workspace">workspace</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LegacyUploadBanner", () => {
  it("names the old tool and links to the new one", () => {
    renderAtBlueprint();
    expect(screen.getByText(/previous publishing tool/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /build workspace/i });
    expect(link).toHaveAttribute("href", "/compose/new");
  });

  it("does not redirect — the old editor still renders beneath it", () => {
    renderAtBlueprint();
    expect(screen.getByTestId("old-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
  });

  it("says the draft in progress still saves and publishes here", () => {
    renderAtBlueprint();
    expect(screen.getByText(/still saves and\s+publishes here/i)).toBeInTheDocument();
  });

  it("refuses the flex-grow the centre column hands its children", () => {
    renderAtBlueprint();
    // `.fs-page-body > *` would otherwise stretch the banner to share the
    // column with the editor.
    expect(screen.getByTestId("legacy-upload-banner").style.flex).toBe("0 0 auto");
  });
});
