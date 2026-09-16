import type {
  ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes,
} from 'react';
import { useEffect } from 'react';
import { motion, AnimatePresence, type Transition } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Chuyển động
   iOS dùng spring chứ không dùng thời lượng cố định — chạm vào thấy "có khối
   lượng" chứ không phải chạy hết một đoạn animation.
   ========================================================================== */

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 };
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 };
export const springSheet: Transition = { type: 'spring', stiffness: 300, damping: 34 };

/** Hiệu ứng nhấn: thu nhỏ nhẹ, bật lại ngay — giống nút trên iOS. */
export const tap = { whileTap: { scale: 0.96 }, transition: spring };

/* ==========================================================================
   Thẻ
   ========================================================================== */

export function Card({
  children, className, title, icon, action, padded = true,
}: {
  children: ReactNode; className?: string; title?: string;
  icon?: ReactNode; action?: ReactNode; padded?: boolean;
}) {
  return (
    <div
      data-themed
      className={cn(
        'bg-surface border border-line rounded-2xl shadow-card overflow-hidden',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-1">
          <div className="flex items-center gap-2 text-ink-soft min-w-0">
            {icon}
            <h2 className="font-bold text-[11px] uppercase tracking-[0.12em] truncate">{title}</h2>
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded && 'p-4', title && padded && 'pt-3')}>{children}</div>
    </div>
  );
}

/* ==========================================================================
   Ô nhập
   ========================================================================== */

export function Field({
  label, children, hint, className,
}: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[11px] font-bold text-ink-soft px-0.5 flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {hint && <span className="text-ink-faint font-semibold shrink-0">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const controlBase =
  'w-full bg-surface-2 border border-line rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink ' +
  'outline-none transition-[box-shadow,border-color] duration-200 ' +
  'focus:border-brand focus:shadow-[0_0_0_3.5px_var(--ring)] ' +
  'disabled:opacity-50';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, props.className)} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input inputMode="decimal" {...props} type="number" className={cn(controlBase, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(controlBase, 'appearance-none cursor-pointer pr-8', props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236e6e76' stroke-width='3' stroke-linecap='round'%3e%3cpath d='M6 9l6 6 6-6'/%3e%3c/svg%3e\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        backgroundSize: '14px',
        ...props.style,
      }}
    />
  );
}

/* ==========================================================================
   Nút
   ========================================================================== */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'brand' | 'plain' | 'ghost' | 'danger' | 'warn';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ variant = 'plain', size = 'md', icon, children, className, ...rest }: BtnProps) {
  const variants = {
    brand: 'bg-brand text-brand-ink shadow-card hover:brightness-110',
    plain: 'bg-surface-2 text-ink border border-line hover:bg-surface-3',
    ghost: 'text-ink-soft hover:bg-surface-2 hover:text-ink',
    danger: 'bg-danger text-white shadow-card hover:brightness-110',
    warn: 'bg-warn text-[#1c1c1e] shadow-card hover:brightness-105',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-[11px] gap-1.5 rounded-lg',
    md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
    lg: 'px-5 py-3 text-base gap-2 rounded-2xl',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      {...(rest as any)}
      className={cn(
        'inline-flex items-center justify-center font-bold whitespace-nowrap',
        'transition-[filter,background-color] duration-200 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], sizes[size], className
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

/* ==========================================================================
   Segmented control — thanh chọn kiểu iOS, con trượt bám theo mục đang chọn
   ========================================================================== */

export function Segmented<T extends string>({
  value, onChange, options, layoutId, className, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  layoutId: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      data-themed
      className={cn('inline-flex bg-surface-2 border border-line rounded-xl p-1 gap-1', className)}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={cn(
              'relative flex-1 inline-flex items-center justify-center gap-1.5 font-bold rounded-lg',
              'transition-colors duration-200 whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-xs',
              active ? 'text-brand-ink' : 'text-ink-soft hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={springSoft}
                className="absolute inset-0 bg-brand rounded-lg shadow-card"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon}{o.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Công tắc bật/tắt kiểu iOS
   ========================================================================== */

export function Switch({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-[46px] h-[28px] rounded-full shrink-0 transition-colors duration-300',
        checked ? 'bg-ok' : 'bg-surface-3'
      )}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[2px] w-[24px] h-[24px] bg-white rounded-full shadow-float"
        style={{ left: checked ? 20 : 2 }}
      />
    </button>
  );
}

/* ==========================================================================
   Sheet — trên điện thoại trượt lên từ đáy, trên máy tính là hộp thoại giữa
   ========================================================================== */

export function Sheet({
  open, onClose, title, children, footer,
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            data-themed
            initial={{ y: '100%', opacity: 0.6, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '100%', opacity: 0.6, scale: 0.98 }}
            transition={springSheet}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
            className={cn(
              'relative w-full sm:max-w-lg bg-surface border border-line shadow-sheet',
              'rounded-t-[28px] sm:rounded-3xl max-h-[88vh] flex flex-col'
            )}
          >
            {/* tay nắm kéo, chỉ hiện trên điện thoại */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-9 h-1.5 rounded-full bg-line" />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line shrink-0">
              <h3 className="font-extrabold text-base text-ink truncate">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-2 rounded-full">
                <X size={16} />
              </Button>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>

            {footer && (
              <div className="px-5 py-3.5 border-t border-line shrink-0 pb-safe">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ==========================================================================
   Trạng thái rỗng
   ========================================================================== */

export function Empty({
  icon, title, desc, action,
}: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="flex flex-col items-center justify-center py-14 px-6 gap-3 text-center"
    >
      <div className="text-ink-faint opacity-60">{icon}</div>
      <div>
        <h3 className="font-extrabold text-ink mb-1">{title}</h3>
        {desc && <p className="text-sm text-ink-soft max-w-xs">{desc}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
