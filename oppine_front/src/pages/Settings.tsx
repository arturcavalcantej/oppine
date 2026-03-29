import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Bell, CreditCard, Mail, Save, Loader2, CalendarDays, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/contexts/authStore';
import BillingTab from '@/components/features/settings/BillingTab';
import IntegrationsTab from '@/components/features/settings/IntegrationsTab';
import { axiosClient } from '@/api/axiosClient';

interface NotificationPreferences {
  notify_whatsapp: boolean;
  notify_email: boolean;
  notify_daily_summary: boolean;
  notify_promoters: boolean;
  notify_weekly_summary: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

type TabId = 'account' | 'notifications' | 'billing' | 'integrations';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'account', label: 'Minha Conta', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notificações', icon: <Bell className="w-4 h-4" /> },
  { id: 'billing', label: 'Plano', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrações', icon: <Link2 className="w-4 h-4" /> },
];

// ============================================================================
// Account Tab Component
// ============================================================================

function AccountTab() {
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name });
      toast.success('Perfil atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{user?.name || 'Usuário'}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              placeholder="Seu nome"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Mail className="w-4 h-4 inline mr-1.5" />
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              O email não pode ser alterado
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || name === user?.name}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </div>

      {/* Security Card */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Segurança</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Senha</p>
              <p className="text-xs text-slate-500 mt-0.5">Última alteração: não disponível</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast('Funcionalidade em desenvolvimento', { icon: '🔒' })}
            >
              Alterar Senha
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Notifications Tab Component
// ============================================================================

interface NotificationSetting {
  id: keyof NotificationPreferences;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    id: 'notify_whatsapp',
    label: 'Alertas via WhatsApp',
    description: 'Receber alertas de feedback negativo no WhatsApp',
  },
  {
    id: 'notify_email',
    label: 'Alertas via Email',
    description: 'Receber alertas de feedback negativo por email',
  },
  {
    id: 'notify_weekly_summary',
    label: 'Resumo Semanal',
    description: 'Receber resumo toda segunda com métricas da semana',
    icon: <CalendarDays className="w-4 h-4 text-primary" />,
  },
];

function NotificationsTab() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notify_whatsapp: true,
    notify_email: false,
    notify_daily_summary: true,
    notify_promoters: false,
    notify_weekly_summary: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrefs, setOriginalPrefs] = useState<NotificationPreferences | null>(null);

  // Load preferences from backend
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await axiosClient.get<NotificationPreferences>('/auth/me/notifications');
        setPreferences(response.data);
        setOriginalPrefs(response.data);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        toast.error('Erro ao carregar preferências');
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Track changes
  useEffect(() => {
    if (originalPrefs) {
      const changed = JSON.stringify(preferences) !== JSON.stringify(originalPrefs);
      setHasChanges(changed);
    }
  }, [preferences, originalPrefs]);

  const toggleSetting = (id: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axiosClient.patch<NotificationPreferences>(
        '/auth/me/notifications',
        preferences
      );
      setPreferences(response.data);
      setOriginalPrefs(response.data);
      setHasChanges(false);
      toast.success('Preferências salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Preferences */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Preferências de Alertas</h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure como deseja receber notificações</p>
        </div>

        <div className="divide-y divide-slate-100">
          {NOTIFICATION_SETTINGS.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="flex items-center gap-3">
                {setting.icon}
                <div>
                  <p className="text-sm font-medium text-slate-900">{setting.label}</p>
                  <p className="text-xs text-slate-500">{setting.description}</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting(setting.id)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                  preferences[setting.id] ? 'bg-primary' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                    preferences[setting.id] && 'translate-x-5'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Horário de Silêncio</h3>
          <p className="text-xs text-slate-500 mt-0.5">Não receber notificações durante um período específico</p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Ativar horário de silêncio</p>
              <p className="text-xs text-slate-500">Pausar notificações durante o período definido</p>
            </div>
            <button
              onClick={() => setPreferences(prev => ({
                ...prev,
                quiet_hours_enabled: !prev.quiet_hours_enabled
              }))}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                preferences.quiet_hours_enabled ? 'bg-primary' : 'bg-slate-200'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                  preferences.quiet_hours_enabled && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="flex gap-4 px-6 py-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Início
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quiet_hours_start: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fim
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quiet_hours_end: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Preferências
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export default function Settings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && tabs.some(t => t.id === tabParam) ? tabParam : 'account'
  );

  // Handle tab URL param (e.g. after Google OAuth redirect)
  useEffect(() => {
    if (tabParam && tabs.some(t => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === 'account' ? {} : { tab: tabId });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="pb-6 border-b border-slate-200 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie suas configurações.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-x-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-2xl">
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}
