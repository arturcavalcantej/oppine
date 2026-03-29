import { Star, ArrowRight, MousePointerClick, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoogleConversionStats } from '@/api/hooks/useFeedback';

interface GoogleConversionCardProps {
  stats: GoogleConversionStats;
}

function FunnelStep({
  label,
  value,
  color,
  isLast,
}: {
  label: string;
  value: number;
  color: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-center flex-1">
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
      </div>
      {!isLast && (
        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      )}
    </div>
  );
}

export default function GoogleConversionCard({ stats }: GoogleConversionCardProps) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900">Conversão Google Reviews</h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Funil de promotores que avaliaram no Google
        </p>
      </div>

      <div className="p-6">
        {/* Funnel */}
        <div className="flex items-start justify-between gap-1">
          <FunnelStep
            label="Promotores"
            value={stats.total_promoters}
            color="text-slate-900"
          />
          <FunnelStep
            label="Clicaram"
            value={stats.clicked_google_review}
            color="text-blue-600"
          />
          <FunnelStep
            label="Avaliaram"
            value={stats.matched_reviews}
            color="text-green-600"
            isLast
          />
        </div>

        {/* Rates */}
        {stats.total_promoters > 0 && (
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-slate-500">Taxa de clique:</span>
              <span className="font-semibold text-slate-900">{stats.click_rate}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-slate-500">Taxa de conversão:</span>
              <span className="font-semibold text-slate-900">{stats.conversion_rate}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
