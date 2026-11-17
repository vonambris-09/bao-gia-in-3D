// Kiểm thử danh sách loại nhựa mới và cách đưa loại cũ về loại mới.
//   npm run test:loai
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, chuanLoai, nhomCua } from '../src/lib/loai-nhua';

test('đủ loại anh cần: PLA/PETG/ABS có CF, GF; TPU có 85A, 90A, 95A', () => {
  for (const x of ['PLA', 'PLA-CF', 'PLA-GF', 'PETG', 'PETG-CF', 'PETG-GF', 'ABS', 'ABS-CF', 'ABS-GF', 'ASA', 'TPU 85A', 'TPU 90A', 'TPU 95A']) {
    assert.ok(CATEGORIES.includes(x), x);
  }
  assert.ok(!CATEGORIES.includes('TPU'));
});

test('loại cũ / viết lệch về đúng mã mới', () => {
  assert.equal(chuanLoai('TPU'), 'TPU 95A');
  assert.equal(chuanLoai('tpu 85a'), 'TPU 85A');
  assert.equal(chuanLoai('PETG CF'), 'PETG-CF');
  assert.equal(chuanLoai('abs-gf'), 'ABS-GF');
  assert.equal(chuanLoai('PETG-CF'), 'PETG-CF');
  assert.equal(chuanLoai(''), 'PLA');
  assert.equal(chuanLoai('Nylon'), 'PLA');
});

test('nhóm của một loại', () => {
  assert.equal(nhomCua('ABS-CF').goc, 'ABS');
  assert.equal(nhomCua('TPU 90A').goc, 'TPU');
  assert.equal(nhomCua('PETG').goc, 'PETG');
});
