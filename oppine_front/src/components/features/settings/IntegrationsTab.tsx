import { useState, useEffect } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Link2,
  Unlink,
  MapPin,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/api/hooks/useProjects';
import { useBusinesses } from '@/api/hooks/useBusinesses';
import {
  useGoogleConnection,
  useGoogleAuthUrl,
  useGoogleCallback,
  useDisconnectGoogle,
  useGoogleAccounts,
  useGoogleLocations,
  useGoogleLocationLink,
  useLinkGoogleLocation,
  useUnlinkGoogleLocation,
  useUpdateSyncFrequency,
  useSyncGoogleReviews,
} from '@/api/hooks/useGoogleIntegration';

// ============================================================================
// Google Connection Card
// ============================================================================

function GoogleConnectionCard() {
  const { data: connection, isLoading } = useGoogleConnection();
  const authUrlMutation = useGoogleAuthUrl();
  const callbackMutation = useGoogleCallback();
  const disconnectMutation = useDisconnectGoogle();
  const updateFrequency = useUpdateSyncFrequency();

  // Handle OAuth callback code in URL
  useEffect(() => {
    // Read code directly from URL (not React state) to avoid Strict Mode issues
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // Synchronously remove code from URL so Strict Mode remount won't re-use it
      params.delete('code');
      params.delete('state');
      params.delete('scope');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

      callbackMutation.mutate(code, {
        onSuccess: () => {
          toast.success('Google conectado com sucesso!');
        },
        onError: () => {
          toast.error('Erro ao conectar com o Google');
        },
      });
    }
  }, []);

  const handleConnect = async () => {
    try {
      const result = await authUrlMutation.mutateAsync();
      window.location.href = result.url;
    } catch {
      toast.error('Erro ao gerar URL de autenticação');
    }
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => toast.success('Google desconectado'),
      onError: () => toast.error('Erro ao desconectar'),
    });
  };

  const handleFrequencyChange = (freq: string) => {
    updateFrequency.mutate(freq, {
      onSuccess: () => toast.success('Frequência atualizada'),
      onError: () => toast.error('Erro ao atualizar frequência'),
    });
  };

  if (isLoading || callbackMutation.isPending) {
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Google Meu Negócio</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Google Meu Negócio</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sincronize avaliações do Google para medir conversões de promotores
            </p>
          </div>
          {connection?.connected && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" />
              Conectado
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {!connection?.connected ? (
          /* Not connected state */
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Link2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Conecte sua conta Google para sincronizar avaliações
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Saiba quais promotores do Oppine realmente avaliaram no Google
            </p>
            <Button
              onClick={handleConnect}
              disabled={authUrlMutation.isPending}
            >
              {authUrlMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Conectar Google
            </Button>
          </div>
        ) : (
          /* Connected state */
          <div className="space-y-5">
            {/* Connection info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{connection.google_email}</p>
                  {connection.last_synced_at && (
                    <p className="text-xs text-slate-500">
                      Última sincronização: {new Date(connection.last_synced_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Desconectar
              </Button>
            </div>

            {/* Connection error */}
            {connection.connection_error && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-700">Erro na conexão</p>
                  <p className="text-xs text-amber-600 mt-0.5">{connection.connection_error}</p>
                </div>
              </div>
            )}

            {/* Sync frequency */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Frequência de sincronização</p>
                  <p className="text-xs text-slate-500">Com que frequência verificar novas avaliações</p>
                </div>
              </div>
              <select
                value={connection.sync_frequency || '6h'}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                disabled={updateFrequency.isPending}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="1h">A cada 1 hora</option>
                <option value="6h">A cada 6 horas</option>
                <option value="12h">A cada 12 horas</option>
                <option value="24h">A cada 24 horas</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Location Linking Section
// ============================================================================

function LocationLinkingSection() {
  const { data: connection } = useGoogleConnection();
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id || '';
  const { data: businesses } = useBusinesses(projectId);
  const { data: accounts, error: accountsError } = useGoogleAccounts(!!connection?.connected);

  if (!connection?.connected || !businesses?.length) return null;

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Vincular Locais do Google</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Associe cada negócio ao seu perfil no Google Meu Negócio
        </p>
      </div>

      {accountsError && (accountsError as any)?.response?.status === 429 && (
        <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-700">Cota da API excedida</p>
            <p className="text-xs text-amber-600 mt-0.5">
              A cota de requisições da API Google My Business está em 0. Acesse o Google Cloud Console
              &gt; APIs e Serviços &gt; My Business Account Management API &gt; Cotas e aumente
              "Requests per minute".
            </p>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {businesses.map((business) => (
          <BusinessLocationRow
            key={business.id}
            businessId={business.id}
            businessName={business.name}
            accounts={accounts || []}
          />
        ))}
      </div>
    </div>
  );
}

function BusinessLocationRow({
  businessId,
  businessName,
  accounts,
}: {
  businessId: string;
  businessName: string;
  accounts: { id: string; name: string }[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  const { data: link, isLoading: loadingLink } = useGoogleLocationLink(businessId);
  const { data: locations } = useGoogleLocations(selectedAccountId);
  const linkMutation = useLinkGoogleLocation();
  const unlinkMutation = useUnlinkGoogleLocation();
  const syncMutation = useSyncGoogleReviews();

  const handleLink = () => {
    if (!selectedAccountId || !selectedLocationId) return;
    const location = locations?.find(l => l.id === selectedLocationId);
    linkMutation.mutate(
      {
        businessId,
        googleAccountId: selectedAccountId,
        googleLocationId: selectedLocationId,
        googleLocationName: location?.name,
      },
      {
        onSuccess: () => toast.success(`${businessName} vinculado!`),
        onError: () => toast.error('Erro ao vincular'),
      }
    );
  };

  const handleUnlink = () => {
    unlinkMutation.mutate(businessId, {
      onSuccess: () => toast.success('Vínculo removido'),
      onError: () => toast.error('Erro ao remover vínculo'),
    });
  };

  const handleSync = () => {
    syncMutation.mutate(businessId, {
      onSuccess: (data) => {
        if (data.error) {
          toast.error(`Erro: ${data.error}`);
        } else {
          toast.success(`Sincronizado! ${data.new || 0} novas avaliações, ${data.matched || 0} matches`);
        }
      },
      onError: () => toast.error('Erro ao sincronizar'),
    });
  };

  if (loadingLink) {
    return (
      <div className="px-6 py-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">{businessName}</span>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-900">{businessName}</span>
        </div>
        {link?.linked && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
              Sincronizar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {link?.linked ? (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          Vinculado a: {link.google_location_name || link.google_location_id}
        </p>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedLocationId('');
            }}
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Selecionar conta</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          {selectedAccountId && (
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Selecionar local</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            onClick={handleLink}
            disabled={!selectedAccountId || !selectedLocationId || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main IntegrationsTab
// ============================================================================

export default function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <GoogleConnectionCard />
      <LocationLinkingSection />
    </div>
  );
}
