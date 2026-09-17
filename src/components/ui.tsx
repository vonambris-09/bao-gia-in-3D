import type {
  ReactNode, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes,
} from 'react';
import { useEffect } from 'react';
import { motion, AnimatePresence, type Transition } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Chuyển động

   QUAN TRỌNG: chỉ animate `transform` (scale/x/y) và `opacity`.
   Bản trước giật vì animate cả màu, bóng và layout — những thứ buộc trình
   duyệt tính lại style và bố cục mỗi khung hình.
   ========================================================================== */

export const spring: Transition = { type: 'spring', stiffness: 460, damping: 34, mass: 0.6 };
export const springSoft: Transition = { type: 'spring', stiffness: 300, damping: 32 };
export const springSheet: Transition = { type: 'spring', stiffness: 340, damping: 36 };

/* ==========================================================================
   Thẻ kính
   ========================================================================== */

export function Card({
  children, className, title, icon, action, padded = true, glow = false,
}: {
  children: ReactNode; className?: string; title?: string;
  icon?: ReactNode; action?: ReactNode; padded?: boolean; glow?: boolean;
}) {
  return (
    <div
      className={cn(
        'lit lit-strong bg-surface border border-line rounded-[20px] overflow-hidden',
        glow ? 'shadow-glow' : 'shadow-card',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
          <div className="flex items-center gap-2 text-ink-soft min-w-0">
            {icon}
            <h2 className="font-bold text-2xs uppercase tracking-[0.13em] truncate">{title}</h2>
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded && 'p-5', title && padded && 'pt-3')}>{children}</div>
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
    <label className={cn('block space-y-2', className)}>
      <span className="text-2xs font-bold text-ink-soft px-0.5 flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {hint && <span className="text-ink-faint font-semibold shrink-0">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* Chỉ transition box-shadow khi focus — một phần tử tại một thời điểm, không đáng kể. */
const controlBase =
  'w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm font-semibold text-ink ' +
  'outline-none focus:border-brand focus:shadow-[0_0_0_4px_var(--ring)] ' +
  'disabled:opacity-50 placeholder:text-ink-faint';

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
      className={cn(controlBase, 'appearance-none cursor-pointer pr-9', props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23708098' stroke-width='3' stroke-linecap='round'%3e%3cpath d='M6 9l6 6 6-6'/%3e%3c/svg%3e\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '15px',
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
    brand: 'text-brand-ink shadow-glow border border-white/15 ' +
           'bg-[linear-gradient(135deg,var(--brand),var(--brand-2))]',
    plain: 'bg-surface-2 text-ink border border-line lit',
    ghost: 'text-ink-soft border border-transparent',
    danger: 'bg-danger text-white shadow-card border border-white/15',
    warn: 'bg-warn text-[#1a1205] shadow-card border border-white/20',
  };
  const sizes = {
    sm: 'px-3.5 py-2 text-2xs gap-1.5 rounded-lg',
    md: 'px-5 py-3 text-sm gap-2 rounded-xl',
    lg: 'px-6 py-3.5 text-base gap-2.5 rounded-2xl',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={spring}
      {...(rest as any)}
      className={cn(
        'inline-flex items-center justify-center font-bold whitespace-nowrap select-none',
        'disabled:opacity-45 disabled:pointer-events-none',
        variants[variant], sizes[size], className
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

/* ==========================================================================
   Segmented control — con trượt dùng layoutId, motion chạy nó bằng transform
   ========================================================================== */

export function Segmented<T extends string>({
  value, onChange, options, layoutId, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={cn('lit inline-flex bg-surface-2 border border-line rounded-xl p-1 gap-1', className)}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={cn(
              'relative flex-1 inline-flex items-center justify-center gap-2 font-bold rounded-lg',
              'px-4 py-2 text-xs whitespace-nowrap',
              active ? 'text-brand-ink' : 'text-ink-soft'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={springSoft}
                className="absolute inset-0 rounded-lg shadow-glow bg-[linear-gradient(135deg,var(--brand),var(--brand-2))]"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">{o.icon}{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Công tắc — núm chạy bằng transform, KHÔNG dùng `layout` (layout phải đo lại
   bố cục mỗi khung hình; transform thì không)
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
        'relative w-[54px] h-[32px] rounded-full shrink-0 border',
        checked ? 'bg-ok border-white/20' : 'bg-surface-3 border-line'
      )}
    >
      <motion.span
        animate={{ x: checked ? 23 : 3 }}
        transition={spring}
        className="absolute top-[3px] left-0 w-[24px] h-[24px] bg-white rounded-full shadow-float"
      />
    </button>
  );
}

/* ==========================================================================
   Sheet
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
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={springSheet}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 650) onClose(); }}
            className={cn(
              'lit lit-strong relative w-full sm:max-w-xl bg-surface-op border border-line shadow-float',
              'rounded-t-[30px] sm:rounded-[26px] max-h-[88vh] flex flex-col'
            )}
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-ink-faint opacity-40" />
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line shrink-0">
              <h3 className="font-extrabold text-lg text-ink truncate">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-2.5 rounded-full">
                <X size={18} />
              </Button>
            </div>

            <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>

            {footer && <div className="px-6 py-4 border-t border-line shrink-0 pb-safe">{footer}</div>}
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
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
      <div className="text-ink-faint opacity-50">{icon}</div>
      <div>
        <h3 className="font-extrabold text-ink mb-1.5 text-lg">{title}</h3>
        {desc && <p className="text-sm text-ink-soft max-w-sm">{desc}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
