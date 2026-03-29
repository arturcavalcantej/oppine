import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../lib/i18n';
import type { SupportedLanguage } from '../lib/i18n';

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  syncFromUser: (userLanguage: string | null | undefined) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: (i18n.language as SupportedLanguage) || 'pt-BR',

      setLanguage: (language: SupportedLanguage) => {
        i18n.changeLanguage(language);
        set({ language });
      },

      syncFromUser: (userLanguage: string | null | undefined) => {
        if (userLanguage && ['pt-BR', 'en', 'es'].includes(userLanguage)) {
          const lang = userLanguage as SupportedLanguage;
          if (get().language !== lang) {
            i18n.changeLanguage(lang);
            set({ language: lang });
          }
        }
      },
    }),
    {
      name: 'language-storage',
      onRehydrateStorage: () => (state) => {
        // Sync i18n with stored language on rehydrate
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
