import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UpgradeModalState {
  isOpen: boolean;
  reason: string | null;
  currentUsage: number | null;
  limit: number | null;
  tier: string | null;
}

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Selected business for dashboard context
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;

  // Upgrade Modal state
  upgradeModal: UpgradeModalState;
  openUpgradeModal: (params: {
    reason: string;
    currentUsage?: number;
    limit?: number;
    tier?: string;
  }) => void;
  closeUpgradeModal: () => void;
}

const defaultUpgradeModal: UpgradeModalState = {
  isOpen: false,
  reason: null,
  currentUsage: null,
  limit: null,
  tier: null,
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      selectedBusinessId: '',
      setSelectedBusinessId: (id) => set({ selectedBusinessId: id }),

      // Upgrade Modal
      upgradeModal: defaultUpgradeModal,
      openUpgradeModal: ({ reason, currentUsage, limit, tier }) =>
        set({
          upgradeModal: {
            isOpen: true,
            reason,
            currentUsage: currentUsage ?? null,
            limit: limit ?? null,
            tier: tier ?? null,
          },
        }),
      closeUpgradeModal: () =>
        set({
          upgradeModal: defaultUpgradeModal,
        }),
    }),
    {
      name: 'ui-storage',
      // Não persistir o estado do upgradeModal
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        selectedBusinessId: state.selectedBusinessId,
      }),
    }
  )
);
