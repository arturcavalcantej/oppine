import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle,
  BarChart3,
  Webhook,
  MapPin,
  Bell,
  MessageSquare,
  FileText,
  Link2,
  CreditCard,
  ArrowUpCircle,
  ChevronDown,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ElementType;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <item.icon className="w-4 h-4 text-slate-500" />
        </div>
        <span className="flex-1 text-sm font-medium text-slate-900">{item.question}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="px-6 pb-4">
          {/* 2rem (w-8 icon) + 0.75rem (gap-3) = pl offset to align under question text */}
          <p className="text-sm text-slate-500 leading-relaxed" style={{ marginLeft: 'calc(2rem + 0.75rem)' }}>
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { t } = useTranslation();
  const [openItem, setOpenItem] = useState<string | null>(null);

  const sections: FAQSection[] = [
    {
      title: t('faq.sectionSystem', 'Sobre o Sistema'),
      items: [
        {
          question: t('faq.whatIsNps', 'O que é NPS e como funciona?'),
          answer: t('faq.whatIsNpsAnswer', 'NPS (Net Promoter Score) mede a satisfação do cliente de 0 a 10. Promotores (9-10) são clientes fiéis que recomendam seu negócio. Passivos (7-8) estão satisfeitos mas podem migrar para a concorrência. Detratores (0-6) estão insatisfeitos e podem prejudicar sua reputação.'),
          icon: BarChart3,
        },
        {
          question: t('faq.howSendsResearch', 'Como o Oppine envia as pesquisas?'),
          answer: t('faq.howSendsResearchAnswer', 'As pesquisas são enviadas via WhatsApp. Você pode integrar com seu sistema (POS, CRM) por webhook para disparo automático após cada venda, ou enviar manualmente pelo painel.'),
          icon: MessageSquare,
        },
        {
          question: t('faq.howWebhookWorks', 'Como funciona o webhook?'),
          answer: t('faq.howWebhookWorksAnswer', 'Configure seu sistema (POS, CRM) para enviar dados do cliente após cada venda. O Oppine envia automaticamente a pesquisa NPS.'),
          icon: Webhook,
        },
        {
          question: t('faq.howGoogleWorks', 'Para que serve o link do Google?'),
          answer: t('faq.howGoogleWorksAnswer', 'Clientes satisfeitos (nota 9-10) são redirecionados para deixar avaliação no seu Google Meu Negócio.'),
          icon: MapPin,
        },
        {
          question: t('faq.howAlertsWork', 'Como funcionam os alertas?'),
          answer: t('faq.howAlertsWorkAnswer', 'Quando um cliente dá nota baixa (0-6), você recebe alerta por WhatsApp/e-mail para resolver o problema rapidamente.'),
          icon: Bell,
        },
      ],
    },
    {
      title: t('faq.sectionTemplates', 'Templates'),
      items: [
        {
          question: t('faq.canCustomizeMessage', 'Posso personalizar a mensagem enviada ao cliente?'),
          answer: t('faq.canCustomizeMessageAnswer', 'Sim! Na seção Templates você pode editar a mensagem de pesquisa. Use {customer_name} para inserir o nome do cliente e {business_name} para o nome do seu negócio automaticamente.'),
          icon: FileText,
        },
        {
          question: t('faq.howManyTemplates', 'Quantos templates posso criar?'),
          answer: t('faq.howManyTemplatesAnswer', 'Depende do seu plano. No plano Starter você tem 3 templates e no Growth é ilimitado.'),
          icon: FileText,
        },
        {
          question: t('faq.howLinkTemplate', 'Como vincular um template a um negócio?'),
          answer: t('faq.howLinkTemplateAnswer', 'Ao criar ou editar um negócio, você encontra um seletor de template no formulário. Escolha qual template será usado para enviar as pesquisas daquele negócio.'),
          icon: Link2,
        },
      ],
    },
    {
      title: t('faq.sectionPlans', 'Planos'),
      items: [
        {
          question: t('faq.planDifferences', 'Qual a diferença entre os planos?'),
          answer: t('faq.planDifferencesAnswer', 'Os planos variam em quantidade de negócios, templates e volume de pesquisas. O plano Free é ideal para testar, o Básico para pequenos negócios, e os planos superiores para quem precisa de mais recursos.'),
          icon: CreditCard,
        },
        {
          question: t('faq.howToUpgrade', 'Como faço upgrade do meu plano?'),
          answer: t('faq.howToUpgradeAnswer', 'Acesse Configurações > Assinatura para ver os planos disponíveis e fazer upgrade. A mudança é imediata e você já pode usar os novos recursos.'),
          icon: ArrowUpCircle,
        },
      ],
    },
  ];

  const toggleItem = (key: string) => {
    setOpenItem(openItem === key ? null : key);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200 mb-8">
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          {t('faq.title', 'Dúvidas Frequentes')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('faq.subtitle', 'Encontre respostas para as perguntas mais comuns sobre o Oppine.')}
        </p>
      </div>

      {/* FAQ Sections */}
      <div className="space-y-6">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
              {section.title}
            </h2>
            <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
              {section.items.map((item, index) => {
                const key = `${sectionIndex}-${index}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={openItem === key}
                    onToggle={() => toggleItem(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
