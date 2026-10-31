/* SV-27 P7: the Deployment section of the List, after the last part. Unnumbered, like setup items: a section head "Deployment"
   with a meta line ("Runs on Mac Mini · 6 parts"), then one row per deployment tile in DEPLOYMENT_ORDER, grouped by agent or
   team when the build has more than one. A row opens its tile; "Made in Session 3" goes to the session. Rows use the existing
   plain row look: label left, value right, a hairline between rows. */

import { DEPLOYMENT_GROUP_HEAD, DEPLOYMENT_KIND_NAME, deploymentName, deploymentSectionMeta, groupDeployment, type DeploymentTile } from "@/lib/build/deployment";
import { t } from "@/lib/theme/tokens";
import { text } from "./refinedStyles";

import { TextButton } from "./composeControls";

export interface DeploymentSectionProps {
  tiles: readonly DeploymentTile[];
  agents: readonly { id: string; label: string }[];
  /** A session's number, by key, for "Made in Session n". */
  sessionNumber: (key: string) => number | null;
  selectedId: string | null;
  phone: boolean;
  onOpen: (id: string) => void;
  onSession?: (key: string) => void;
}

export function DeploymentSection({ tiles, agents, sessionNumber, selectedId, phone, onOpen, onSession }: DeploymentSectionProps) {
  if (tiles.length === 0) return null;
  const groups = groupDeployment(tiles, agents);
  return (
    <section aria-label={DEPLOYMENT_GROUP_HEAD} data-testid="deployment-section" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 32, minWidth: 0 }}>
      <h3 style={{ ...text(14, 500, t.text), margin: 0, lineHeight: 1.3 }}>{DEPLOYMENT_GROUP_HEAD}</h3>
      <p style={{ ...text(12, 400, t.label), margin: 0 }}>{deploymentSectionMeta(tiles)}</p>
      {groups.map((group) => (
        <div key={group.key} role="list" aria-label={group.label ?? DEPLOYMENT_GROUP_HEAD} style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          {group.label ? <p style={{ ...text(12.5, 500, t.text2), margin: "0 0 4px" }}>{group.label}</p> : null}
          {group.tiles.map((tile, at) => {
            const session = tile.payload.made_in ? sessionNumber(tile.payload.made_in) : null;
            return (
              <div
                key={tile.id}
                role="listitem"
                data-tile-id={tile.id}
                data-testid="deployment-row"
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, borderTop: at === 0 ? "none" : `1px solid ${t.hairline}`, background: selectedId === tile.id ? t.selectedFill : undefined }}
              >
                <TextButton target={phone} onClick={() => onOpen(tile.id)} aria-label={`${DEPLOYMENT_KIND_NAME[tile.kind]}: ${deploymentName(tile)}`}>
                  <span style={text(13, 500, t.text)}>{deploymentName(tile)}</span>
                </TextButton>
                <span style={{ ...text(12, 400, t.label), marginLeft: "auto" }}>{DEPLOYMENT_KIND_NAME[tile.kind]}</span>
                {session !== null && tile.payload.made_in ? (
                  <TextButton target={phone} onClick={() => onSession?.(tile.payload.made_in as string)}>
                    {`Made in Session ${session}`}
                  </TextButton>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
