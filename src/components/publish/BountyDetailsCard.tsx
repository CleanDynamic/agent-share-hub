import * as React from "react";
import { Target, Info, CalendarIcon } from "lucide-react";
import { format, addWeeks, addMonths } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type RewardType = "none" | "kudos" | "cash" | "token";

export interface BountyDetailsValue {
  rewardType: RewardType;
  rewardAmount: number | null;
  rewardCurrency: string | null;
  deadline: Date | null;
  acceptanceCriteria: string;
}

interface BountyDetailsCardProps {
  value: BountyDetailsValue;
  onChange: (value: BountyDetailsValue) => void;
  /** Inline error keyed by sub-field, surfaced from PublishMetadataForm validation. */
  errors?: Partial<
    Record<"rewardType" | "rewardAmount" | "rewardCurrency" | "acceptanceCriteria", string>
  >;
  /** Stable id used by parent to scrollIntoView when validation fails. */
  anchorId?: string;
}

const rewardTypeOptions: { value: RewardType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "kudos", label: "Kudos" },
  { value: "cash", label: "Cash" },
  { value: "token", label: "Token" },
];

const PRESET_CURRENCIES = ["USD", "EUR", "GBP", "ETH", "USDC", "SOL"];
const currencyOptions = [...PRESET_CURRENCIES, "Custom"];

const deadlineQuickPicks = [
  { label: "1 week", getValue: () => addWeeks(new Date(), 1) },
  { label: "2 weeks", getValue: () => addWeeks(new Date(), 2) },
  { label: "1 month", getValue: () => addMonths(new Date(), 1) },
  { label: "3 months", getValue: () => addMonths(new Date(), 3) },
  { label: "Open-ended", getValue: () => null as Date | null },
];

const ACCEPT_MAX = 500;

export function BountyDetailsCard({
  value,
  onChange,
  errors,
  anchorId = "bounty-details-card",
}: BountyDetailsCardProps) {
  const [isCustomCurrency, setIsCustomCurrency] = React.useState(
    value.rewardCurrency !== null &&
      value.rewardCurrency !== "" &&
      !PRESET_CURRENCIES.includes(value.rewardCurrency),
  );
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const updateValue = (updates: Partial<BountyDetailsValue>) => {
    onChange({ ...value, ...updates });
  };

  const showRewardAmount =
    value.rewardType === "cash" || value.rewardType === "token";

  return (
    <div
      id={anchorId}
      className="w-full"
      style={{
        background: "var(--recess)",
        border: "0.5px solid color-mix(in srgb, var(--lit) 18%, transparent)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={14} color="var(--lit)" strokeWidth={1.8} />
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            Bounty details
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About bounty details"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "help",
                  padding: 0,
                  color: "var(--text2)",
                }}
              >
                <Info size={13} strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p style={{ maxWidth: 240, fontSize: 12, lineHeight: 1.4 }}>
                Bounty-specific fields. Visible to solvers.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Divider />

      {/* Section 1 — Reward type */}
      <div id={`${anchorId}-reward-type`} className="flex flex-col gap-2">
        <SectionLabel>Reward</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {rewardTypeOptions.map((option) => (
            <Chip
              key={option.value}
              active={value.rewardType === option.value}
              onClick={() => updateValue({ rewardType: option.value })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        {errors?.rewardType ? (
          <HelperText error>{errors.rewardType}</HelperText>
        ) : (
          <HelperText>Solvers see this on the bounty card</HelperText>
        )}
      </div>

      {/* Section 2 — Reward amount (conditional) */}
      {showRewardAmount && (
        <>
          <Divider />
          <div id={`${anchorId}-reward-amount`} className="flex flex-col gap-2">
            <SectionLabel>Amount</SectionLabel>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="any"
                value={value.rewardAmount ?? ""}
                onChange={(e) =>
                  updateValue({
                    rewardAmount: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
                placeholder="0.00"
                className="flex-1 outline-none"
                style={{
                  height: 44,
                  background: "var(--recess)",
                  border: errors?.rewardAmount
                    ? "0.5px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)"
                    : "0.5px solid var(--line)",
                  borderRadius: 6,
                  padding: "0 12px",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              />
              <select
                value={
                  isCustomCurrency
                    ? "Custom"
                    : value.rewardCurrency ?? ""
                }
                onChange={(e) => {
                  if (e.target.value === "Custom") {
                    setIsCustomCurrency(true);
                    updateValue({ rewardCurrency: "" });
                  } else {
                    setIsCustomCurrency(false);
                    updateValue({ rewardCurrency: e.target.value });
                  }
                }}
                className="outline-none cursor-pointer"
                style={{
                  width: 120,
                  height: 44,
                  background: "var(--recess)",
                  border: errors?.rewardCurrency
                    ? "0.5px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)"
                    : "0.5px solid var(--line)",
                  borderRadius: 6,
                  padding: "0 12px",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                <option value="" disabled>
                  Currency
                </option>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>

            {isCustomCurrency && (
              <input
                type="text"
                value={value.rewardCurrency ?? ""}
                onChange={(e) =>
                  updateValue({
                    rewardCurrency: e.target.value.slice(0, 12),
                  })
                }
                placeholder="Custom currency or token symbol"
                maxLength={12}
                className="outline-none"
                style={{
                  height: 44,
                  background: "var(--recess)",
                  border: errors?.rewardCurrency
                    ? "0.5px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)"
                    : "0.5px solid var(--line)",
                  borderRadius: 6,
                  padding: "0 12px",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              />
            )}

            {errors?.rewardAmount || errors?.rewardCurrency ? (
              <HelperText error>
                {errors.rewardAmount || errors.rewardCurrency}
              </HelperText>
            ) : (
              <HelperText amber>
                Funds aren't held in escrow — payment is off-platform between you
                and the solver.
              </HelperText>
            )}
          </div>
        </>
      )}

      <Divider />

      {/* Section 3 — Deadline */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Deadline (optional)</SectionLabel>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between"
              style={{
                width: "100%",
                height: 44,
                background: "var(--recess)",
                border: "0.5px solid var(--line)",
                borderRadius: 6,
                padding: "0 12px",
                fontFamily: "Figtree, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: value.deadline
                  ? "var(--text)"
                  : "var(--text2)",
                cursor: "pointer",
              }}
            >
              <span>
                {value.deadline
                  ? format(value.deadline, "PPP")
                  : "Select a date or leave blank"}
              </span>
              <CalendarIcon size={14} color="var(--text2)" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.deadline ?? undefined}
              onSelect={(date) => {
                updateValue({ deadline: date ?? null });
                setCalendarOpen(false);
              }}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {deadlineQuickPicks.map((pick) => (
            <QuickPickChip
              key={pick.label}
              onClick={() => updateValue({ deadline: pick.getValue() })}
            >
              {pick.label}
            </QuickPickChip>
          ))}
        </div>
      </div>

      <Divider />

      {/* Section 4 — Acceptance criteria */}
      <div id={`${anchorId}-acceptance`} className="flex flex-col gap-2">
        <SectionLabel>Acceptance criteria</SectionLabel>
        <div>
          <textarea
            value={value.acceptanceCriteria}
            onChange={(e) => {
              if (e.target.value.length <= ACCEPT_MAX) {
                updateValue({ acceptanceCriteria: e.target.value });
              }
            }}
            placeholder="Describe what 'done' looks like for a solver. Be specific — vague criteria attract weaker solutions. (min 50 chars)"
            className="w-full outline-none resize-none"
            style={{
              minHeight: 100,
              background: "var(--recess)",
              border: errors?.acceptanceCriteria
                ? "0.5px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)"
                : "0.5px solid var(--line)",
              borderRadius: 6,
              padding: 12,
              fontFamily: "Figtree, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)",
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          {errors?.acceptanceCriteria ? (
            <HelperText error>{errors.acceptanceCriteria}</HelperText>
          ) : (
            <HelperText>
              Be specific — vague criteria attract weaker solutions.
            </HelperText>
          )}
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 11,
              fontWeight: 400,
              color: "var(--text2)",
            }}
          >
            {value.acceptanceCriteria.length} / {ACCEPT_MAX}
          </span>
        </div>
      </div>

      <Divider />

      {/* Section 5 — Initial status */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--lit)",
            }}
          />
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text2)",
            }}
          >
            Status: Open
          </span>
        </div>
        <span
          style={{
            fontFamily: "Figtree, sans-serif",
            fontSize: 10,
            fontWeight: 400,
            color: "var(--text2)",
          }}
        >
          All bounties start Open. You can mark them solved later.
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: "0.5px",
        background: "var(--recess)",
        margin: "12px 0",
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "Figtree, sans-serif",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text2)",
      }}
    >
      {children}
    </span>
  );
}

function HelperText({
  children,
  amber,
  error,
}: {
  children: React.ReactNode;
  amber?: boolean;
  error?: boolean;
}) {
  const color = error
    ? "color-mix(in srgb, var(--cat-breakage) 85%, transparent)"
    : amber
    ? "color-mix(in srgb, var(--lit) 55%, transparent)"
    : "var(--text2)";
  return (
    <span
      style={{
        fontFamily: "Figtree, sans-serif",
        fontSize: 11,
        fontWeight: 400,
        color,
      }}
    >
      {children}
    </span>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 28,
        padding: "4px 14px",
        border: active
          ? "0.5px solid color-mix(in srgb, var(--lit) 40%, transparent)"
          : "0.5px solid var(--line)",
        borderRadius: 6,
        background: active ? "color-mix(in srgb, var(--lit) 10%, transparent)" : "transparent",
        fontFamily: "Figtree, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        color: active ? "var(--lit)" : "var(--text2)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function QuickPickChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 24,
        padding: "3px 10px",
        border: "0.5px solid var(--line)",
        borderRadius: 6,
        background: "transparent",
        fontFamily: "Figtree, sans-serif",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text2)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--glass-2)";
        e.currentTarget.style.borderColor = "var(--line)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "var(--line)";
      }}
    >
      {children}
    </button>
  );
}
