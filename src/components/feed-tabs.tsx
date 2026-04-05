const tabs = [
  { label: "For You", value: "For You" },
  { label: "Following", value: "Following" },
  { label: "Trending", value: "Trending" },
  { label: "Recent", value: "Recent" },
  { label: "🎯 Bounties", value: "Bounties" },
]

interface FeedTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div className="flex items-center border-b border-white/5 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`relative px-6 py-4 text-sm font-medium transition-colors ${
              isActive ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.label}
            {isActive && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#E8571A] rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
