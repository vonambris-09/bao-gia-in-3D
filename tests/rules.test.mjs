/**
 * Kiểm thử firestore.rules trên Firestore emulator.
 *
 * Bao phủ toàn bộ 12 payload trong security_spec.md, cộng thêm nhóm test
 * "đường đi bình thường" để chắc chắn rules mới không làm app hỏng.
 *
 * Chạy:  npm run test:rules
 */

import { readFileSync } from 'node:fs';
import test, { before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

import {
  doc, setDoc, getDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

const ADMIN_EMAIL = 'vonam.bris@gmail.com';
const ADMIN_UID = 'admin-uid-001';
const STRANGER_UID = 'stranger-uid-002';

let testEnv;
let adminDb;      // admin đã đăng nhập, email khớp allowlist
let strangerDb;   // tài khoản Google hợp lệ nhưng không nằm trong allowlist
let unauthDb;     // chưa đăng nhập
let unverifiedDb; // đúng email nhưng chưa xác minh

const validMaterial = (over = {}) => ({
  name: 'PLA Standard',
  brand: 'eSUN',
  color: 'Trắng',
  colorHex: '#ffffff',
  category: 'PLA',
  pricePerKg: 315000,
  inStock: true,
  ownerId: ADMIN_UID,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const validSettings = (over = {}) => ({
  machinePowerW: 200,
  electricityPriceKwh: 5000,
  depreciationPerHour: 4000,
  serviceNotes: 'Lưu ý dịch vụ in 3D',
  ownerId: ADMIN_UID,
  ...over,
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-baogia-in-3d',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  adminDb = testEnv.authenticatedContext(ADMIN_UID, {
    email: ADMIN_EMAIL, email_verified: true,
  }).firestore();

  strangerDb = testEnv.authenticatedContext(STRANGER_UID, {
    email: 'nguoila@example.com', email_verified: true,
  }).firestore();

  unauthDb = testEnv.unauthenticatedContext().firestore();

  unverifiedDb = testEnv.authenticatedContext('unverified-uid', {
    email: ADMIN_EMAIL, email_verified: false,
  }).firestore();
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Gieo sẵn dữ liệu thuộc về admin, bỏ qua rules
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'materials', 'mat-1'), {
      name: 'PETG Standard', brand: 'Overture', color: 'Đen', colorHex: '#000000',
      category: 'PETG', pricePerKg: 350000, inStock: true,
      ownerId: ADMIN_UID, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    });
    await setDoc(doc(db, 'settings', ADMIN_UID), {
      machinePowerW: 200, electricityPriceKwh: 5000,
      depreciationPerHour: 4000, ownerId: ADMIN_UID,
    });
  });
});

// ===========================================================================
// P0.1 — Chỉ email trong allowlist mới dùng được app
// ===========================================================================
describe('P0.1 · Cổng đăng nhập theo allowlist', () => {

  test('người lạ có tài khoản Google KHÔNG tạo được vật liệu', async () => {
    await assertFails(setDoc(
      doc(strangerDb, 'materials', 'x1'),
      validMaterial({ ownerId: STRANGER_UID })
    ));
  });

  test('người lạ KHÔNG tạo được settings riêng (tiêu quota)', async () => {
    await assertFails(setDoc(
      doc(strangerDb, 'settings', STRANGER_UID),
      validSettings({ ownerId: STRANGER_UID })
    ));
  });

  test('email đúng nhưng chưa xác minh thì bị chặn', async () => {
    await assertFails(setDoc(
      doc(unverifiedDb, 'materials', 'x2'),
      validMaterial({ ownerId: 'unverified-uid' })
    ));
  });

  test('chưa đăng nhập thì không đọc được gì', async () => {
    await assertFails(getDoc(doc(unauthDb, 'materials', 'mat-1')));
  });

  test('/test/connection không còn mở công khai', async () => {
    await assertFails(getDoc(doc(unauthDb, 'test', 'connection')));
  });
});

// ===========================================================================
// security_spec.md — Dirty Dozen
// ===========================================================================
describe('security_spec · 12 payload', () => {

  test('#1 authRequired — tạo vật liệu khi chưa đăng nhập', async () => {
    await assertFails(setDoc(doc(unauthDb, 'materials', 'x'), validMaterial()));
  });

  test('#2 identitySpoofing — tạo vật liệu mang ownerId người khác', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'x'),
      validMaterial({ ownerId: STRANGER_UID })
    ));
  });

  test('#3 immutabilityViolation — update đổi ownerId (LỖ HỔNG CỦA RULES CŨ)', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { ownerId: STRANGER_UID },
      { merge: true }
    ));
  });

  test('#4 resourcePoisoning — nhét chuỗi dài vào field số của settings', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'settings', ADMIN_UID),
      validSettings({ machinePowerW: 'x'.repeat(5000) })
    ));
  });

  test('#5 dosAttack — chuỗi 1MB trong field name', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'x'),
      validMaterial({ name: 'A'.repeat(1_000_000) })
    ));
  });

  test('#6 temporalIntegrity — client tự đặt createdAt trong tương lai', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'x'),
      validMaterial({ createdAt: new Date('2030-01-01') })
    ));
  });

  test('#6b temporalIntegrity — update cố sửa createdAt', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { createdAt: new Date('2030-01-01') },
      { merge: true }
    ));
  });

  test('#7 relationalViolation — người lạ sửa vật liệu của admin', async () => {
    await assertFails(setDoc(
      doc(strangerDb, 'materials', 'mat-1'),
      { pricePerKg: 1 },
      { merge: true }
    ));
  });

  test('#8 piiLeak — người lạ đọc vật liệu của admin', async () => {
    await assertFails(getDoc(doc(strangerDb, 'materials', 'mat-1')));
  });

  test('#9 queryScraping — liệt kê toàn bộ materials không lọc ownerId', async () => {
    await assertFails(getDocs(collection(adminDb, 'materials')));
  });

  test('#10 unauthorizedDeletion — người lạ xoá vật liệu của admin', async () => {
    await assertFails(deleteDoc(doc(strangerDb, 'materials', 'mat-1')));
  });

  test('#11 privilegeEscalation — nhét isAdmin:true vào settings', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'settings', ADMIN_UID),
      { ...validSettings(), isAdmin: true }
    ));
  });

  test('#12 schemaViolation — colorHex sai định dạng', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'x'),
      validMaterial({ colorHex: 'không-phải-mã-màu' })
    ));
  });
});

// ===========================================================================
// Ràng buộc bổ sung
// ===========================================================================
describe('Ràng buộc bổ sung', () => {

  test('giá âm bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'materials', 'x'), validMaterial({ pricePerKg: -1 })));
  });

  test('giá bằng 0 bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'materials', 'x'), validMaterial({ pricePerKg: 0 })));
  });

  test('giá dạng chuỗi bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'materials', 'x'), validMaterial({ pricePerKg: '350000' })));
  });

  test('tên rỗng bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'materials', 'x'), validMaterial({ name: '' })));
  });

  test('inStock sai kiểu bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'materials', 'x'), validMaterial({ inStock: 'có' })));
  });

  test('ảnh base64 vượt 900KB bị từ chối (trần 1MiB của Firestore)', async () => {
    await assertFails(setDoc(
      doc(adminDb, 'materials', 'x'),
      validMaterial({ imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(950_000) })
    ));
  });

  test('settings ghi vào document của UID khác bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'settings', STRANGER_UID), validSettings()));
  });

  test('ghi vào collection lạ bị từ chối', async () => {
    await assertFails(setDoc(doc(adminDb, 'quotes', 'q1'), { total: 1000 }));
  });
});

// ===========================================================================
// Đường đi bình thường — app PHẢI vẫn chạy được
// ===========================================================================
describe('Hồi quy · thao tác hằng ngày vẫn chạy', () => {

  test('admin tạo vật liệu hợp lệ', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'materials', 'new-1'), validMaterial()));
  });

  test('admin liệt kê kho của mình (query có where ownerId)', async () => {
    await assertSucceeds(getDocs(query(
      collection(adminDb, 'materials'),
      where('ownerId', '==', ADMIN_UID)
    )));
  });

  test('admin đọc một vật liệu của mình', async () => {
    await assertSucceeds(getDoc(doc(adminDb, 'materials', 'mat-1')));
  });

  test('admin sửa giá (merge, giống handleMaterialUpdate)', async () => {
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { pricePerKg: 380000, updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('admin bật/tắt còn hàng', async () => {
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { inStock: false, updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('admin tải ảnh base64 kích thước thực tế (~150KB)', async () => {
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(150_000), updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('admin xoá vật liệu của mình', async () => {
    await assertSucceeds(deleteDoc(doc(adminDb, 'materials', 'mat-1')));
  });

  test('admin lưu settings', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'settings', ADMIN_UID), validSettings()));
  });

  test('settings chấp nhận các field dự phòng của đợt 2', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'settings', ADMIN_UID), validSettings({
      markupMultiplier: 2.25,
      wastagePercent: 10,
      minimumCharge: 30000,
      laborCostPerHour: 50000,
    })));
  });

  test('dữ liệu cũ thiếu brand/category/colorHex vẫn sửa được', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'materials', 'legacy'), {
        name: 'Nhựa cũ', pricePerKg: 300000, ownerId: ADMIN_UID,
        createdAt: new Date('2025-06-01'),
      });
    });
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'legacy'),
      { pricePerKg: 320000, updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('dữ liệu cũ KHÔNG có field createdAt vẫn sửa được', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'materials', 'no-created-at'), {
        name: 'Nhựa rất cũ', pricePerKg: 280000, ownerId: ADMIN_UID,
      });
    });
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'no-created-at'),
      { pricePerKg: 290000, updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('handleSyncToFirebase: tạo doc mới với createdAt do server đặt', async () => {
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'offline-created'),
      { ...validMaterial(), createdAt: serverTimestamp() },
      { merge: true }
    ));
  });

  test('handleSyncToFirebase: cập nhật doc sẵn có, không đụng createdAt', async () => {
    await assertSucceeds(setDoc(
      doc(adminDb, 'materials', 'mat-1'),
      { name: 'PETG Standard', pricePerKg: 350000, ownerId: ADMIN_UID, updatedAt: serverTimestamp() },
      { merge: true }
    ));
  });
});

test('bộ test đã chạy trên emulator', () => {
  assert.ok(testEnv, 'test environment phải được khởi tạo');
});
