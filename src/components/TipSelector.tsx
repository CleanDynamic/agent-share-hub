import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PRESET_AMOUNTS = [1, 3, 5];

interface TipSelectorProps {
  creatorId: string;
  creatorDisplayName: string;
  successUrl: string;
  cancelUrl: string;
}

export function TipSelector({ creatorId, creatorDisplayName, successUrl, cancelUrl }: TipSelectorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTip(amountGbp: number) {
    if (amountGbp < 1) {
      toast({ title: "Minimum tip is £1", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-donation-session", {
        body: {
          creator_id: creatorId,
          amount_pence: Math.round(amountGbp * 100),
          creator_display_name: creatorDisplayName,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      });
      if (error || !data?.url) {
        toast({ title: "Could not start tip", description: "Please try again.", variant: "destructive" });
      } else {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Heart className="mr-2 h-3.5 w-3.5" /> Tip the Creator
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Choose a tip amount</p>
      <div className="flex gap-2">
        {PRESET_AMOUNTS.map((amt) => (
          <Button
            key={amt}
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            disabled={loading}
            onClick={() => handleTip(amt)}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : `£${amt}`}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground">£</span>
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="Custom"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="h-8 text-xs bg-background border-border rounded-lg"
          />
        </div>
        <Button
          size="sm"
          className="text-xs"
          disabled={loading || !customAmount}
          onClick={() => handleTip(Number(customAmount))}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tip"}
        </Button>
      </div>
    </div>
  );
}
