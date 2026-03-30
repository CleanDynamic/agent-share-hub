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
    background: isActive ? "rgba(46,196,182,0.08)" : "transparent",
    borderLeft: isActive
      ? "2px solid #2EC4B6"
      : "2px solid transparent",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: isActive ? 600 : 300,
    color: isActive
      ? "#2EC4B6"
      : "rgba(255,255,255,0.45)",
    transition: "all 0.15s ease",
  });

  const countStyle = {
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
    fontWeight: 400 as const,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:block w-[200px] shrink-0"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 14,
          padding: "14px 8px",
        }}
      >
        <p
          className="mb-3 px-3"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.28)",
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
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.90)",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onEditSave(folder.id);
                    if (e.key === "Escape") onEditCancel();
                  }}
                />
                <button
                  onClick={() => onEditSave(folder.id)}
                  style={{ fontSize: 11, color: "#2EC4B6", fontWeight: 500 }}
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
                      background: "rgba(46,196,182,0.15)",
                      color: "#2EC4B6",
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
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDeleteRequest(folder.id)}
                  className="p-1 rounded transition-colors"
                  style={{ color: "rgba(255,255,255,0.28)" }}
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
                  style={{ color: "rgba(255,255,255,0.28)" }}
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
                  background: "rgba(16,16,24,0.95)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    onEditStart(folder.id, folder.name);
                    onMenuToggle(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 transition-colors"
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.90)" }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Rename folder
                </button>
                <button
                  onClick={() => {
                    onDeleteRequest(folder.id);
                    onMenuToggle(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 transition-colors"
                  style={{ fontSize: 13, color: "#EF4444" }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete folder
                </button>
                <div
                  className="my-1"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
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
                    style={{ color: "#2EC4B6" }}
                  />
                  <span style={{ color: "#2EC4B6" }}>
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
            color: "rgba(255,255,255,0.28)",
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
              ? "rgba(46,196,182,0.15)"
              : "rgba(255,255,255,0.04)",
            color: !activeFolder
              ? "#2EC4B6"
              : "rgba(255,255,255,0.45)",
            border: !activeFolder
              ? "1px solid rgba(46,196,182,0.3)"
              : "1px solid rgba(255,255,255,0.06)",
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
                ? "rgba(46,196,182,0.15)"
                : "rgba(255,255,255,0.04)",
            color:
              activeFolder === "root"
                ? "#2EC4B6"
                : "rgba(255,255,255,0.45)",
            border:
              activeFolder === "root"
                ? "1px solid rgba(46,196,182,0.3)"
                : "1px solid rgba(255,255,255,0.06)",
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
                  ? "rgba(46,196,182,0.15)"
                  : "rgba(255,255,255,0.04)",
              color:
                activeFolder === folder.id
                  ? "#2EC4B6"
                  : "rgba(255,255,255,0.45)",
              border:
                activeFolder === folder.id
                  ? "1px solid rgba(46,196,182,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
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
