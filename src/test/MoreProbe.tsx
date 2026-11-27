// A test seam for the phone's bar: pages register More rows with `useRegisterPageBar`, and the real bar draws them in a sheet. This
// draws them as plain buttons (and links), so a test that is about a page can choose a row without mounting the bar.

import { usePageBar } from "@/components/shell/phoneBarRegistry";

export function MoreProbe() {
  const { more = [] } = usePageBar();
  return (
    <div data-testid="more-probe">
      {more.map((item) =>
        item.to ? (
          <a key={item.label} href={item.to}>
            {item.label}
          </a>
        ) : (
          <button key={item.label} type="button" disabled={item.disabled} onClick={item.onSelect}>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

export default MoreProbe;
