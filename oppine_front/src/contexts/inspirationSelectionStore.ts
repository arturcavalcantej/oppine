import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SelectedInspiration {
  id: string;
  owner_username?: string;
}

interface InspirationSelectionState {
  // State
  selectedInspirations: Record<string, SelectedInspiration>;
  projectId: string | null;
  selectionMode: boolean;

  // Actions
  toggleInspiration: (inspiration: SelectedInspiration) => void;
  isSelected: (id: string) => boolean;
  clearSelection: () => void;
  setProjectId: (id: string) => void;
  setSelectionMode: (mode: boolean) => void;
  getSelectedCount: () => number;
  getFirstSelected: () => SelectedInspiration | undefined;
  getSelectedIds: () => string[];
}

export const useInspirationSelectionStore = create<InspirationSelectionState>()(
  persist(
    (set, get) => ({
      selectedInspirations: {},
      projectId: null,
      selectionMode: false,

      toggleInspiration: (inspiration) => {
        set((state) => {
          const newSelected = { ...state.selectedInspirations };
          if (newSelected[inspiration.id]) {
            delete newSelected[inspiration.id];
          } else {
            newSelected[inspiration.id] = inspiration;
          }

          // Auto-enable selection mode when first item is selected
          const hasSelection = Object.keys(newSelected).length > 0;

          return {
            selectedInspirations: newSelected,
            selectionMode: hasSelection ? true : state.selectionMode
          };
        });
      },

      isSelected: (id) => {
        return !!get().selectedInspirations[id];
      },

      clearSelection: () => {
        set({ selectedInspirations: {}, selectionMode: false });
      },

      setProjectId: (id) => {
        const currentProjectId = get().projectId;
        if (currentProjectId !== id) {
          // Clear selection when project changes
          set({ projectId: id, selectedInspirations: {}, selectionMode: false });
        }
      },

      setSelectionMode: (mode) => {
        set({ selectionMode: mode });
        // If turning off selection mode, also clear selections
        if (!mode) {
          set({ selectedInspirations: {} });
        }
      },

      getSelectedCount: () => {
        return Object.keys(get().selectedInspirations).length;
      },

      getFirstSelected: () => {
        const selected = get().selectedInspirations;
        const ids = Object.keys(selected);
        return ids.length > 0 ? selected[ids[0]] : undefined;
      },

      getSelectedIds: () => {
        return Object.keys(get().selectedInspirations);
      },
    }),
    {
      name: 'inspiration-selection',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
