import { useState, ReactNode } from 'react';
import { useSwipeable } from 'react-swipeable';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

interface MobileTabViewProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function MobileTabView({ tabs, defaultTab }: MobileTabViewProps) {
  const [activeIndex, setActiveIndex] = useState(() => {
    if (defaultTab) {
      const index = tabs.findIndex((tab) => tab.id === defaultTab);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeIndex < tabs.length - 1) {
        setActiveIndex(activeIndex + 1);
      }
    },
    onSwipedRight: () => {
      if (activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    swipeDuration: 500,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Content Area */}
      <div
        {...handlers}
        className="flex-1 overflow-hidden relative"
      >
        <div
          className="flex h-full transition-transform duration-200 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="w-full h-full flex-shrink-0 overflow-y-auto"
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="bg-white border-t border-slate-200 shadow-lg"
        role="tablist"
      >
        <div className="grid grid-cols-3 h-14">
          {tabs.map((tab, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                  isActive
                    ? 'text-primary'
                    : 'text-slate-500 hover:text-slate-600'
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
                )}
                <span className={isActive ? 'text-primary' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
