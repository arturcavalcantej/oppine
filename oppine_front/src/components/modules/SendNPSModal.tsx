import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import {
  Send,
  X,
  Loader2,
  UserPlus,
  FileSpreadsheet,
  Upload,
  Download,
  Copy,
  Check,
  Webhook,
  RefreshCw,
  Play,
  Code,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useWebhookInfo, useRegenerateWebhookToken, useTestWebhookPayload } from '@/api/hooks/useBusinesses';
import { useCreateBulkFeedbackRequests } from '@/api/hooks/useFeedback';

interface SendNPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

interface CSVCustomer {
  name?: string;
  phone: string;
}

export default function SendNPSModal({ isOpen, onClose, businessId, businessName }: SendNPSModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'qrcode' | 'webhook'>('manual');
  const [csvData, setCsvData] = useState<CSVCustomer[]>([]);
  const [fileName, setFileName] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  // Manual entry state
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualSending, setManualSending] = useState(false);
  const [testPayload, setTestPayload] = useState<string>(
    JSON.stringify(
      {
        customer: {
          phone: '11999999999',
          name: 'Cliente Teste',
        },
        metadata: {
          order_id: '12345',
        },
      },
      null,
      2
    )
  );
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    log: string[];
  } | null>(null);

  const createBulkRequest = useCreateBulkFeedbackRequests();
  const { data: webhookInfo, isLoading: webhookLoading } = useWebhookInfo(businessId);
  const regenerateMutation = useRegenerateWebhookToken();
  const testMutation = useTestWebhookPayload();

  // Generate the public feedback link for this business
  const feedbackLink = `${window.location.origin}/feedback/${businessId}`;

  // Generate QR Code URL using Google Charts API (simple solution)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(feedbackLink)}`;

  // Helper function to extract customer from row data
  const extractCustomerFromParts = (parts: string[]): CSVCustomer | null => {
    let phone = '';
    let name = '';

    for (const part of parts) {
      if (!part) continue;
      const partStr = String(part).trim();
      const numbers = partStr.replace(/\D/g, '');

      // Phone: 10-13 digits (supports 8296155749, 82996155749, 5582996155749)
      if (numbers.length >= 10 && numbers.length <= 13 && !phone) {
        phone = numbers.startsWith('55') ? `+${numbers}` : `+55${numbers}`;
      } else if (partStr && !name && numbers.length < 10) {
        // Name: text that is not a phone number
        name = partStr;
      }
    }

    return phone ? { name: name || undefined, phone } : null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (event) => {
      const customers: CSVCustomer[] = [];

      if (isExcel) {
        // Parse Excel file
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

        // Skip header row if it looks like headers
        const firstRow = jsonData[0] as unknown[];
        const hasHeader = firstRow?.some(cell =>
          String(cell).toLowerCase().includes('nome') ||
          String(cell).toLowerCase().includes('telefone') ||
          String(cell).toLowerCase().includes('phone')
        );
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (!row || row.length === 0) continue;

          const customer = extractCustomerFromParts(row.map(cell => String(cell ?? '')));
          if (customer) {
            customers.push(customer);
          }
        }
      } else {
        // Parse CSV/TXT file
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        // Skip header if present
        const startIndex = lines[0]?.toLowerCase().includes('nome') ||
                          lines[0]?.toLowerCase().includes('telefone') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(/[,;|\t]/).map(p => p.trim().replace(/"/g, ''));
          const customer = extractCustomerFromParts(parts);
          if (customer) {
            customers.push(customer);
          }
        }
      }

      setCsvData(customers);

      if (customers.length === 0) {
        toast.error(t('nps.noValidContacts', 'Nenhum contato válido encontrado. Verifique se há números de telefone com 10-11 dígitos.'));
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleSendBulk = async () => {
    if (csvData.length === 0) {
      toast.error(t('nps.noCustomers', 'Nenhum cliente para enviar'));
      return;
    }

    try {
      const result = await createBulkRequest.mutateAsync({
        business_id: businessId,
        customers: csvData.map(c => ({ name: c.name, phone: c.phone })),
        send_immediately: true,
      });
      toast.success(t('nps.bulkSent', `${result.created} pesquisas enviadas com sucesso!`));
      setCsvData([]);
      setFileName('');
      onClose();
    } catch {
      toast.error(t('nps.sendError', 'Erro ao enviar pesquisas. Tente novamente.'));
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(feedbackLink);
    setCopied(true);
    toast.success(t('nps.linkCopied', 'Link copiado!'));
    setTimeout(() => setCopied(false), 2000);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(t('webhook.copied', 'Copiado!'));
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync(businessId);
      toast.success(t('webhook.regenerated', 'Token regenerado com sucesso!'));
      setShowRegenConfirm(false);
    } catch {
      toast.error(t('common.error', 'Erro ao regenerar token'));
    }
  };

  const handleTestWebhook = async () => {
    try {
      const payload = JSON.parse(testPayload);
      const result = await testMutation.mutateAsync({
        webhookToken: webhookInfo!.webhook_token,
        payload,
      });
      setTestResult({
        success: result.success,
        message: result.message,
        log: result.extraction_log,
      });
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error(t('webhook.invalidJson', 'JSON inválido'));
      } else {
        toast.error(t('common.error', 'Erro ao testar payload'));
      }
    }
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode-${businessName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.click();
  };

  const downloadTemplate = () => {
    const csvContent = 'Nome,Telefone\nJoão Silva,(11) 99999-9999\nMaria Santos,(21) 88888-8888';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo-clientes.csv';
    link.click();
  };

  // Manual phone formatting
  const formatManualPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleManualPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualPhone(formatManualPhone(e.target.value));
  };

  const handleManualSend = async () => {
    const phone = manualPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error(t('nps.invalidPhone', 'Telefone inválido'));
      return;
    }

    setManualSending(true);
    try {
      const formattedPhone = phone.startsWith('55') ? `+${phone}` : `+55${phone}`;
      await createBulkRequest.mutateAsync({
        business_id: businessId,
        customers: [{ name: manualName || undefined, phone: formattedPhone }],
        send_immediately: true,
      });
      toast.success(t('nps.manualSent', 'Pesquisa enviada com sucesso!'));
      setManualPhone('');
      setManualName('');
    } catch {
      toast.error(t('nps.sendError', 'Erro ao enviar pesquisa. Tente novamente.'));
    } finally {
      setManualSending(false);
    }
  };

  // Suppress unused variable warnings for features temporarily hidden
  void copied;
  void handleCopyLink;
  void handleDownloadQR;

  if (!isOpen) return null;

  const tabItems = [
    { id: 'manual' as const, label: t('nps.manual', 'Manual'), icon: UserPlus },
    { id: 'csv' as const, label: t('nps.csvUpload', 'Planilha'), icon: FileSpreadsheet },
    { id: 'webhook' as const, label: t('nps.webhook', 'Webhook'), icon: Webhook },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {t('nps.collectTitle', 'Coletar Feedbacks')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('nps.collectSubtitle', 'Escolha como enviar pesquisas NPS')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Underline Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-x-4 px-6" aria-label="Tabs">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'manual' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('nps.customerPhone', 'WhatsApp do Cliente')}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={handleManualPhoneChange}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('nps.customerName', 'Nome do Cliente')}
                  <span className="text-slate-400 font-normal ml-1">({t('common.optional', 'opcional')})</span>
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={t('nps.customerNamePlaceholder', 'Ex: João Silva')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>
              <Button
                onClick={handleManualSend}
                disabled={manualSending || !manualPhone}
                className="w-full"
              >
                {manualSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t('nps.sendSurvey', 'Enviar Pesquisa')}
              </Button>
            </div>
          ) : activeTab === 'webhook' ? (
            <div className="space-y-5">
              {webhookLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
              ) : webhookInfo ? (
                <>
                  {/* Webhook URL */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t('webhook.url', 'URL do Webhook')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700 truncate">
                        {webhookInfo.webhook_url}
                      </div>
                      <Button
                        size="icon"
                        onClick={() => copyToClipboard(webhookInfo.webhook_url, 'url')}
                      >
                        {copiedField === 'url' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      {t(
                        'webhook.urlHelp',
                        'Configure seu sistema (POS, CRM, e-commerce) para enviar dados para esta URL via POST'
                      )}
                    </p>
                  </div>

                  {/* Supported Formats */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2 text-xs">
                      <Code className="w-3.5 h-3.5" />
                      {t('webhook.supportedFormats', 'Formatos Suportados')}
                    </h4>
                    <ul className="text-[11px] text-blue-800 space-y-1">
                      <li>
                        <code className="bg-blue-100 px-1 rounded">phone</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">telefone</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">celular</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">whatsapp</code>
                      </li>
                      <li>
                        <code className="bg-blue-100 px-1 rounded">name</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">nome</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">customer.name</code>
                      </li>
                      <li>
                        {t(
                          'webhook.nestedSupport',
                          'Suporta campos aninhados: customer.phone, cliente.celular, etc.'
                        )}
                      </li>
                    </ul>
                  </div>

                  {/* Test Section */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2 text-xs">
                      <Play className="w-3.5 h-3.5" />
                      {t('webhook.testPayload', 'Testar Payload')}
                    </h4>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      rows={5}
                      placeholder='{"phone": "11999999999", "name": "João"}'
                    />
                    <Button
                      size="sm"
                      onClick={handleTestWebhook}
                      disabled={testMutation.isPending}
                      className="mt-2"
                    >
                      {testMutation.isPending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {t('webhook.test', 'Testar')}
                    </Button>

                    {/* Test Result */}
                    {testResult && (
                      <div
                        className={cn(
                          'mt-3 p-3 rounded-lg',
                          testResult.success
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {testResult.success ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          )}
                          <span
                            className={cn(
                              'font-medium text-xs',
                              testResult.success ? 'text-green-800' : 'text-red-800'
                            )}
                          >
                            {testResult.message}
                          </span>
                        </div>
                        <ul className="text-[11px] space-y-0.5">
                          {testResult.log.map((line, i) => (
                            <li
                              key={i}
                              className={
                                testResult.success ? 'text-green-700' : 'text-red-700'
                              }
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Regenerate Token */}
                  <div className="border-t border-slate-200 pt-4">
                    {!showRegenConfirm ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenConfirm(true)}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('webhook.regenerate', 'Regenerar Token')}
                      </Button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-800 mb-2">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {t(
                            'webhook.regenerateWarning',
                            'Isso invalidará a URL atual. Você precisará atualizar a configuração no seu sistema.'
                          )}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRegenConfirm(false)}
                          >
                            {t('common.cancel', 'Cancelar')}
                          </Button>
                          <button
                            onClick={handleRegenerate}
                            disabled={regenerateMutation.isPending}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                          >
                            {regenerateMutation.isPending
                              ? t('common.processing', 'Processando...')
                              : t('webhook.confirmRegenerate', 'Sim, Regenerar')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Documentation Link */}
                  <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 text-xs">
                        {t('webhook.needHelp', 'Precisa de ajuda?')}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {t('webhook.docHelp', 'Teste o endpoint diretamente')}
                      </p>
                    </div>
                    <a
                      href={webhookInfo.test_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {t('webhook.testEndpoint', 'Testar Endpoint')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-500 text-sm">
                  {t('webhook.noConfig', 'Erro ao carregar configuração do webhook')}
                </div>
              )}
            </div>
          ) : activeTab === 'csv' ? (
            <div className="space-y-4">
              {/* File Upload Area */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  {fileName ? (
                    <p className="text-sm font-medium text-slate-700">{fileName}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">
                        {t('nps.dropFile', 'Clique para selecionar arquivo')}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">CSV, TXT ou Excel</p>
                    </>
                  )}
                </label>
              </div>

              {/* Download Template */}
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 text-xs text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                {t('nps.downloadTemplate', 'Baixar modelo de planilha')}
              </button>

              {/* Preview */}
              {csvData.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    {t('nps.preview', 'Prévia')}: {csvData.length} {t('nps.customers', 'clientes')}
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {csvData.slice(0, 5).map((customer, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <UserPlus className="w-3 h-3" />
                        <span>{customer.name || 'Sem nome'}</span>
                        <span className="text-slate-400">·</span>
                        <span>{customer.phone}</span>
                      </div>
                    ))}
                    {csvData.length > 5 && (
                      <p className="text-[11px] text-slate-400">
                        +{csvData.length - 5} {t('nps.more', 'mais')}...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Send Button */}
              <Button
                onClick={handleSendBulk}
                disabled={csvData.length === 0 || createBulkRequest.isPending}
                className="w-full"
              >
                {createBulkRequest.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t('nps.sendToAll', 'Enviar para todos')} ({csvData.length})
              </Button>
            </div>
          ) : null /* QR Code tab hidden for now */}
        </div>
      </div>
    </div>
  );
}
