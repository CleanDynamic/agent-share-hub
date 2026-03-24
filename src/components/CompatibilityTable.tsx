import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovedTools } from "@/hooks/useApprovedTools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, XCircle, Plus } from "lucide-react";

interface CompatEntry {
  id: string;
  tool_name: string;
  tool_version: string | null;
  status: string;
  verified_at: string;
  verified_by: string | null;
  notes: string | null;
}

const statusIcon = (s: string) => {
  if (s === "works") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (s === "partial") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
};

const statusLabel = (s: string) => {
  if (s === "works") return "Works";
  if (s === "partial") return "Partial";
  return "Broken";
};

export function CompatibilityTable({ contentId, creatorId }: { contentId: string; creatorId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tools } = useApprovedTools();
  const [showForm, setShowForm] = useState(false);
  const [toolName, setToolName] = useState("");
  const [toolVersion, setToolVersion] = useState("");
  const [status, setStatus] = useState("works");
  const [notes, setNotes] = useState("");

  const { data: entries } = useQuery({
    queryKey: ["tool_compatibility", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tool_compatibility" as any)
        .select("*")
        .eq("content_id", contentId)
        .order("verified_at", { ascending: false });
      return (data ?? []) as unknown as CompatEntry[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!user || !toolName) return;
      await (supabase.from("tool_compatibility" as any) as any).insert({
        content_id: contentId,
        tool_name: toolName,
        tool_version: toolVersion.trim() || null,
        status,
        verified_by: user.id,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool_compatibility", contentId] });
      setShowForm(false);
      setToolName("");
      setToolVersion("");
      setStatus("works");
      setNotes("");
    },
  });

  if (!entries || entries.length === 0) {
    if (!user) return null;
    return (
      <div className="mb-3">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Compatibility</h3>
        {!showForm ? (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add compatibility entry
          </Button>
        ) : (
          <CompatForm
            tools={tools}
            toolName={toolName} setToolName={setToolName}
            toolVersion={toolVersion} setToolVersion={setToolVersion}
            status={status} setStatus={setStatus}
            notes={notes} setNotes={setNotes}
            onSubmit={() => addEntry.mutate()}
            onCancel={() => setShowForm(false)}
            loading={addEntry.isPending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Compatibility</h3>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tool</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Version</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Verified</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-foreground">{e.tool_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.tool_version || "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    {statusIcon(e.status)} {statusLabel(e.status)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(e.verified_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{e.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {user && (
        <div className="mt-2">
          {!showForm ? (
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add entry
            </Button>
          ) : (
            <CompatForm
              tools={tools}
              toolName={toolName} setToolName={setToolName}
              toolVersion={toolVersion} setToolVersion={setToolVersion}
              status={status} setStatus={setStatus}
              notes={notes} setNotes={setNotes}
              onSubmit={() => addEntry.mutate()}
              onCancel={() => setShowForm(false)}
              loading={addEntry.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CompatForm({ tools, toolName, setToolName, toolVersion, setToolVersion, status, setStatus, notes, setNotes, onSubmit, onCancel, loading }: any) {
  return (
    <div className="space-y-2 p-3 border border-border rounded-xl bg-card mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Select value={toolName} onValueChange={setToolName}>
          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select tool" /></SelectTrigger>
          <SelectContent>
            {(tools ?? []).map((t: any) => (
              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={toolVersion} onChange={(e) => setToolVersion(e.target.value)} placeholder="Version (e.g. 4.0)" className="h-8 text-xs" />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="works">✅ Works</SelectItem>
          <SelectItem value="partial">⚠️ Partial</SelectItem>
          <SelectItem value="broken">❌ Broken</SelectItem>
        </SelectContent>
      </Select>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-xs" />
      <div className="flex gap-2">
        <Button size="sm" className="text-xs h-7" onClick={onSubmit} disabled={!toolName || loading}>Save</Button>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
