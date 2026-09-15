import { Pencil, Trash2, MoreHorizontal, Share2, Plus, Folder, FolderOpen } from "lucide-react";

interface FolderData {
  id: string;
  name: string;
  emoji?: string | null;
  item_count?: number;
  published_collection_id?: string | null;
  position?: number;
}

interface LibrarySidebarProps {
  folders: FolderData[];
  activeFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  totalItemCount: number;
  unsortedCount: number;
  libraryItems: any[];
  // Editing
  editingId: string | null;
  editName: string;
  onEditStart: (folderId: string, name: string) => void;
  onEditNameChange: (name: string) => void;
  onEditSave: (folderId: string) => void;
  onEditCancel: () => void;
  // Delete
  onDeleteRequest: (folderId: string) => void;
  // Menu
  folderMenuOpenId: string | null;
  onMenuToggle: (folderId: string | null) => void;
  // Publish
  onPublishRequest: (folderId: string) => void;
  // New folder
  onNewFolder: () => void;
  // Toast
  onToast: (msg: string) => void;
}

export function LibrarySidebar({
  folders,
  activeFolder,
  onFolderSelect,
  totalItemCount,
  unsortedCount,
  libraryItems,
  editingId,
  editName,
  onEditStart,
  onEditNameChange,
  onEditSave,
  onEditCancel,
  onDeleteRequest,
  folderMenuOpenId,
  onMenuToggle,
  onPublishRequest,
  onNewFolder,
  onToast,
}: LibrarySidebarProps) {
  const sidebarItemStyle = (isActive: boolean) => ({
    background: isActive ? "color-mix(in srgb, var(--evidence) 8%, transparent)" : "transparent",
    borderLeft: isActive
      ? "2px solid var(--evidence)"
      : "2px solid transparent",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: isActive ? 600 : 300,
    color: isActive
      ? "var(--evidence)"
      : "var(--text2)",
    transition: "all 0.15s ease",
  });

  const countStyle = {
    fontSize: 11,
    color: "var(--text2)",
    fontWeight: 400 as const,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:block w-[200px] shrink-0"
        style={{
          background: "var(--glass-2)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "14px 8px",
        }}
      >
        <p
          className="mb-3 px-3"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text2)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Folders
        </p>

        <button
          onClick={() => onFolderSelect(null)}
          className="flex w-full items-center gap-2 transition-colors"
          style={sidebarItemStyle(!activeFolder)}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">All items</span>
          <span className="ml-auto" style={countStyle}>
            {totalItemCount}
          </span>
        </button>

        <button
          onClick={() => onFolderSelect("root")}
          className="flex w-full items-center gap-2 transition-colors"
          style={sidebarItemStyle(activeFolder === "root")}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Unsorted</span>
          <span className="ml-auto" style={countStyle}>
            {unsortedCount}
          </span>
        </button>

        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            {editingId === folder.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value.slice(0, 50))}
                  className="flex-1 h-7 rounded px-2 outline-none"
                  style={{
                    background: "var(--recess)",
                    border: "1px solid var(--line)",
                    fontSize: 12,
                    color: "var(--text)",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onEditSave(folder.id);
                    if (e.key === "Escape") onEditCancel();
                  }}
                />
                <button
                  onClick={() => onEditSave(folder.id)}
                  style={{ fontSize: 11, color: "var(--evidence)", fontWeight: 500 }}
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => onFolderSelect(folder.id)}
                className="flex w-full items-center gap-2 transition-colors"
                style={sidebarItemStyle(activeFolder === folder.id)}
              >
                {folder.emoji ? (
                  <span className="text-sm shrink-0">{folder.emoji}</span>
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{folder.name}</span>
                {folder.published_collection_id && (
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "color-mix(in srgb, var(--evidence) 15%, transparent)",
                      color: "var(--evidence)",
                    }}
                  >
                    Live
                  </span>
                )}
                <span className="ml-auto" style={countStyle}>
                  {folder.item_count ?? 0}
                </span>
              </button>
            )}

            {editingId !== folder.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                <button
                  onClick={() => onEditStart(folder.id, folder.name)}
                  className="p-1 rounded transition-colors"
                  style={{ color: "var(--text2)" }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDeleteRequest(folder.id)}
                  className="p-1 rounded transition-colors"
                  style={{ color: "var(--text2)" }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() =>
                    onMenuToggle(
                      folderMenuOpenId === folder.id ? null : folder.id
                    )
                  }
                  className="p-1 rounded transition-colors"
                  style={{ color: "var(--text2)" }}
                  title="More options"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Folder dropdown menu */}
            {folderMenuOpenId === folder.id && (
              <div
                className="absolute right-0 top-full z-20 mt-1 w-44 py-1"
                style={{
                  background: "var(--recess)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  boxShadow: "var(--elev-raised)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    onEditStart(folder.id, folder.name);
                    onMenuToggle(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 transition-colors"
                  style={{ fontSize: 13, color: "var(--text)" }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Rename folder
                </button>
                <button
                  onClick={() => {
                    onDeleteRequest(folder.id);
                    onMenuToggle(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 transition-colors"
                  style={{ fontSize: 13, color: "var(--cat-breakage)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete folder
                </button>
                <div
                  className="my-1"
                  style={{ borderTop: "1px solid var(--line)" }}
                />
                <button
                  onClick={() => {
                    const itemsInFolder =
                      libraryItems?.filter(
                        (l: any) => l.folder_id === folder.id
                      ) ?? [];
                    if (itemsInFolder.length < 2) {
                      onToast("Add at least 2 items to this folder first");
                      onMenuToggle(null);
                      return;
                    }
                    onPublishRequest(folder.id);
                    onMenuToggle(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 transition-colors"
                  style={{ fontSize: 13 }}
                >
                  <Share2
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--evidence)" }}
                  />
                  <span style={{ color: "var(--evidence)" }}>
                    {folder.published_collection_id
                      ? "Update Collection"
                      : "Publish as Collection"}
                  </span>
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={onNewFolder}
          className="flex items-center gap-1.5 px-3 py-2 mt-2 w-full transition-colors"
          style={{
            fontSize: 12,
            color: "var(--text2)",
            fontWeight: 400,
          }}
        >
          <Plus className="h-3 w-3" /> New folder
        </button>
      </div>

      {/* Mobile pill row */}
      <div
        className="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-4"
        style={{ scrollbarWidth: "none" }}
      >
        <button
          onClick={() => onFolderSelect(null)}
          className="px-3 py-1.5 rounded-full shrink-0 transition-all"
          style={{
            fontSize: 12,
            fontWeight: !activeFolder ? 600 : 400,
            background: !activeFolder
              ? "color-mix(in srgb, var(--evidence) 15%, transparent)"
              : "var(--recess)",
            color: !activeFolder
              ? "var(--evidence)"
              : "var(--text2)",
            border: !activeFolder
              ? "1px solid color-mix(in srgb, var(--evidence) 30%, transparent)"
              : "1px solid var(--line)",
          }}
        >
          All
        </button>
        <button
          onClick={() => onFolderSelect("root")}
          className="px-3 py-1.5 rounded-full shrink-0 transition-all"
          style={{
            fontSize: 12,
            fontWeight: activeFolder === "root" ? 600 : 400,
            background:
              activeFolder === "root"
                ? "color-mix(in srgb, var(--evidence) 15%, transparent)"
                : "var(--recess)",
            color:
              activeFolder === "root"
                ? "var(--evidence)"
                : "var(--text2)",
            border:
              activeFolder === "root"
                ? "1px solid color-mix(in srgb, var(--evidence) 30%, transparent)"
                : "1px solid var(--line)",
          }}
        >
          Unsorted
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onFolderSelect(folder.id)}
            className="px-3 py-1.5 rounded-full shrink-0 transition-all"
            style={{
              fontSize: 12,
              fontWeight: activeFolder === folder.id ? 600 : 400,
              background:
                activeFolder === folder.id
                  ? "color-mix(in srgb, var(--evidence) 15%, transparent)"
                  : "var(--recess)",
              color:
                activeFolder === folder.id
                  ? "var(--evidence)"
                  : "var(--text2)",
              border:
                activeFolder === folder.id
                  ? "1px solid color-mix(in srgb, var(--evidence) 30%, transparent)"
                  : "1px solid var(--line)",
            }}
          >
            {folder.emoji ? `${folder.emoji} ` : ""}
            {folder.name}
          </button>
        ))}
      </div>
    </>
  );
}
