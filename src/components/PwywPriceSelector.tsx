import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  contentId: string;
  floorGbp: number;
  avgPaid: number;
  purchaseCount: number;
}

export function PwywPriceSelector({ contentId, floorGbp, avgPaid, purchaseCount }: Props) {
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const minAmount = Math.max(floorGbp, 1);
  const [amount, setAmount] = useState(String(minAmount.toFixed(2)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock() {
    const val = parseFloat(amount);
    if (isNaN(val) || val < minAmount) {
      setError(`Minimum is £${minAmount.toFixed(2)}`);
      return;
    }
    setError("");

    if (!isLoggedIn) {
      window.location.href = "/signup";
      return;
    }

    setLoading(true);
    try {
      const pence = Math.round(val * 100);
      const { data, error: fnErr } = await supabase.functions.invoke("create-pwyw-checkout-session", {
        body: {
          content_id: contentId,
          buyer_amount_pence: pence,
          success_url: `${window.location.origin}/content/${contentId}?payment=success`,
          cancel_url: `${window.location.origin}/content/${contentId}`,
        },
      });
      if (fnErr || !data?.url) {
        toast({ title: "Checkout failed", description: "Could not start payment.", variant: "destructive" });
      } else {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Checkout failed", description: "Something went wrong.", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">You pay: £</span>
        <Input
          type="number"
          step="0.01"
          min={minAmount}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(""); }}
          className="w-24 h-9 text-sm bg-background border-border"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {purchaseCount > 0
          ? `avg. £${avgPaid.toFixed(2)} · ${purchaseCount} ${purchaseCount === 1 ? "person has" : "people have"} paid for this`
          : "Be the first to pay"}
      </p>
      {floorGbp > 0 && <p className="text-xs text-muted-foreground">Minimum: £{floorGbp.toFixed(2)}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="lg" className="w-full" onClick={handleUnlock} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        Unlock
      </Button>
    </div>
  );
}
