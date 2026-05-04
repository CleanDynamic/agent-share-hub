import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, PenTool, Target, Layers } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";
import {
  MetaBountyCreationFlow,
  type MetaBountyFormState,
} from "@/components/bounty-competition/MetaBountyCreationFlow";
import { createMetaBounty } from "@/lib/bounty-competition/createMetaBounty";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TypeCard {
  key: "blueprint" | "blog" | "bounty" | "meta-bounty";
  label: string;
  description: string;
  Icon: typeof FileStack;
  color: string;
  route?: string;
}

const CARDS: TypeCard[] = [
  {
    key: "blueprint",
    label: "Blueprint",
    description:
      "An article with embedded visual workflows. Best for tutorials, recipes, and how-tos.",
    Icon: FileStack,
    color: "#E8571A",
    route: "/upload/blueprint",
  },
  {
    key: "blog",
    label: "Blog",
    description:
      "Long-form writing with inline references to blueprints, stages, or blocks.",
    Icon: PenTool,
    color: "#2EC4B6",
    route: "/upload/blog",
  },
  {
    key: "bounty",
    label: "Bounty",
    description:
      "Post a partial blueprint and ask the community for help filling in the gaps.",
    Icon: Target,
    color: "#F59E0B",
    route: "/upload/bounty",
  },
  {
    key: "meta-bounty",
    label: "Meta-bounty",
    description:
      "Pool community resources to spawn multiple bounties on a theme.",
    Icon: Layers,
    color: "#7C3AED",
  },
];

const EMPTY_FORM: MetaBountyFormState = {
  title: "",
  description: "",
  themeTags: [],
  subBounties: [
    {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      targetReward: 0,
      currency: "USD",
      acceptanceCriteria: "",
    },
    {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      targetReward: 0,
      currency: "USD",
      acceptanceCriteria: "",
    },
  ],
  minPledge: 10,
  spawnThreshold: 80,
  maxContributorsPerSubBounty: null,
  anonymousPledgesAllowed: true,
  fundingDeadline: "",
};

export default function UploadTypeSelector() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaStep, setMetaStep] = useState(1);
  const [metaForm, setMetaForm] = useState<MetaBountyFormState>(EMPTY_FORM);
  const [publishing, setPublishing] = useState(false);

  const updateForm = useCallback(
    (patch: Partial<MetaBountyFormState>) =>
      setMetaForm((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handleCardClick = (card: TypeCard) => {
    if (card.key === "meta-bounty") {
      if (!user?.id) {
        toast({ title: "Sign in to create a meta-bounty" });
        navigate("/login");
        return;
      }
      setMetaForm(EMPTY_FORM);
      setMetaStep(1);
      setMetaOpen(true);
      return;
    }
    if (card.route) navigate(card.route);
  };

  const handlePublishMeta = async () => {
    if (!user?.id) return;
    try {
      setPublishing(true);
      const { metaBountyId } = await createMetaBounty({
        authorId: user.id,
        title: metaForm.title.trim(),
        description: metaForm.description.trim() || null,
        themeTags: metaForm.themeTags,
        subBountyDefinitions: metaForm.subBounties.map((sb) => ({
          title: sb.title.trim(),
          description: sb.description.trim() || null,
          targetAmount: sb.targetReward,
          spawnThresholdPct: metaForm.spawnThreshold,
          acceptanceCriteria: sb.acceptanceCriteria || null,
        })),
        fundingDeadline: metaForm.fundingDeadline
          ? new Date(metaForm.fundingDeadline).toISOString()
          : null,
        contributionRules: null,
      });
      toast({ title: "Meta-bounty published" });
      setMetaOpen(false);
      navigate(`/content/${metaBountyId}`);
    } catch (e: any) {
      toast({
        title: "Failed to publish meta-bounty",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 920,
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <SeoHead
        title="Create — NeoScale AI"
        description="Choose a post type to start creating."
        path="/upload"
        noIndex
      />
      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          marginBottom: 28,
        }}
      >
        What are you creating?
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {CARDS.map((card) => (
          <TypeCardButton
            key={card.key}
            card={card}
            onClick={() => handleCardClick(card)}
          />
        ))}
      </div>

      <MetaBountyCreationFlow
        isOpen={metaOpen}
        onClose={() => setMetaOpen(false)}
        currentStep={metaStep}
        onStepChange={setMetaStep}
        formState={metaForm}
        onUpdateForm={updateForm}
        onPublish={handlePublishMeta}
        isPublishing={publishing}
      />
    </div>
  );
}

function TypeCardButton({
  card,
  onClick,
}: {
  card: TypeCard;
  onClick: () => void;
}) {
  const { Icon, label, description, color } = card;
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color + "4D";
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.transform = "scale(1)";
      }}
      style={{
        width: 280,
        height: 200,
        background: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 160ms ease, transform 160ms ease",
        color: "inherit",
      }}
    >
      <Icon size={32} color={color} strokeWidth={1.75} />
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </button>
  );
}
