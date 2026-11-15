import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Bỏ dấu tiếng Việt để tìm kiếm cho dễ: gõ "trang" vẫn ra "Trắng",
 * gõ "do hong" vẫn ra "Đỏ hồng". Chữ đ/Đ không tách dấu được nên xử lý riêng.
 */
export function normalizeVi(s?: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** So sánh chuỗi theo đúng thứ tự bảng chữ cái tiếng Việt. */
export const viCollator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

/** Số nhựa còn trong kho (app Kho nhựa ở tiệm tự ghi lên): "850 g", "2,3 kg". */
export function formatGram(g: number) {
  return g >= 1000
    ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(g / 1000)} kg`
    : `${Math.round(g)} g`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(value).replace('₫', 'đ');
}
