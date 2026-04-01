const tabs = ["For You", "Following", "Trending", "Recent"]

interface FeedTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div className="flex items-center border-b border-white/5 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`relative px-6 py-4 text-sm font-medium transition-colors ${
              isActive ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab}
            {isActive && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#E8571A] rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
