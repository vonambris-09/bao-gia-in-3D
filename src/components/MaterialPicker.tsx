import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PackageX, Search } from 'lucide-react';

import { cn, normalizeVi, viCollator } from '@/lib/utils';
import type { Material } from '../types';
import { Sheet, controlBase } from './ui';

/* ==========================================================================
   Chọn cuộn nhựa

   Dropdown hệ thống không tìm được gì khi kho có vài chục cuộn: danh sách
   phẳng, không nhóm, không gõ tìm được, mà tên cuộn thì gần giống nhau.

   Ở đây: gõ để lọc (không dấu vẫn ra), nhóm theo hãng, sắp xếp A–Z, mỗi
   dòng có chấm đúng màu cuộn nhựa. Hàng đã hết dồn xuống cuối, gom chung
   một mục — không lặp chữ "HẾT HÀNG" trên từng dòng nữa.
   ========================================================================== */

function Dot({ hex, out, size = 22 }: { hex?: string; out?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        // Vòng viền cố định để chấm trắng nổi trên nền sáng và chấm đen nổi trên nền tối.
        'rounded-full shrink-0',
        'shadow-[inset_0_1px_2px_rgba(15,23,42,0.22),0_0_0_1px_rgba(148,163,184,0.5)]',
        // Chỉ khử màu, KHÔNG mờ thêm — dòng chứa nó đã mờ sẵn, chồng hai lớp
        // là chấm màu biến mất luôn.
        out && 'grayscale'
      )}
      style={{ width: size, height: size, background: hex || '#94a3b8' }}
    />
  );
}

function label(m: Material) {
  return `${m.brand || 'Không tên'} — ${m.color || 'Không rõ màu'}`;
}

export function MaterialPicker({
  materials, value, onChange, category,
}: {
  materials: Material[];
  value: string;
  onChange: (id: string) => void;
  category: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = materials.find(m => m.id === value);

  // Mở lại là xoá ô tìm kiếm. Chỉ tự focus trên máy tính — trên điện thoại
  // bàn phím bật lên ngay sẽ che mất danh sách.
  useEffect(() => {
    if (!open) return;
    setQ('');
    if (window.matchMedia?.('(min-width: 640px)').matches) {
      const t = setTimeout(() => searchRef.current?.focus(), 90);
      return () => clearTimeout(t);
    }
  }, [open]);

  const { groups, sold, hits } = useMemo(() => {
    const needle = normalizeVi(q.trim());
    const hit = materials.filter(
      m => !needle || normalizeVi(`${m.brand} ${m.color}`).includes(needle)
    );

    const byColor = (a: Material, b: Material) => viCollator.compare(a.color || '', b.color || '');

    const map = new Map<string, Material[]>();
    for (const m of hit) {
      if (m.inStock === false) continue;
      const brand = (m.brand || '').trim() || 'Không tên';
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(m);
    }

    return {
      hits: hit.length,
      groups: Array.from(map.entries())
        .sort((a, b) => viCollator.compare(a[0], b[0]))
        .map(([brand, list]) => ({ brand, list: list.sort(byColor) })),
      sold: hit
        .filter(m => m.inStock === false)
        .sort((a, b) => viCollator.compare(label(a), label(b))),
    };
  }, [materials, q]);

  const pick = (id: string) => { onChange(id); setOpen(false); };

  // Gõ xong còn đúng một kết quả còn hàng thì Enter là chọn luôn.
  const onlyHit = groups.length === 1 && groups[0].list.length === 1 ? groups[0].list[0] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(controlBase, 'flex items-center gap-2.5 text-left cursor-pointer')}
      >
        {selected
          ? <Dot hex={selected.colorHex} out={selected.inStock === false} size={18} />
          : <span className="w-[18px] h-[18px] rounded-full border border-dashed border-line shrink-0" />}
        <span className={cn('flex-1 min-w-0 truncate', !selected && 'text-ink-faint')}>
          {selected ? label(selected) : '(Trống)'}
        </span>
        <ChevronDown size={16} className="text-ink-faint shrink-0" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Cuộn nhựa ${category}`}
        toolbar={
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && onlyHit) pick(onlyHit.id); }}
              placeholder="Gõ tên hãng hoặc màu…"
              className={cn(controlBase, 'pl-11')}
            />
          </div>
        }
      >
        {hits === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-extrabold text-ink">Không tìm thấy cuộn nào</p>
            <p className="text-sm text-ink-soft mt-1.5">Thử gõ ngắn hơn, hoặc kiểm tra lại loại nhựa đang chọn.</p>
          </div>
        ) : (
          <div className="-mx-2 -mt-2 pb-2">
            {groups.map((g, i) => (
              <div key={g.brand}>
                <div className={cn(
                  'px-3 pb-1.5 text-2xs font-black uppercase tracking-[0.13em] text-ink-faint',
                  i === 0 ? 'pt-1' : 'pt-4'
                )}>
                  {g.brand}
                </div>
                {g.list.map(m => {
                  const active = m.id === value;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pick(m.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                        active && 'bg-brand-soft'
                      )}
                    >
                      <Dot hex={m.colorHex} />
                      <span className={cn('flex-1 min-w-0 truncate text-sm font-bold', active ? 'text-brand' : 'text-ink')}>
                        {m.color || 'Không rõ màu'}
                      </span>
                      {active && <Check size={17} className="text-brand shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {sold.length > 0 && (
              <div className="mt-5 pt-4 border-t border-line">
                <div className="px-3 pb-1.5 flex items-center gap-1.5 text-2xs font-black uppercase tracking-[0.13em] text-ink-faint">
                  <PackageX size={13} />
                  Hết hàng ({sold.length})
                </div>
                {sold.map(m => (
                  <div
                    key={m.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 opacity-55 select-none"
                  >
                    <Dot hex={m.colorHex} out />
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-ink line-through">
                      {label(m)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
