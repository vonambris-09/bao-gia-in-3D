import { forwardRef } from 'react';
import { Info, Camera, Sparkles, Loader2 } from 'lucide-react';
import { Material, QuoteParams, CalculationResult } from '../types';

/**
 * Phiếu báo giá — phần được chụp thành ảnh / xuất PDF gửi khách.
 *
 * CỐ Ý dùng màu hex cố định thay vì token theme: dù app đang ở chế độ tối,
 * ảnh gửi khách vẫn phải là bản nền sáng. Đây cũng là lý do không dùng
 * oklch ở đây — html-to-image không đọc được oklch.
 */

const C = {
  bg: '#ffffff',
  bg2: '#f8fafc',
  line: '#e2e8f0',
  ink: '#1e293b',
  sub: '#64748b',
  brand: '#2563eb',
  ok: '#22c55e',
  violetBg: '#f5f3ff',
  violetLine: '#ddd6fe',
  violetInk: '#4c1d95',
  violetHead: '#6d28d9',
  total: '#822fbd',
};

interface Props {
  params: QuoteParams;
  material?: Material;
  results: CalculationResult;
  category: string;
  characteristics: string;
  serviceNotes: string;
  qrUrl: string;
  qrLoading: boolean;
  onQrLoad: () => void;
  bank: { name: string; holder: string; number: string };
}

export const QuoteSheet = forwardRef<HTMLDivElement, Props>(function QuoteSheet(
  { params, material, results, category, characteristics, serviceNotes, qrUrl, qrLoading, onQrLoad, bank },
  ref
) {
  return (
    <div
      ref={ref}
      className="quote-sheet rounded-2xl overflow-hidden"
      style={{ background: C.bg, border: `1px solid ${C.line}` }}
    >
      {/* Đầu phiếu */}
      <div
        className="px-5 sm:px-8 py-5 sm:py-6"
        style={{ borderBottom: `1px solid ${C.line}`, background: C.bg2 }}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: C.sub }}>
          NSHOP DIGITAL FABRICATION
        </p>
        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: C.ink }}>
          Xác Nhận Báo Giá
        </h1>
      </div>

      <div className="p-5 sm:p-8 space-y-5 sm:space-y-7">
        {/* Thông số + ảnh mẫu */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
          <div className="rounded-2xl p-5" style={{ background: C.bg2, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: C.brand }}>
              <Info size={14} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em]">Thông số sản phẩm</h3>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div className="col-span-2 pb-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                <p className="text-[10px] font-bold uppercase mb-1 tracking-wide" style={{ color: C.sub }}>Vật liệu</p>
                <p className="font-bold text-base" style={{ color: C.ink }}>
                  {material?.category || '---'} {material?.brand || ''}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase mb-1 tracking-wide" style={{ color: C.sub }}>Khối lượng</p>
                <p className="font-bold" style={{ color: C.ok }}>{params.weightG}g</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase mb-1 tracking-wide" style={{ color: C.sub }}>Màu sắc</p>
                <div className="flex items-center gap-2 justify-end">
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: material?.colorHex || '#cbd5e1', border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                  <span className="font-bold" style={{ color: C.ink }}>{material?.color || '---'}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase mb-1 tracking-wide" style={{ color: C.sub }}>Chiều cao lớp</p>
                <p className="font-bold" style={{ color: C.ink }}>{params.layerHeightMm} mm</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase mb-1 tracking-wide" style={{ color: C.sub }}>Độ đặc (infill)</p>
                <p className="font-bold" style={{ color: C.ink }}>{params.infillPercent}%</p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px] md:min-h-0 md:max-h-[300px]"
            style={{ background: C.bg, border: `1px solid ${C.line}` }}
          >
            {material?.imageUrl ? (
              <img
                src={material.imageUrl}
                alt={material.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: '#cbd5e1' }}>
                <Camera size={30} strokeWidth={1.5} />
                <p className="text-[9px] font-bold uppercase tracking-[0.16em]">Chưa có hình mẫu</p>
              </div>
            )}
          </div>
        </div>

        {/* Đặc tính nhựa */}
        <div
          className="rounded-2xl p-5"
          style={{ background: C.violetBg, border: `1px solid ${C.violetLine}` }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: C.violetHead }}>
            <Sparkles size={15} />
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em]">Đặc tính nhựa {category}</h3>
          </div>
          <p className="text-xs font-semibold italic leading-relaxed" style={{ color: C.violetInk }}>
            {characteristics}
          </p>
        </div>

        {/* Lưu ý dịch vụ */}
        <div className="rounded-2xl p-5" style={{ background: C.bg2, border: `1px solid ${C.line}` }}>
          <h3
            className="text-[11px] font-extrabold uppercase tracking-[0.14em] flex items-center gap-2 mb-2.5"
            style={{ color: C.sub }}
          >
            <Info size={14} style={{ color: C.brand }} /> Lưu ý dịch vụ in 3D
          </h3>
          <div className="whitespace-pre-line text-[11px] font-semibold leading-[1.65]" style={{ color: C.sub }}>
            {serviceNotes}
          </div>
        </div>

        {/* Thanh toán */}
        <div
          className="pt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
          style={{ borderTop: `1px solid ${C.line}` }}
        >
          <div className="flex items-center gap-5 sm:gap-7 flex-1">
            <div
              className="p-1.5 rounded-2xl overflow-hidden flex items-center justify-center relative shrink-0"
              style={{ width: 118, height: 118, background: C.bg, border: `1px solid ${C.line}` }}
            >
              {qrLoading && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.92)' }}
                >
                  <Loader2 size={17} className="animate-spin" style={{ color: C.brand }} />
                  <span className="text-[7px] font-black uppercase tracking-[0.16em]" style={{ color: C.brand }}>
                    Đang tải QR
                  </span>
                </div>
              )}
              <img
                key={qrUrl}
                src={qrUrl}
                alt="Mã QR chuyển khoản"
                width={106}
                height={106}
                className="object-contain transition-opacity duration-300"
                style={{ opacity: qrLoading ? 0.2 : 1 }}
                referrerPolicy="no-referrer"
                onLoad={onQrLoad}
              />
            </div>

            <div className="space-y-3.5 min-w-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: C.sub }}>
                  Thông tin chuyển khoản
                </p>
                <p className="text-xs font-bold uppercase" style={{ color: C.brand }}>{bank.name}</p>
                <p className="text-xs font-bold uppercase" style={{ color: C.sub }}>CTK: {bank.holder}</p>
                <p className="text-xs font-bold" style={{ color: C.sub }}>STK: {bank.number}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: C.sub }}>Nội dung</p>
                <p className="text-sm font-black tracking-wider uppercase" style={{ color: C.ink }}>{params.note}</p>
              </div>
            </div>
          </div>

          <div
            className="rounded-3xl p-6 w-full lg:w-auto lg:min-w-[270px]"
            style={{ background: C.total, boxShadow: '0 12px 28px -10px rgba(130,47,189,0.5)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.28em] mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Tổng thanh toán
            </p>
            <div className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: '#ffffff' }}>
              {results.customerTotal.toLocaleString('vi-VN')}
              <span className="text-base font-bold ml-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>VND</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
