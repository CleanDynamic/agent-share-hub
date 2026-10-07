/* UI-P07 — the Controls section: buttons, icon buttons, segmented controls,
   tabs, filter chips, category chips and avatars. Every control here is live
   (the segmented controls, tabs and chips change state) so it can be operated
   from the keyboard on this page, which is part of what this section is for. */

import { useState } from "react";
import { ArrowRight, Bell, Check, Plus, Search } from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { FilterChip } from "@/components/brand/FilterChip";
import { IconButton } from "@/components/brand/IconButton";
import { useRoom } from "@/components/brand/useRoom";
import { Segmented } from "@/components/brand/Segmented";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { CATEGORIES } from "@/lib/theme/category";

import { Example, Row, Section } from "./parts";

const GAP_18 = <div style={{ height: 18 }} />;

export function ControlsSection() {
  const [follow, setFollow] = useState("everyone");
  const [lens, setLens] = useState("all");
  /* The theme control shows the room that is painted until it is operated. */
  const painted = useRoom();
  const [picked, setPicked] = useState<string | null>(null);
  const room = picked ?? painted;
  const [tab, setTab] = useState("anatomy");
  const [filter, setFilter] = useState("all");

  return (
    <Section
      name="Controls"
      note="buttons · icon button · segmented · tabs · filter chips · category chips · avatar"
    >
      <Row>
        <Example caption="button primary 36">
          <Button variant="primary" icon={Plus}>
            Primary
          </Button>
        </Example>
        <Example caption="button secondary 36">
          <Button variant="secondary" icon={ArrowRight}>
            Secondary
          </Button>
        </Example>
        <Example caption="button ghost 36">
          <Button variant="ghost">Ghost</Button>
        </Example>
        <Example caption="button primary 48 (mobile full width)">
          <Button variant="primary" size={48} fontSize={15} icon={Check}>
            I ran this and it worked
          </Button>
        </Example>
        <Example caption="icon button 34">
          <IconButton icon={Search} label="Search" size={34} />
        </Example>
        <Example caption="icon button 38">
          <IconButton icon={Bell} label="Activity" size={38} />
        </Example>
      </Row>
      {GAP_18}
      <Row>
        <Example caption="segmented 2">
          <Segmented
            label="Feed"
            size={34}
            value={follow}
            onChange={setFollow}
            items={[
              { value: "following", label: "Following" },
              { value: "everyone", label: "Everyone" },
            ]}
          />
        </Example>
        <Example caption="segmented 4 (lenses)">
          <Segmented
            label="Gallery lens"
            size={36}
            value={lens}
            onChange={setLens}
            items={[
              { value: "all", label: "All 1,284" },
              { value: "proven", label: "Proven 512" },
              { value: "rebuilt", label: "Rebuilt 148" },
              { value: "unsolved", label: "Unsolved 23" },
            ]}
          />
        </Example>
        <Example caption="segmented theme">
          <Segmented
            label="Theme"
            size={32}
            fontSize={11}
            value={room}
            onChange={setPicked}
            items={[
              { value: "noon", label: "Noon" },
              { value: "dusk", label: "Dusk" },
              { value: "system", label: "System" },
            ]}
          />
        </Example>
      </Row>
      {GAP_18}
      <Row>
        <Example caption="tabs">
          <div style={{ width: 560 }}>
            <UnderlineTabs
              label="Build sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "anatomy", label: "Anatomy" },
                { value: "watch", label: "Watch it get built" },
                { value: "run", label: "Run it yourself" },
                { value: "broke", label: "Where it broke" },
                { value: "result", label: "Result" },
              ]}
            />
          </div>
        </Example>
        <Example caption="filter chips (mobile)">
          <FilterChip label="All" on={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Proven"
            count={512}
            on={filter === "proven"}
            onClick={() => setFilter("proven")}
          />
        </Example>
      </Row>
      {GAP_18}
      <Row gap={10}>
        {CATEGORIES.map((category) => (
          <Example key={category} caption={category}>
            <CategoryChip category={category} label={category} />
          </Example>
        ))}
      </Row>
      {GAP_18}
      <Row>
        <Example caption="avatar 22">
          <Avatar size={22} userId="u-ma" name="Maya Ali" hue={1} />
        </Example>
        <Example caption="avatar 28">
          <Avatar size={28} userId="u-ko" name="Kofi Owusu" hue={0} />
        </Example>
        <Example caption="avatar 34">
          <Avatar size={34} userId="u-ad" name="Ada Diaz" hue={3} />
        </Example>
        <Example caption="avatar 78">
          <Avatar size={78} userId="u-in" name="Ines Novak" hue={4} />
        </Example>
      </Row>
    </Section>
  );
}
