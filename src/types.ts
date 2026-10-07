export interface Material {
  id: string;
  name: string;
  brand: string;
  pricePerKg: number;
  color: string;
  colorHex: string;
  category?: string;
  inStock?: boolean;
  imageUrl?: string;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}

import type { MayIn } from './lib/may-in';

export interface SystemSettings {
  machinePowerW: number;       // = công suất máy đang chọn (giữ cho luật Firestore)
  electricityPriceKwh: number;
  depreciationPerHour: number; // = khấu hao máy đang chọn
  /** Hệ số nhân từ giá vốn ra giá bán. Trước đây bị hard-code 2.25 trong code. */
  markupMultiplier?: number;
  serviceNotes?: string;
  heSoGia?: number;            // tên cũ của markupMultiplier ở bản offline 1.0.11, chỉ đọc để chuyển
  mayIn?: MayIn[];             // máy in của tiệm — chỉ lưu trong trình duyệt
  mayChon?: string;            // id máy đang chọn
}

/** Dùng khi settings chưa tải xong hoặc thiếu field (dữ liệu cũ). */
export const DEFAULT_MARKUP = 2.25;

export interface QuoteParams {
  materialId: string;
  hours: number;
  minutes: number;
  weightG: number;
  infillPercent: number;
  layerHeightMm: number;
  extraFee: number;
  note: string;
}

export interface CalculationResult {
  materialCost: number;
  electricityCost: number;
  depreciationCost: number;
  internalTotal: number;
  customerTotal: number;
}
