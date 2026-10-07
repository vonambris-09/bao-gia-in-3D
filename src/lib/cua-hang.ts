/// <reference types="vite/client" />
// Cửa hàng + tài khoản nhận tiền, đặt trong Cài đặt và chỉ lưu trong trình duyệt (luật Firestore
// không nhận thêm khoá). Chưa đặt gì thì dùng tài khoản đang in trên báo giá từ trước.
// Bản offline (`vite build --mode offline`, gói khách) bắt đầu trống để khách tự điền.

export interface ThongTinShop {
  ten: string;   // tên cửa hàng in trên đầu phiếu
  bin: string;   // mã ngân hàng NAPAS (6 số)
  stk: string;   // số tài khoản
  chuTk: string; // tên chủ tài khoản (in hoa, không dấu)
}

const KHOA = 'baogia.shop.v1';
const MAC_DINH: ThongTinShop = import.meta.env.MODE === 'offline'
  ? { ten: '', bin: '', stk: '', chuTk: '' }
  : { ten: '', bin: '970448', stk: '0344970774', chuTk: 'VO THANH NAM' };

export function docShop(): ThongTinShop {
  try {
    const o = JSON.parse(localStorage.getItem(KHOA) || 'null');
    if (o && typeof o === 'object') {
      return { ten: String(o.ten || ''), bin: String(o.bin || ''), stk: String(o.stk || ''), chuTk: String(o.chuTk || '') };
    }
  } catch { /* hỏng thì coi như chưa điền */ }
  return { ...MAC_DINH };
}
export function luuShop(s: ThongTinShop) {
  try { localStorage.setItem(KHOA, JSON.stringify(s)); } catch { /* kho đầy / bị chặn: giữ trong phiên */ }
}

// Mã ngân hàng NAPAS (BIN) của các ngân hàng hay dùng. Ngân hàng khác: chọn "Khác" rồi gõ BIN.
export const NGAN_HANG: [string, string][] = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'],
  ['970422', 'MB Bank'], ['970407', 'Techcombank'], ['970416', 'ACB'], ['970432', 'VPBank'],
  ['970423', 'TPBank'], ['970403', 'Sacombank'], ['970437', 'HDBank'], ['970441', 'VIB'],
  ['970443', 'SHB'], ['970431', 'Eximbank'], ['970426', 'MSB'], ['970448', 'OCB'],
  ['970440', 'SeABank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970425', 'ABBANK'],
  ['970409', 'Bac A Bank'], ['970412', 'PVcomBank'], ['970454', 'BVBank'], ['970419', 'NCB'],
  ['970452', 'Kienlongbank'], ['970400', 'Saigonbank'], ['970429', 'SCB'], ['970427', 'VietABank'],
  ['970438', 'BaoViet Bank'], ['970430', 'PGBank'], ['970424', 'Shinhan Bank'],
];
export const tenNganHang = (bin: string) => (NGAN_HANG.find((n) => n[0] === bin) || [bin, bin ? 'BIN ' + bin : ''])[1];
