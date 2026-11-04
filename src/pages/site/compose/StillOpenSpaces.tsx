/* UX-08 P1: the publish checklist's `In` control. It opens the spaces menu the New post window uses (checkboxes over the spaces the
   person can post in) and applies the choice to every still-open topic the publish starts. With nothing chosen the topics are in no
   space. It reads the spaces itself, so the checklist stays presentational. */

import { useQuery } from "@tanstack/react-query";

import { PostControl } from "@/components/post/postControls";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { listPostableSpaces, type Space } from "@/lib/openbuilds";

import { postableKey } from "../openbuilds/spaceModel";

/** Above the checklist window (71), as the New post window's own menu is. */
const MENU_Z = 80;

export function StillOpenSpaces({ selected, onChange }: { selected: readonly string[]; onChange: (ids: string[]) => void }) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const spaces = useQuery({ queryKey: postableKey(viewerId), queryFn: listPostableSpaces, enabled: viewerId !== null });
  const postable: Space[] = spaces.data ?? [];
  const names = postable.filter((space) => selected.includes(space.id)).map((space) => space.name).join(", ");
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PostControl aria-label={`In: ${names || "No space"}`}>{`In: ${names || "No space"}`}</PostControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ zIndex: MENU_Z }}>
        {postable.length === 0 ? <DropdownMenuItem disabled>No spaces to post in</DropdownMenuItem> : null}
        {postable.map((space) => (
          <DropdownMenuCheckboxItem key={space.id} checked={selected.includes(space.id)} onSelect={(event) => event.preventDefault()} onCheckedChange={() => toggle(space.id)}>
            {space.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
