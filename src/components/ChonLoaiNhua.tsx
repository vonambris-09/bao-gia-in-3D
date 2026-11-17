import { motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { NHOM_NHUA, nhomCua, MO_TA_BIEN } from '@/lib/loai-nhua';
import { Segmented } from './ui';

/* ==========================================================================
   Chọn loại nhựa – hai tầng

   Hàng trên: nhóm (PLA · PETG · ABS · ASA · TPU).
   Hàng dưới: biến thể của nhóm đó (Thường · CF · GF, hoặc 85A · 90A · 95A),
   kèm số vật liệu đang có, để thấy ngay loại nào có hàng.
   Bấm nhóm: nhảy sang biến thể đầu tiên có vật liệu (không có thì biến thể đầu).
   ========================================================================== */

export function ChonLoaiNhua({
  value, onChange, dem,
}: {
  value: string;
  onChange: (loai: string) => void;
  /** Số vật liệu của một loại. */
  dem: (loai: string) => number;
}) {
  const nhom = nhomCua(value);
  const chonNhom = (goc: string) => {
    const n = NHOM_NHUA.find(x => x.goc === goc)!;
    onChange((n.bien.find(b => dem(b.ma) > 0) || n.bien[0]).ma);
  };

  return (
    <div className="space-y-2">
      <Segmented
        value={nhom.goc}
        onChange={chonNhom}
        options={NHOM_NHUA.map(n => ({ value: n.goc, label: n.goc }))}
        layoutId="chon-nhom-nhua"
        className="flex w-full"
        compact
      />
      {nhom.bien.length > 1 && (
        <motion.div
          key={nhom.goc}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${nhom.bien.length}, minmax(0, 1fr))` }}
          role="radiogroup"
          aria-label={`Biến thể ${nhom.goc}`}
        >
          {nhom.bien.map(b => {
            const active = b.ma === value;
            const n = dem(b.ma);
            return (
              <button
                key={b.ma}
                type="button"
                role="radio"
                aria-checked={active}
                title={`${b.ma}${MO_TA_BIEN[b.nhan] ? ' – ' + MO_TA_BIEN[b.nhan] : ''}`}
                onClick={() => onChange(b.ma)}
                className={cn(
                  'min-w-0 flex flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 transition-colors cursor-pointer',
                  active
                    ? 'bg-brand-soft border-brand text-brand'
                    : 'bg-surface-2 border-line text-ink-soft hover:text-ink'
                )}
              >
                <span className="text-xs font-black leading-tight">{b.nhan}</span>
                <span className={cn('text-[10px] font-bold leading-tight truncate max-w-full', active ? 'text-brand/80' : n ? 'text-ink-faint' : 'text-ink-faint/60')}>
                  {MO_TA_BIEN[b.nhan] ? MO_TA_BIEN[b.nhan] + ' · ' : ''}{n}
                </span>
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
