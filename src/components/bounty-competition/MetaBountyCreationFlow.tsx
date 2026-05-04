import * as React from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface SubBountyDraft {
  id: string;
  title: string;
  description: string;
  targetReward: number;
  currency: string;
  acceptanceCriteria: string;
}

export interface MetaBountyFormState {
  title: string;
  description: string;
  themeTags: string[];
  subBounties: SubBountyDraft[];
  minPledge: number;
  spawnThreshold: number;
  maxContributorsPerSubBounty: number | null;
  anonymousPledgesAllowed: boolean;
  fundingDeadline: string;
}

interface MetaBountyCreationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: number;
  onStepChange: (step: number) => void;
  formState: MetaBountyFormState;
  onUpdateForm: (patch: Partial<MetaBountyFormState>) => void;
  onPublish: () => void;
  isPublishing: boolean;
}

const AVAILABLE_TAGS = [
  "DeFi",
  "NFT",
  "Gaming",
  "Infrastructure",
  "Social",
  "Analytics",
  "Security",
  "AI/ML",
];

export function MetaBountyCreationFlow({
  isOpen,
  onClose,
  currentStep,
  onStepChange,
  formState,
  onUpdateForm,
  onPublish,
  isPublishing,
}: MetaBountyCreationFlowProps) {
  if (!isOpen) return null;

  const canProceedStep1 =
    !!formState.title.trim() && !!formState.description.trim();
  const canProceedStep2 =
    formState.subBounties.length >= 2 &&
    formState.subBounties.every(
      (sb) => sb.title.trim() && sb.targetReward > 0,
    );
  const canProceedStep3 =
    formState.minPledge > 0 &&
    formState.spawnThreshold > 0 &&
    !!formState.fundingDeadline;

  const totalPoolSize = formState.subBounties.reduce(
    (sum, sb) => sum + sb.targetReward,
    0,
  );

  const handleAddSubBounty = () => {
    if (formState.subBounties.length >= 10) return;
    onUpdateForm({
      subBounties: [
        ...formState.subBounties,
        {
          id: crypto.randomUUID(),
          title: "",
          description: "",
          targetReward: 0,
          currency: "USD",
          acceptanceCriteria: "",
        },
      ],
    });
  };

  const handleRemoveSubBounty = (id: string) => {
    onUpdateForm({
      subBounties: formState.subBounties.filter((sb) => sb.id !== id),
    });
  };

  const handleUpdateSubBounty = (
    id: string,
    patch: Partial<SubBountyDraft>,
  ) => {
    onUpdateForm({
      subBounties: formState.subBounties.map((sb) =>
        sb.id === id ? { ...sb, ...patch } : sb,
      ),
    });
  };

  const toggleTag = (tag: string) => {
    if (formState.themeTags.includes(tag)) {
      onUpdateForm({
        themeTags: formState.themeTags.filter((t) => t !== tag),
      });
    } else {
      onUpdateForm({ themeTags: [...formState.themeTags, tag] });
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const stepBlocked =
    (currentStep === 1 && !canProceedStep1) ||
    (currentStep === 2 && !canProceedStep2) ||
    (currentStep === 3 && !canProceedStep3);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "600px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 64px)",
          background:
            "linear-gradient(180deg, rgba(30, 30, 35, 0.95) 0%, rgba(20, 20, 25, 0.98) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                style={{
                  width: step === currentStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    step === currentStep
                      ? "#F97316"
                      : step < currentStep
                        ? "rgba(249,115,22,0.4)"
                        : "rgba(255,255,255,0.1)",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              padding: 4,
              display: "flex",
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {/* Step 1: Concept */}
          {currentStep === 1 && (
            <div>
              <h2
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  margin: "0 0 8px 0",
                }}
              >
                Create meta-bounty
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  margin: "0 0 20px 0",
                  lineHeight: 1.5,
                }}
              >
                A meta-bounty pools community resources to fund multiple
                sub-bounties on a theme. When enough funding accumulates,
                sub-bounties are spawned and solvers can compete on each.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Title for this meta-bounty
                </label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => onUpdateForm({ title: e.target.value })}
                  placeholder="e.g., Build the next generation DEX"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.9)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Description
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) =>
                    onUpdateForm({ description: e.target.value })
                  }
                  placeholder="Describe the overall goal and theme of this meta-bounty..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.9)",
                    outline: "none",
                    resize: "vertical",
                    minHeight: 100,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Theme tags
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {AVAILABLE_TAGS.map((tag) => {
                    const isSelected = formState.themeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          padding: "6px 12px",
                          background: isSelected
                            ? "rgba(249,115,22,0.2)"
                            : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            isSelected
                              ? "rgba(249,115,22,0.4)"
                              : "rgba(255,255,255,0.1)"
                          }`,
                          borderRadius: 100,
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12,
                          fontWeight: 500,
                          color: isSelected
                            ? "#F97316"
                            : "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Sub-bounty Definitions */}
          {currentStep === 2 && (
            <div>
              <h2
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  margin: "0 0 8px 0",
                }}
              >
                Define sub-bounties
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  margin: "0 0 20px 0",
                }}
              >
                Add at least 2 sub-bounties (max 10). Each will become a
                separate bounty when funded.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {formState.subBounties.map((subBounty, index) => (
                  <div
                    key={subBounty.id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.5)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Sub-bounty {index + 1}
                      </span>
                      {formState.subBounties.length > 2 && (
                        <button
                          onClick={() => handleRemoveSubBounty(subBounty.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            display: "flex",
                          }}
                        >
                          <Trash2
                            style={{
                              width: 14,
                              height: 14,
                              color: "rgba(255,100,100,0.7)",
                            }}
                          />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={subBounty.title}
                      onChange={(e) =>
                        handleUpdateSubBounty(subBounty.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="Sub-bounty title"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        fontFamily: "Inter, sans-serif",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.9)",
                        outline: "none",
                        marginBottom: 10,
                      }}
                    />

                    <textarea
                      value={subBounty.description}
                      onChange={(e) =>
                        handleUpdateSubBounty(subBounty.id, {
                          description: e.target.value.slice(0, 200),
                        })
                      }
                      placeholder="Brief description (200 chars max)"
                      rows={2}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        fontFamily: "Inter, sans-serif",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.9)",
                        outline: "none",
                        resize: "none",
                        marginBottom: 4,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.4)",
                        textAlign: "right",
                        marginBottom: 10,
                      }}
                    >
                      {subBounty.description.length}/200
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={subBounty.targetReward || ""}
                          onChange={(e) =>
                            handleUpdateSubBounty(subBounty.id, {
                              targetReward: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="Target reward"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6,
                            fontFamily: "Inter, sans-serif",
                            fontSize: 13,
                            color: "rgba(255,255,255,0.9)",
                            outline: "none",
                          }}
                        />
                      </div>
                      <select
                        value={subBounty.currency}
                        onChange={(e) =>
                          handleUpdateSubBounty(subBounty.id, {
                            currency: e.target.value,
                          })
                        }
                        style={{
                          width: 90,
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="USD">USD</option>
                        <option value="ETH">ETH</option>
                        <option value="USDC">USDC</option>
                      </select>
                    </div>
                  </div>
                ))}

                {formState.subBounties.length < 10 && (
                  <button
                    onClick={handleAddSubBounty}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px dashed rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                    }}
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                    Add another
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Contribution Settings */}
          {currentStep === 3 && (
            <div>
              <h2
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  margin: "0 0 8px 0",
                }}
              >
                Contribution rules
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  margin: "0 0 20px 0",
                }}
              >
                Configure how contributors can pledge to sub-bounties.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Minimum pledge per contributor ($)
                  </label>
                  <input
                    type="number"
                    value={formState.minPledge || ""}
                    onChange={(e) =>
                      onUpdateForm({ minPledge: Number(e.target.value) || 0 })
                    }
                    placeholder="e.g., 10"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.9)",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Sub-bounty spawn threshold (% of target reached)
                  </label>
                  <input
                    type="number"
                    value={formState.spawnThreshold || ""}
                    onChange={(e) =>
                      onUpdateForm({
                        spawnThreshold: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    placeholder="e.g., 80"
                    min={0}
                    max={100}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.9)",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Max contributors per sub-bounty (optional)
                  </label>
                  <input
                    type="number"
                    value={formState.maxContributorsPerSubBounty ?? ""}
                    onChange={(e) =>
                      onUpdateForm({
                        maxContributorsPerSubBounty: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder="Leave empty for unlimited"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.9)",
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                  }}
                >
                  <label
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    Allow anonymous pledges?
                  </label>
                  <button
                    onClick={() =>
                      onUpdateForm({
                        anonymousPledgesAllowed:
                          !formState.anonymousPledgesAllowed,
                      })
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: formState.anonymousPledgesAllowed
                        ? "#F97316"
                        : "rgba(255,255,255,0.15)",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "white",
                        position: "absolute",
                        top: 3,
                        left: formState.anonymousPledgesAllowed ? 23 : 3,
                        transition: "left 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </button>
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Deadline for funding
                  </label>
                  <input
                    type="date"
                    value={formState.fundingDeadline}
                    onChange={(e) =>
                      onUpdateForm({ fundingDeadline: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      color: "rgba(255,255,255,0.9)",
                      outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review and Publish */}
          {currentStep === 4 && (
            <div>
              <h2
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  margin: "0 0 8px 0",
                }}
              >
                Review and publish
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  margin: "0 0 20px 0",
                }}
              >
                Review your meta-bounty before publishing.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      margin: "0 0 8px 0",
                    }}
                  >
                    {formState.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.6)",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {formState.description}
                  </p>
                  {formState.themeTags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      {formState.themeTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "3px 8px",
                            background: "rgba(249,115,22,0.15)",
                            borderRadius: 4,
                            fontFamily: "Inter, sans-serif",
                            fontSize: 10,
                            fontWeight: 500,
                            color: "#F97316",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 12,
                    }}
                  >
                    Sub-bounties ({formState.subBounties.length})
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {formState.subBounties.map((sb, i) => (
                      <div
                        key={sb.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 13,
                            color: "rgba(255,255,255,0.8)",
                          }}
                        >
                          {i + 1}. {sb.title || "Untitled"}
                        </span>
                        <span
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                            fontWeight: 500,
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          {formatCurrency(sb.targetReward)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      marginTop: 12,
                      paddingTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      Total pool size
                    </span>
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#F97316",
                      }}
                    >
                      {formatCurrency(totalPoolSize)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 12,
                    }}
                  >
                    Contribution Rules
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 2,
                        }}
                      >
                        Min pledge
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        {formatCurrency(formState.minPledge)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 2,
                        }}
                      >
                        Spawn threshold
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        {formState.spawnThreshold}%
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 2,
                        }}
                      >
                        Anonymous pledges
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        {formState.anonymousPledgesAllowed
                          ? "Allowed"
                          : "Not allowed"}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: 2,
                        }}
                      >
                        Deadline
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        {formState.fundingDeadline
                          ? new Date(
                              formState.fundingDeadline,
                            ).toLocaleDateString()
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={() => currentStep > 1 && onStepChange(currentStep - 1)}
            disabled={currentStep === 1}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color:
                currentStep === 1
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.8)",
              cursor: currentStep === 1 ? "not-allowed" : "pointer",
            }}
          >
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => onStepChange(currentStep + 1)}
              disabled={stepBlocked}
              style={{
                padding: "10px 24px",
                background: stepBlocked
                  ? "rgba(249,115,22,0.3)"
                  : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                border: "none",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                cursor: stepBlocked ? "not-allowed" : "pointer",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={onPublish}
              disabled={isPublishing}
              style={{
                padding: "12px 32px",
                background: isPublishing
                  ? "rgba(249,115,22,0.5)"
                  : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                border: "none",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: "white",
                cursor: isPublishing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {isPublishing ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      animation: "mbcf-spin 0.8s linear infinite",
                    }}
                  />
                  Publishing...
                </>
              ) : (
                "Publish meta-bounty"
              )}
            </button>
          )}
        </div>

        <style>{`
          @keyframes mbcf-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
