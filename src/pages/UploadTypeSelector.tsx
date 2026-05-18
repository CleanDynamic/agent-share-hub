import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MetaBountyCreationFlow,
  type MetaBountyFormState,
} from "@/components/bounty-competition/MetaBountyCreationFlow";
import { createMetaBounty } from "@/lib/bounty-competition/createMetaBounty";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUploadPicker } from "@/contexts/UploadPickerContext";

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

/**
 * /upload route shell.
 *
 * - With no ?type param: opens the global UploadTypePicker modal automatically.
 *   (User dismiss → provider redirects to /.)
 * - With ?type=meta-bounty: opens the inline meta-bounty creation flow.
 * - Other ?type values are routed by the picker directly to /upload/{type}.
 */
export default function UploadTypeSelector() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { openUploadTypePicker } = useUploadPicker();
  const [params] = useSearchParams();
  const type = params.get("type");

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaStep, setMetaStep] = useState(1);
  const [metaForm, setMetaForm] = useState<MetaBountyFormState>(EMPTY_FORM);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (type === "meta-bounty") {
      if (!user?.id) {
        toast({ title: "Sign in to create a meta-bounty" });
        navigate("/login");
        return;
      }
      setMetaForm(EMPTY_FORM);
      setMetaStep(1);
      setMetaOpen(true);
    } else if (!type) {
      openUploadTypePicker();
    }
  }, [type, user?.id, navigate, toast, openUploadTypePicker]);

  const updateForm = useCallback(
    (patch: Partial<MetaBountyFormState>) =>
      setMetaForm((prev) => ({ ...prev, ...patch })),
    [],
  );

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
    <MetaBountyCreationFlow
      isOpen={metaOpen}
      onClose={() => {
        setMetaOpen(false);
        navigate("/", { replace: true });
      }}
      currentStep={metaStep}
      onStepChange={setMetaStep}
      formState={metaForm}
      onUpdateForm={updateForm}
      onPublish={handlePublishMeta}
      isPublishing={publishing}
    />
  );
}
