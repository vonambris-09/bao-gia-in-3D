/* ==========================================================================
   Mã VietQR chuyển khoản – tự tạo ngay trong app

   Trước đây ảnh QR lấy từ qr.limcorp.vn. Ngày 17-11-2026 dịch vụ đó sập,
   app kẹt ở "Đang tải QR" và không xuất được báo giá. Giờ chuỗi QR được
   dựng tại chỗ theo chuẩn EMVCo của NAPAS (VietQR), app ngân hàng nào cũng
   quét được; không cần mạng, không bao giờ dính số tiền cũ.

   Đã đối chiếu từng ký tự (kể cả mã kiểm tra CRC) với QR do img.vietqr.io
   tạo cho cùng ngân hàng / số tài khoản / số tiền / nội dung.
   ========================================================================== */

/** Một trường EMVCo: mã 2 số + độ dài 2 số + giá trị. */
const truong = (id: string, giaTri: string) => id + String(giaTri.length).padStart(2, '0') + giaTri;

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi đầu 0xFFFF) – trường 63 của chuẩn EMVCo. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: bỏ dấu, chỉ giữ chữ / số / khoảng trắng, tối đa 25 ký tự (giới hạn của VietQR). */
export function chuanNoiDung(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .slice(0, 25).trim();
}

export interface ThongTinChuyenKhoan {
  bin: string;      // mã ngân hàng NAPAS, 6 số (OCB = 970448)
  stk: string;      // số tài khoản
  soTien?: number;  // đồng; 0 hoặc bỏ trống = để người chuyển tự nhập
  noiDung?: string;
}

/** Chuỗi VietQR; thiếu / sai ngân hàng hoặc số tài khoản thì trả về '' (không vẽ QR sai). */
export function chuoiVietQR({ bin, stk, soTien = 0, noiDung = '' }: ThongTinChuyenKhoan): string {
  const b = String(bin || '').trim();
  const tk = String(stk || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(b) || !/^[0-9A-Za-z]{1,19}$/.test(tk)) return '';
  const tien = Math.round(Number(soTien) || 0);
  const nd = chuanNoiDung(noiDung);
  const nguoiNhan = truong('00', 'A000000727') + truong('01', truong('00', b) + truong('01', tk)) + truong('02', 'QRIBFTTA');
  const than =
    truong('00', '01') +
    truong('01', tien > 0 ? '12' : '11') +   // 12 = QR dùng một lần (có số tiền), 11 = QR tĩnh
    truong('38', nguoiNhan) +
    truong('53', '704') +                     // VND
    (tien > 0 ? truong('54', String(tien)) : '') +
    truong('58', 'VN') +
    (nd ? truong('62', truong('08', nd)) : '') +
    '6304';
  return than + crc16(than);
}
