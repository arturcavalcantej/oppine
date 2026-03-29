import { Logo } from '@/components/core/Logo';
import { useAuthStore } from '@/contexts/authStore';
import { useUIStore } from '@/contexts/uiStore';
import { useProjects } from '@/api/hooks/useProjects';
import { useBusinesses, Business } from '@/api/hooks/useBusinesses';
import { useProjectStats } from '@/api/hooks/useProjectStats';
import { Building2, ChevronDown, Check, Edit2, FileText, HelpCircle, LayoutGrid, LogOut, Menu, PanelLeft, Plus, Settings, Star, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDashboardStats } from '@/api/hooks/useFeedback';
import { cn } from '@/lib/utils';
import PricingModal from './PricingModal';
import BusinessFormModal from './BusinessFormModal';

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  const { user, logout } = useAuthStore();
  const { sidebarCollapsed: isCollapsed, toggleSidebar, selectedBusinessId, setSelectedBusinessId } = useUIStore();

  // Business data for selector
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id || '';
  const { data: businesses } = useBusinesses(projectId);

  // Plan tier detection
  const { data: projectStats } = useProjectStats(projectId);
  const planTier = projectStats?.subscription?.tier || 'starter';
  const canAddBusiness = planTier !== 'starter';

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isBusinessDropdownOpen, setIsBusinessDropdownOpen] = useState(false);
  const [isBusinessFormOpen, setIsBusinessFormOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const businessDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (businessDropdownRef.current && !businessDropdownRef.current.contains(event.target as Node)) {
        setIsBusinessDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-select first business if none selected or if stored ID no longer exists
  useEffect(() => {
    if (!businesses?.length) return;
    const isValid = selectedBusinessId && businesses.some(b => b.id === selectedBusinessId);
    if (!isValid) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, selectedBusinessId, setSelectedBusinessId]);

  const selectedBusiness = businesses?.find(b => b.id === selectedBusinessId);
  const selectedBusinessName = selectedBusiness?.name || t('nav.selectBusiness', 'Selecionar Negócio');

  // Average score for selected business
  const effectiveBusinessId = selectedBusinessId || businesses?.[0]?.id || '';
  const { data: bizStats } = useDashboardStats(effectiveBusinessId, 30);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEditBusiness = (biz: Business) => {
    setEditingBusiness(biz);
    setIsBusinessFormOpen(true);
    setIsBusinessDropdownOpen(false);
  };

  const handleAddBusiness = () => {
    setEditingBusiness(null);
    setIsBusinessFormOpen(true);
    setIsBusinessDropdownOpen(false);
  };

  const handleCloseBusinessForm = () => {
    setIsBusinessFormOpen(false);
    setEditingBusiness(null);
  };

  const handleBusinessCreated = (newBusiness: Business) => {
    setSelectedBusinessId(newBusiness.id);
  };

  const menuItems = [
    { name: t('nav.overview', 'Visão Geral'), key: 'Overview', href: '/dashboard', icon: LayoutGrid, tourId: 'menu-overview' },
    { name: t('nav.templates', 'Templates'), key: 'Templates', href: '/dashboard/templates', icon: FileText, tourId: 'menu-templates' },
  ];

  const tutorialItems = [
    { name: t('faq.title', 'Dúvidas Frequentes'), key: 'FAQ', href: '/dashboard/faq', icon: HelpCircle },
  ];

  const profileItems = [
    { name: t('nav.settings', 'Configurações'), key: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActiveRoute = (href: string) => {
    const isExactMatch = pathname === href;
    const isPathMatch = href !== '/dashboard' && pathname.startsWith(href + '/');
    return isExactMatch || isPathMatch;
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg lg:hidden ring-1 ring-slate-900/5"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen flex flex-col fixed left-0 top-0 z-40 transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ background: 'linear-gradient(180deg, #2E3A50 0%, #131834 100%)' }}
      >

        {/* Logo & Collapse Toggle */}
        <div className="h-14 flex items-center justify-between px-4 relative">
          <Link to="/dashboard" className="flex items-center">
            <Logo variant={isCollapsed ? 'icon' : 'full'} size="lg" inverted />
          </Link>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {/* Divider line */}
        <div className="mx-4 border-t border-white/10" />

        {/* Business Selector */}
        {businesses && businesses.length > 0 && (
          <div className="px-3 pt-3" ref={businessDropdownRef} data-tour="business-selector">
            {!isCollapsed ? (
              <div className="relative">
                <button
                  onClick={() => setIsBusinessDropdownOpen(!isBusinessDropdownOpen)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-[#547FFF]/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-[#A8ED8E]" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{selectedBusinessName}</p>
                    <div className="flex items-center gap-1.5">
                      {bizStats?.average_score != null && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          {bizStats.average_score.toFixed(1)}
                        </span>
                      )}
                      <span className="text-[10px] text-white/40">
                        {bizStats?.average_score != null ? '·' : ''} {t('nav.activeBusiness', 'Negócio Ativo')}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-white/50 transition-transform', isBusinessDropdownOpen && 'rotate-180')} />
                </button>

                {/* Dropdown */}
                {isBusinessDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-[#1E2A3E] ring-1 ring-white/10 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                    {businesses.map((biz) => (
                      <div
                        key={biz.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 transition-colors',
                          biz.id === selectedBusinessId
                            ? 'bg-[#A8ED8E]/10 text-[#A8ED8E]'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <button
                          onClick={() => {
                            setSelectedBusinessId(biz.id);
                            setIsBusinessDropdownOpen(false);
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm truncate flex-1">{biz.name}</span>
                          {biz.id === selectedBusinessId && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                        <button
                          onClick={() => handleEditBusiness(biz)}
                          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0"
                          title={t('common.edit', 'Editar')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add new business - Growth only */}
                    {canAddBusiness && (
                      <>
                        <div className="mx-2 my-1 border-t border-white/10" />
                        <button
                          onClick={handleAddBusiness}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Plus className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">{t('businesses.add', 'Adicionar Negócio')}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsBusinessDropdownOpen(!isBusinessDropdownOpen)}
                  title={selectedBusinessName}
                  className="w-10 h-10 bg-white/10 hover:bg-white/15 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Building2 className="w-5 h-5 text-[#A8ED8E]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 px-3 pt-3 flex flex-col">
          {/* MENU Section */}
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {t('nav.menu', 'Menu')}
            </p>
          )}
          <div className="space-y-1">
            {menuItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  data-tour={item.tourId}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isCollapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-[#A8ED8E] text-slate-800'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {!isCollapsed && item.name}
                </Link>
              );
            })}
          </div>

          {/* Divider line after MENU */}
          <div className="mx-1 mt-3 border-t border-white/10" />

          {/* Spacer to push TUTORIAL down */}
          <div className="flex-1" />

          {/* TUTORIAL Section */}
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {t('nav.tutorial', 'Tutorial')}
            </p>
          )}
          <div className="space-y-1">
            {tutorialItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isCollapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-[#A8ED8E] text-slate-800'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {!isCollapsed && item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* PERFIL Section */}
        <div className="p-3 border-t border-white/10">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {t('nav.profile', 'Perfil')}
            </p>
          )}

          {/* User Info */}
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.name || t('user.user')}</p>
                <p className="text-xs text-white/50 truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.[0] || 'U'}
              </div>
            </div>
          )}

          {/* Settings */}
          {profileItems.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all text-white/70 hover:bg-white/10 hover:text-white',
                isCollapsed ? 'justify-center' : 'gap-3'
              )}
            >
              <item.icon className="w-5 h-5" />
              {!isCollapsed && item.name}
            </Link>
          ))}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={isCollapsed ? t('auth.signOut') : undefined}
            className={cn(
              'w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300',
              isCollapsed ? 'justify-center' : 'gap-3'
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && t('auth.signOut', 'Sair')}
          </button>
        </div>

        {/* Pricing Modal */}
        <PricingModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
          projectId={user?.id || ''}
        />
      </aside>

      {/* Business Form Modal */}
      <BusinessFormModal
        isOpen={isBusinessFormOpen}
        onClose={handleCloseBusinessForm}
        business={editingBusiness}
        projectId={projectId}
        existingBusinessId={businesses?.[0]?.id}
        onCreated={handleBusinessCreated}
      />
    </>
  );
}
