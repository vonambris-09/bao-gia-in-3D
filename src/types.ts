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

export interface SystemSettings {
  machinePowerW: number;
  electricityPriceKwh: number;
  depreciationPerHour: number;
  /** Hệ số nhân từ giá vốn ra giá bán. Trước đây bị hard-code 2.25 trong code. */
  markupMultiplier?: number;
  serviceNotes?: string;
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
