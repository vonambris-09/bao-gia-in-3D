/* ==========================================================================
   Loại nhựa – chia theo nhóm gốc + biến thể

   Trước đây chỉ có 6 loại phẳng (PLA, PETG, PETG-CF, ABS, ASA, TPU), loại phụ
   như ABS-CF phải ghi vào tên màu. Giờ mỗi nhóm có biến thể riêng:
     PLA / PETG / ABS: thường, CF (sợi carbon), GF (sợi thủy tinh)
     TPU: 85A, 90A, 95A (độ cứng Shore)
   Mã loại (category lưu trên Firestore) đặt giống cách máy Bambu gọi
   ("PETG-CF", "ABS-GF"...) để app Kho nhựa so được với khay AMS.
   ========================================================================== */

export interface BienThe { ma: string; nhan: string; }
export interface NhomNhua { goc: string; bien: BienThe[]; }

export const NHOM_NHUA: NhomNhua[] = [
  { goc: 'PLA', bien: [{ ma: 'PLA', nhan: 'Thường' }, { ma: 'PLA-CF', nhan: 'CF' }, { ma: 'PLA-GF', nhan: 'GF' }] },
  { goc: 'PETG', bien: [{ ma: 'PETG', nhan: 'Thường' }, { ma: 'PETG-CF', nhan: 'CF' }, { ma: 'PETG-GF', nhan: 'GF' }] },
  { goc: 'ABS', bien: [{ ma: 'ABS', nhan: 'Thường' }, { ma: 'ABS-CF', nhan: 'CF' }, { ma: 'ABS-GF', nhan: 'GF' }] },
  { goc: 'ASA', bien: [{ ma: 'ASA', nhan: 'Thường' }] },
  { goc: 'TPU', bien: [{ ma: 'TPU 85A', nhan: '85A' }, { ma: 'TPU 90A', nhan: '90A' }, { ma: 'TPU 95A', nhan: '95A' }] },
];

/** Mọi mã loại, theo thứ tự hiển thị. */
export const CATEGORIES: string[] = NHOM_NHUA.flatMap((n) => n.bien.map((b) => b.ma));

/** Nhóm chứa một loại (kể cả loại cũ / viết lệch như "tpu", "PETG CF"). */
export function nhomCua(loai?: string): NhomNhua {
  const x = String(loai || '').trim().toUpperCase();
  return NHOM_NHUA.find((n) => n.bien.some((b) => b.ma === x))
    || NHOM_NHUA.find((n) => x.startsWith(n.goc))
    || NHOM_NHUA[0];
}

/**
 * Đưa một loại bất kỳ về đúng mã trong danh sách. Loại cũ không còn: "TPU" -> "TPU 95A"
 * (loại TPU phổ biến nhất), "PETG CF" / "petg-cf" -> "PETG-CF", lạ hẳn -> "PLA".
 */
export function chuanLoai(loai?: string): string {
  const x = String(loai || '').trim().toUpperCase().replace(/\s*[-_ ]\s*(CF|GF)$/, '-$1').replace(/\s+/g, ' ');
  if (CATEGORIES.includes(x)) return x;
  const n = nhomCua(x);
  if (n.goc === 'TPU') { const a = x.match(/(85|90|95)\s*A\b/); return a ? `TPU ${a[1]}A` : 'TPU 95A'; }
  return n.bien[0].ma;
}

/** Nhãn đầy đủ cho biến thể, dùng trong ô gợi ý: "CF · sợi carbon". */
export const MO_TA_BIEN: Record<string, string> = {
  CF: 'sợi carbon',
  GF: 'sợi thủy tinh',
  '85A': 'mềm nhất',
  '90A': 'mềm vừa',
  '95A': 'cứng hơn, dễ in',
};
