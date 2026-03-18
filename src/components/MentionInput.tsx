import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";

interface MentionResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}

export function MentionInput({ value, onChange, placeholder, maxLength, rows = 3, className = "" }: Props) {
  const [results, setResults] = useState<MentionResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchProfiles = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); setShowDropdown(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(5);
    const filtered = (data ?? []).filter((p) => p.username) as MentionResult[];
    setResults(filtered);
    setShowDropdown(filtered.length > 0);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    let newVal = e.target.value;
    if (maxLength && newVal.length > maxLength) newVal = newVal.slice(0, maxLength);
    onChange(newVal);

    // Detect @mention
    const cursor = e.target.selectionStart ?? newVal.length;
    const textBeforeCursor = newVal.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setMentionQuery(atMatch[1]);
      if (atMatch[1].length >= 2) {
        searchProfiles(atMatch[1]);
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
      setMentionStart(-1);
    }
  }

  function selectUser(user: MentionResult) {
    if (mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const after = value.slice(cursor);
    const inserted = `@${user.username} `;
    const newValue = before + inserted + after;
    onChange(maxLength ? newValue.slice(0, maxLength) : newValue);
    setShowDropdown(false);
    setMentionStart(-1);

    // Refocus
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + inserted.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={`bg-background border-border rounded-xl text-sm resize-none ${className}`}
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 border border-border rounded-lg bg-card shadow-lg max-h-48 overflow-y-auto"
        >
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (user.display_name || user.username || "?")[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{user.display_name || user.username}</p>
                <p className="text-[10px] text-muted-foreground">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
