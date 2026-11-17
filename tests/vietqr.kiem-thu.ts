// Kiểm thử chuỗi VietQR tự tạo, đối chiếu với QR do img.vietqr.io tạo (đã giải mã ra chuỗi, số tài khoản giả).
//   npm run test:vietqr
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuoiVietQR, chuanNoiDung, crc16 } from '../src/lib/vietqr';

test('khớp từng ký tự với VietQR chính thức: có số tiền', () => {
  assert.equal(
    chuoiVietQR({ bin: '970448', stk: '1234567890', soTien: 150000, noiDung: 'BG7K2M' }),
    '00020101021238540010A00000072701240006970448011012345678900208QRIBFTTA530370454061500005802VN62100806BG7K2M63041121',
  );
});

test('khớp từng ký tự với VietQR chính thức: không có số tiền (QR tĩnh)', () => {
  assert.equal(
    chuoiVietQR({ bin: '970422', stk: '0000123456789', noiDung: 'ABC123' }),
    '00020101021138570010A00000072701270006970422011300001234567890208QRIBFTTA53037045802VN62100806ABC1236304B590',
  );
});

test('CRC16-CCITT-FALSE đúng giá trị chuẩn ("123456789" -> 29B1)', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('nội dung: bỏ dấu, bỏ ký tự lạ, tối đa 25 ký tự; trống thì bỏ trường 62', () => {
  assert.equal(chuanNoiDung('Đơn hàng #12 – anh Nam'), 'Don hang 12 anh Nam');
  assert.equal(chuanNoiDung('A'.repeat(40)).length, 25);
  assert.ok(!chuoiVietQR({ bin: '970448', stk: '123', soTien: 1000, noiDung: '' }).includes('6208'));
});

test('thiếu / sai ngân hàng hoặc số tài khoản thì không tạo QR', () => {
  assert.equal(chuoiVietQR({ bin: '', stk: '123' }), '');
  assert.equal(chuoiVietQR({ bin: '97044', stk: '123' }), '');
  assert.equal(chuoiVietQR({ bin: '970448', stk: '' }), '');
});
