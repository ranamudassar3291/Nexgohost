import { useState, type LucideIcon, type ComponentType } from "react";
import { useLocation } from "wouter";

export interface MasterTab {
  id: string;
  label: string;
  icon: LucideIcon;
  desc?: string;
  component: ComponentType<any>;
  badge?: string | number;
}

interface MasterPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tabs: MasterTab[];
  defaultTab?: string;
}

function readTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("tab");
}

export function MasterPage({ title, description, icon: PageIcon, tabs, defaultTab }: MasterPageProps) {
  const [, navigate] = useLocation();

  const initial = readTabFromUrl() || defaultTab || tabs[0]?.id;
  const [activeId, setActiveId] = useState<string>(initial ?? "");

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];
  const ActiveComponent = activeTab?.component;

  function switchTab(id: string) {
    setActiveId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState({}, "", url.toString());
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm shrink-0">
            <PageIcon size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
          {tabs.map(tab => {
            const isActive = tab.id === activeTab?.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`group flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 shrink-0 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon
                  size={15}
                  className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== "" && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
