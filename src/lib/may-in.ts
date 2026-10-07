// Máy in để tính tiền điện + khấu hao theo từng máy. Danh sách mặc định: máy FDM đang bán ở
// meme3d.com (07-10-2026). `congSuat` là công suất TRUNG BÌNH lúc in PLA (W), không phải công
// suất tối đa của nguồn:
//   - Bambu Lab: số đo chính hãng ở wiki.bambulab.com/en/general/power-consumption
//     (H2D Pro chưa có số riêng, lấy theo dòng H2);
//   - Elegoo Centauri Carbon: bài đo igorslab (~160 W in PLA);
//   - Elegoo Neptune 4 Pro: bài đo Tom's Hardware / PeterVRC (78–192 W tuỳ vùng bàn nhiệt);
//   - còn lại ước tính theo máy cùng cỡ đã đo (Anycubic Kobra 3 ~205 W, Kobra S1 ~180 W),
//     bàn nhiệt càng to càng tốn. Khách sửa được trong Cài đặt.

export interface MayIn {
  id: string;
  ten: string;
  congSuat: number; // W
  khauHao: number;  // đ/giờ
}

export interface MayMau { hang: string; ten: string; congSuat: number }

export const MAY_MAU: MayMau[] = [
  { hang: 'Bambu Lab', ten: 'Bambu Lab A1 mini', congSuat: 80 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab A1', congSuat: 95 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab A2L', congSuat: 145 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab P1S', congSuat: 105 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab P2S', congSuat: 200 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab X1C', congSuat: 105 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab X1E', congSuat: 185 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab X2D', congSuat: 250 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab H2S', congSuat: 200 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab H2D', congSuat: 197 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab H2D Pro', congSuat: 200 },
  { hang: 'Bambu Lab', ten: 'Bambu Lab H2C', congSuat: 200 },
  { hang: 'Creality', ten: 'Creality SPARKX i7 Nano', congSuat: 100 },
  { hang: 'Flashforge', ten: 'Flashforge Creator 5', congSuat: 180 },
  { hang: 'Flashforge', ten: 'Flashforge Creator 5 Pro', congSuat: 200 },
  { hang: 'Anycubic', ten: 'Anycubic Kobra X', congSuat: 180 },
  { hang: 'Anycubic', ten: 'Anycubic Kobra 3 Max', congSuat: 250 },
  { hang: 'Elegoo', ten: 'Elegoo Centauri Carbon', congSuat: 160 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 4', congSuat: 120 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 4 Pro', congSuat: 120 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 4 Plus', congSuat: 180 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 4 Max', congSuat: 220 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 3', congSuat: 110 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 3 Pro', congSuat: 110 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 3 Plus', congSuat: 170 },
  { hang: 'Elegoo', ten: 'Elegoo Neptune 3 Max', congSuat: 220 },
  { hang: 'Elegoo', ten: 'Elegoo OrangeStorm Giga', congSuat: 500 },
  { hang: 'Kokoni', ten: 'Kokoni EC1', congSuat: 40 },
];

export const HANG_MAY = [...new Set(MAY_MAU.map((m) => m.hang))];

export const idMayMoi = () => 'may-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
