import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SeoHead } from "@/components/SeoHead";
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
import { FollowButton } from "@/components/FollowButton";

function ProfileSkeleton() {
  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-48 rounded-md" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <div className="flex gap-6">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

const CreatorProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [subscribing, setSubscribing] = useState(false);

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
  const hasSubscriptionPriceId = !!(profile as any)?.subscription_price_id;
  const [followerDelta, setFollowerDelta] = useState(0);
  const followerCount = ((profile as any)?.follower_count ?? 0) + followerDelta;

  const [enquiryListing, setEnquiryListing] = useState<{ id: string; title: string } | null>(null);
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);

  const tipSuccess = searchParams.get("tip") === "success";
  const subscribedSuccess = searchParams.get("subscribed") === "success";
  if (tipSuccess || subscribedSuccess) {
    setTimeout(() => setSearchParams({}, { replace: true }), 0);
  }

  async function handleSubscribe() {
    if (!profile) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription-session", {
        body: {
          creator_id: profile.id,
          price_id: (profile as any).subscription_price_id,
          success_url: `${window.location.origin}/creator/${profile.username}?subscribed=success`,
          cancel_url: `${window.location.origin}/creator/${profile.username}`,
        },
      });
      if (error || !data?.url) {
        toast({ title: "Could not start subscription", description: "Please sign in and try again.", variant: "destructive" });
      } else { window.location.href = data.url; }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
    setSubscribing(false);
  }

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
      toast({ title: "Enquiry sent", description: `${displayName} will be in touch.` });
      setEnquiryListing(null);
    }
  }

  if (profileLoading) return <ProfileSkeleton />;

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

  const bioTruncated = (profile.bio || "").slice(0, 155);
  const itemCount = contentItems?.length ?? 0;
  const seoDesc = `${bioTruncated}${bioTruncated ? " — " : ""}${itemCount} item${itemCount !== 1 ? "s" : ""} published on NeoScale AI.`;
  const SITE_URL = import.meta.env.VITE_SITE_URL || "https://neoscale.ai";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": displayName,
    "description": profile.bio || "",
    "url": `${SITE_URL}/creator/${profile.username}`,
  };

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead
        title={`${displayName} on NeoScale AI`}
        description={seoDesc}
        path={`/creator/${profile.username}`}
        ogType="profile"
        jsonLd={jsonLd}
      />
      <div className="mx-auto max-w-5xl">
        {tipSuccess && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Thanks for supporting {displayName}.</p>
          </div>
        )}
        {subscribedSuccess && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">You are now subscribed to {displayName}. Exclusive content unlocked.</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="flex-1 min-w-0">
            <div className="mb-8 sm:mb-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{displayName}</h1>
                  {profile.is_creator && (
                    <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
                      <BadgeCheck className="h-3 w-3 mr-1" /> Verified Creator
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                <span className="text-xs text-muted-foreground">{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
              </div>
              {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed mb-4">{profile.bio}</p>}
              <div className="mb-4 sm:mb-6">
                <div className="w-full sm:w-auto">
                  <FollowButton creatorId={profile.id} onCountChange={(d) => setFollowerDelta((prev) => prev + d)} />
                </div>
              </div>
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

            {/* Mobile sidebar */}
            <div className="lg:hidden mb-8 space-y-4">
              {hasSubscriptionPriceId && (
                <div className="border border-border rounded-xl p-5 bg-card space-y-2">
                  <Button className="w-full min-h-[44px] bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={handleSubscribe} disabled={subscribing}>
                    {subscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                    Subscribe to {displayName}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">{subCount ?? 0} subscriber{subCount !== 1 ? "s" : ""}</p>
                </div>
              )}
              {hasDonationContent && (
                <div className="border border-border rounded-xl p-5 bg-card space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Support</p>
                  <TipSelector creatorId={profile.id} creatorDisplayName={displayName} successUrl={`${window.location.origin}/creator/${profile.username}?tip=success`} cancelUrl={`${window.location.origin}/creator/${profile.username}`} />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Content by {displayName}</h2>
              {contentItems && contentItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {contentItems.map((item) => (
                    <ContentCard key={item.id} id={item.id} content_type={item.content_type} title={item.title} description={item.description ?? ""} difficulty={item.difficulty} ai_tools={item.ai_tools ?? []} download_count={item.download_count} monetisation_type={item.monetisation_type} price_gbp={item.price_gbp ?? undefined} creator_username={profile.username ?? undefined} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">{displayName} hasn't published anything yet.</p>
              )}
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            {hasSubscriptionPriceId && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-2">
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={handleSubscribe} disabled={subscribing}>
                  {subscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                  Subscribe to {displayName}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">{subCount ?? 0} subscriber{subCount !== 1 ? "s" : ""}</p>
              </div>
            )}
            {hasDonationContent && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Support</p>
                <TipSelector creatorId={profile.id} creatorDisplayName={displayName} successUrl={`${window.location.origin}/creator/${profile.username}?tip=success`} cancelUrl={`${window.location.origin}/creator/${profile.username}`} />
              </div>
            )}
            {services && services.length > 0 && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Work with {displayName}</h3>
                {services.map((svc) => (
                  <div key={svc.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                    <p className="text-sm font-medium text-foreground">{svc.title}</p>
                    {svc.description && <p className="text-xs text-muted-foreground leading-relaxed">{svc.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">£{Number(svc.price_gbp ?? 0).toFixed(2)}</span>
                      <Button size="sm" variant="outline" className="text-xs h-7 border-secondary text-secondary hover:bg-secondary/10" onClick={() => setEnquiryListing({ id: svc.id, title: svc.title })}>
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

      <Dialog open={!!enquiryListing} onOpenChange={(open) => !open && setEnquiryListing(null)}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Work with {displayName}</DialogTitle>
            <DialogDescription>Send a commission enquiry for "{enquiryListing?.title}".</DialogDescription>
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
              <Textarea id="message" name="message" rows={4} required placeholder="Describe what you need and any relevant details" className="bg-background border-border rounded-xl" />
            </div>
            <Button type="submit" className="w-full" disabled={enquirySubmitting}>
              {enquirySubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Enquiry
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">Your message will be sent directly to {displayName}.</p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorProfile;
