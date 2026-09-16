/**
 * Ước tính thời điểm giao hàng dựa trên thời gian in.
 *
 * Logic này được viết trong App.tsx nhưng chưa từng được gọi. Tách ra đây để
 * giữ lại và có thể nối vào phần báo giá sau (P2.1 trong báo cáo review).
 *
 * Giả định hiện tại:
 *  - Khung giờ nhận/setup máy: 07:00 – 20:00
 *  - Máy chạy 24/7 sau khi đã setup
 *  - Khung giờ giao: trước 17:00, muộn hơn thì dời sang 07:00 hôm sau
 */

export function getDeliveryTime(hours: number, minutes: number, safetyBuffer: number): Date {
  const now = new Date();
  const startTime = new Date(now);
  const currentHour = now.getHours();

  // 1. Ngoài giờ setup (20:00 – 07:00) thì bắt đầu từ 07:00 phiên làm việc kế tiếp
  if (currentHour >= 20) {
    startTime.setDate(now.getDate() + 1);
    startTime.setHours(7, 0, 0, 0);
  } else if (currentHour < 7) {
    startTime.setHours(7, 0, 0, 0);
  }

  // 2. Máy chạy liên tục
  const deliveryTime = new Date(startTime.getTime());
  deliveryTime.setHours(deliveryTime.getHours() + hours + safetyBuffer);
  deliveryTime.setMinutes(deliveryTime.getMinutes() + minutes);

  // 3. Xong sau 17:00 thì giao 07:00 hôm sau
  const deliveryHour = deliveryTime.getHours();
  if (deliveryHour >= 17) {
    deliveryTime.setDate(deliveryTime.getDate() + 1);
    deliveryTime.setHours(7, 0, 0, 0);
  } else if (deliveryHour < 7) {
    deliveryTime.setHours(7, 0, 0, 0);
  }

  return deliveryTime;
}

export function formatDate(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${h}h00 - ${d}/${month}/${y}`;
}
