"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Repeat2 } from "lucide-react";
import { getReblogsOfPost } from "@/lib/reblog/getReblogsOfPost";

interface ReblogsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export function ReblogsListModal({ isOpen, onClose, postId }: ReblogsListModalProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getReblogsOfPost({ postId, limit: 50 })
      .then((r: any) => setItems(Array.isArray(r) ? r : (r?.reblogs ?? [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen, postId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-[#0F0F18] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Repeat2 size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Reblogs</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] text-white/60"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 text-center text-sm text-white/50">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/50">No reblogs yet.</div>
          ) : (
            <ul>
              {items.map((r) => {
                const u = r.reblogger ?? {};
                return (
                  <li
                    key={r.id}
                    className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => {
                      navigate(`/b/${r.slug}`);
                      onClose();
                    }}
                  >
                    <div className="flex gap-3">
                      <img
                        src={u.avatar_url || ""}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover bg-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold text-white truncate">
                            {u.display_name || u.username || "Unknown"}
                          </span>
                          <span className="text-xs text-white/50 truncate">
                            @{u.username || "unknown"}
                          </span>
                        </div>
                        {r.text && (
                          <p className="text-sm text-white/80 mt-0.5 line-clamp-2">
                            {r.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
