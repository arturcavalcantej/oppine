import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { useLanguageStore } from '@/contexts/languageStore';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/lib/i18n';
import { useState, useRef, useEffect } from 'react';
import { axiosClient } from '@/api/axiosClient';
import { useAuthStore } from '@/contexts/authStore';
import { cn } from '@/lib/utils';

const languageFlags: Record<SupportedLanguage, string> = {
  'pt-BR': '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
};

export default function LanguageSelector() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    setIsOpen(false);

    // If user is logged in, update backend
    if (user) {
      try {
        await axiosClient.patch('/auth/me', { language: newLanguage });
      } catch (error) {
        console.error('Failed to update language preference:', error);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-xl ring-1 ring-slate-900/5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
            {languageFlags[language]}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">{languageNames[language]}</p>
            <p className="text-xs text-slate-500">{t('settings.language')}</p>
          </div>
        </div>
        <Globe className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl ring-1 ring-slate-900/5 shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2">
            {supportedLanguages.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                  language === lang
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-900 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{languageFlags[lang]}</span>
                  <span>{languageNames[lang]}</span>
                </div>
                {language === lang && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
