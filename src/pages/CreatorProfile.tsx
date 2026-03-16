import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { BadgeCheck, Download, FileText, Heart, Users, Loader2, CheckCircle2 } from "lucide-react";
import { TipSelector } from "@/components/TipSelector";

const CreatorProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();

  // Fetch profile
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["creator_profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!username,
  });

  // Fetch approved content
  const { data: contentItems } = useQuery({
    queryKey: ["creator_content", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("creator_id", profile!.id)
        .eq("status", "approved")
        .order("download_count", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch service listings
  const { data: services } = useQuery({
    queryKey: ["creator_services", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_listings")
        .select("*")
        .eq("creator_id", profile!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Subscriber count
  const { data: subCount } = useQuery({
    queryKey: ["creator_sub_count", profile?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", profile!.id)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!profile?.id,
  });

  const totalDownloads = contentItems?.reduce((sum, item) => sum + item.download_count, 0) ?? 0;
  const hasDonationContent = contentItems?.some((item) => item.donation_enabled) ?? false;
  const hasSubscriptionContent = contentItems?.some((item) => item.monetisation_type === "subscription") ?? false;

  // Enquiry modal state
  const [enquiryListing, setEnquiryListing] = useState<{ id: string; title: string } | null>(null);
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);

  async function handleEnquiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enquiryListing) return;
    setEnquirySubmitting(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("service_enquiries").insert({
      listing_id: enquiryListing.id,
      requester_name: fd.get("name") as string,
      requester_email: fd.get("email") as string,
      message: fd.get("message") as string,
    });
    setEnquirySubmitting(false);
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Enquiry sent", description: "The creator will be in touch." });
      setEnquiryListing(null);
    }
  }

  // Loading
  if (profileLoading) {
    return (
      <div className="py-16 px-6 mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  // Not found
  if (!profile || profileError) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Creator not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse">Back to Browse</Link>
        </Button>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username || "Creator";

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        {/* Layout: header + sidebar */}
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main column */}
          <div className="flex-1 min-w-0">
            {/* Profile header */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
                {profile.is_creator && (
                  <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
                    <BadgeCheck className="h-3 w-3 mr-1" /> Verified Creator
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{profile.bio}</p>
              )}

              <div className="flex gap-6">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{contentItems?.length ?? 0}</span>
                  <span className="text-muted-foreground">published</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{totalDownloads.toLocaleString()}</span>
                  <span className="text-muted-foreground">downloads</span>
                </div>
              </div>
            </div>

            {/* Content grid */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Content by {displayName}</h2>
              {contentItems && contentItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {contentItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      id={item.id}
                      content_type={item.content_type}
                      title={item.title}
                      description={item.description ?? ""}
                      difficulty={item.difficulty}
                      ai_tools={item.ai_tools ?? []}
                      download_count={item.download_count}
                      monetisation_type={item.monetisation_type}
                      price_gbp={item.price_gbp ?? undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  Nothing published yet. Check back soon.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            {/* Tip */}
            {hasDonationContent && (
              <div className="border border-border rounded-xl p-5 bg-card">
                <Button className="w-full" asChild>
                  <a href="https://placeholder-stripe-tip.example.com" target="_blank" rel="noopener noreferrer">
                    <Heart className="mr-2 h-4 w-4" /> Support {displayName}
                  </a>
                </Button>
              </div>
            )}

            {/* Subscribe */}
            {hasSubscriptionContent && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-2">
                <Button
                  className="w-full border-secondary text-secondary hover:bg-secondary/10"
                  variant="outline"
                  asChild
                >
                  <a href="https://placeholder-stripe-sub.example.com" target="_blank" rel="noopener noreferrer">
                    <Users className="mr-2 h-4 w-4" /> Subscribe to {displayName}
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  {subCount ?? 0} subscriber{subCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Service listings */}
            {services && services.length > 0 && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Work with {displayName}</h3>
                {services.map((svc) => (
                  <div key={svc.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                    <p className="text-sm font-medium text-foreground">{svc.title}</p>
                    {svc.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{svc.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        £{Number(svc.price_gbp ?? 0).toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-secondary text-secondary hover:bg-secondary/10"
                        onClick={() => setEnquiryListing({ id: svc.id, title: svc.title })}
                      >
                        Enquire
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enquiry modal */}
      <Dialog open={!!enquiryListing} onOpenChange={(open) => !open && setEnquiryListing(null)}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enquire about {enquiryListing?.title}</DialogTitle>
            <DialogDescription>Send a message to {displayName}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEnquiry} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required className="bg-background border-border rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Your email</Label>
              <Input id="email" name="email" type="email" required className="bg-background border-border rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" rows={4} required className="bg-background border-border rounded-xl" />
            </div>
            <Button type="submit" className="w-full" disabled={enquirySubmitting}>
              {enquirySubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Enquiry
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorProfile;
