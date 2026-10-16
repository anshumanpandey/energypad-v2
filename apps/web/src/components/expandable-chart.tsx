'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export function ExpandableChart({
  title,
  expanded,
  hidden,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  hidden: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`waste-expandable-chart${expanded ? ' is-expanded' : ''}`} hidden={hidden}>
      <button
        type="button"
        className="waste-chart-expand"
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title} chart`}
        aria-expanded={expanded}
        title={expanded ? 'Restore all charts' : 'Expand chart'}
        onClick={onToggle}
      >
        {expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
      </button>
      {children}
    </div>
  );
}

const ExpansionContext = createContext<{
  expanded: string | null;
  toggle: (title: string) => void;
} | null>(null);

export function ChartExpansionGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <ExpansionContext.Provider
      value={
        enabled
          ? {
              expanded,
              toggle: (title) => setExpanded((current) => (current === title ? null : title)),
            }
          : null
      }
    >
      {children}
    </ExpansionContext.Provider>
  );
}

export function GroupedExpandableChart({ title, children }: { title: string; children: ReactNode }) {
  const group = useContext(ExpansionContext);
  if (!group) return children;
  return (
    <ExpandableChart
      title={title}
      expanded={group.expanded === title}
      hidden={group.expanded !== null && group.expanded !== title}
      onToggle={() => group.toggle(title)}
    >
      {children}
    </ExpandableChart>
  );
}
