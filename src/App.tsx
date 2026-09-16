/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon, Box, Printer, Info, Camera, Plus, Trash2, X,
  Save, LogIn, LogOut, User as UserIcon, Loader2, Eye, ArrowLeft, XCircle,
  Sparkles, Edit2, Copy, Check, Search, Moon, Sun, FileDown, RefreshCw,
  Calculator, Layers, Package, Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
  serverTimestamp, getDocs,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

import { cn, formatCurrency } from '@/lib/utils';
import { auth, db, signIn, logOut, handleFirestoreError } from '@/lib/firebase';
import { useTheme } from '@/lib/theme';
import { Material, SystemSettings, QuoteParams, CalculationResult, DEFAULT_MARKUP } from './types';
import { QuoteSheet } from './components/QuoteSheet';
import {
  Card, Field, TextInput, NumberInput, Select, Button, Segmented,
  Switch, Sheet, Empty, spring, springSoft,
} from './components/ui';

/* ==========================================================================
   Hằng số
   ========================================================================== */

const CATEGORIES = ['PLA', 'PETG', 'PETG-CF', 'ABS', 'ASA', 'TPU'] as const;

const BANK = { name: 'NGÂN HÀNG OCB', holder: 'VO THANH NAM', number: '0344970774', bin: '970448' };

const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const INITIAL_MATERIALS: Material[] = [
  { id: '1', name: 'PLA Standard', brand: 'eSUN', pricePerKg: 315000, color: 'Trắng', colorHex: '#ffffff', ownerId: 'system', category: 'PLA', inStock: true },
  { id: '2', name: 'PETG Standard', brand: 'Overture', pricePerKg: 350000, color: 'Đen', colorHex: '#000000', ownerId: 'system', category: 'PETG', inStock: true },
  { id: '3', name: 'ABS Premium', brand: 'Flashforge', pricePerKg: 315000, color: 'Xám', colorHex: '#808080', ownerId: 'system', category: 'ABS', inStock: true },
  { id: '4', name: 'ASA Heavy', brand: 'Polymaker', pricePerKg: 450000, color: 'Đen', colorHex: '#000000', ownerId: 'system', category: 'ASA', inStock: true },
];

const MATERIAL_CHARACTERISTICS: Record<string, string> = {
  'PETG': 'Nhựa có độ bền và độ cứng khá tốt. Chịu nhiệt dưới 65°C. Bề mặt bóng , nhựa có tính trong suốt , xuyên sáng (tùy màu).',
  'PLA': 'Nhựa thân thiện môi trường, dễ in, nhiều màu đẹp. Độ cứng tốt nhưng giòn, chịu nhiệt dưới 50°C. Tự phân hủy sau một thời gian',
  'ASA': 'Chuyên dụng ngoài trời, kháng tia UV. Độ bền cơ học cao, chịu nhiệt tới 110°C và giữ màu lâu dưới tác động thời tiết.',
  'PETG-CF': 'Nhựa kỹ thuật gia cường sợi Carbon, độ cứng rất tốt. Bề mặt nhám mờ sang trọng, ổn định kích thước cao.',
  'ABS': 'Nhựa kỹ thuật bền bỉ, chịu va đập cực tốt, chịu nhiệt cao tới 90°C. Khó in , dễ cong vênh, dễ gia công hậu kỳ.',
  'TPU': 'Nhựa dẻo đàn hồi như cao su ( tùy mã ). Chống mài mòn, chống va đập và chịu uốn cong hoàn hảo. Khó in, giá thành cao',
};

const DEFAULT_SERVICE_NOTES = `Lưu ý dịch vụ in 3D

• Đặc điểm kỹ thuật: Sản phẩm in 3D FDM có thể có các vân layer nhỏ trên bề mặt, đây là đặc tính bình thường của công nghệ.
• Độ chính xác: Sai số kích thước ±0.2mm là bình thường, phù hợp cho hầu hết ứng dụng. Cửa hàng in theo file quý khách gửi, cần lưu ý gì quý khách phải báo trước khi chạy file (trước khi thanh toán)
• Bề mặt:
- Tại các bề mặt cần support sẽ có vết, có thể xử lý bằng giấy nhám mịn.
- Vết đường nối lớp (seam) chạy dọc theo thành sản phẩm.
- Một số bề mặt có thể hơi gợn nhẹ do giới hạn của công nghệ FDM.
- Các mẫu in có kích thước lớn quá 100g nhựa có thể xuất hiện vài vệt nhỏ.
• Cấu trúc: Sản phẩm có cấu trúc infill bên trong, không đặc 100% để tối ưu chi phí và thời gian.`;

/* ==========================================================================
   Ô chọn màu
   ========================================================================== */

const ColorPicker = ({ defaultColor, onBlur }: { defaultColor: string; onBlur: (hex: string) => void }) => {
  const [color, setColor] = useState(defaultColor);
  return (
    <div
      className="w-10 h-10 rounded-xl relative border border-line overflow-hidden shadow-card shrink-0"
      style={{ backgroundColor: color }}
    >
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        onBlur={() => onBlur(color)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Chọn mã màu"
      />
    </div>
  );
};

/* ==========================================================================
   Ứng dụng
   ========================================================================== */

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'quote' | 'inventory'>('quote');
  const [showShowroom, setShowShowroom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showroomCategory, setShowroomCategory] = useState('PLA');
  const [quoteCategory, setQuoteCategory] = useState(() => localStorage.getItem('lastQuoteCategory') || 'PLA');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadedQrUrl, setLoadedQrUrl] = useState('');
  const quoteRef = useRef<HTMLDivElement>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const local = localStorage.getItem('local_settings');
    return local ? JSON.parse(local) : {
      machinePowerW: 200,
      electricityPriceKwh: 5000,
      depreciationPerHour: 4000,
      markupMultiplier: DEFAULT_MARKUP,
      serviceNotes: DEFAULT_SERVICE_NOTES,
    };
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const local = localStorage.getItem('local_materials');
    return local ? JSON.parse(local) : [];
  });

  const [pendingSync, setPendingSync] = useState(() => localStorage.getItem('pending_sync') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'in' | 'out'>('all');

  const reportWriteError = (e: any, what: string) => {
    if (e?.code === 'permission-denied') {
      setPermissionError(
        `Firestore từ chối thao tác "${what}". Kiểm tra: (1) đang đăng nhập đúng email admin, ` +
        `(2) firestore.rules đã deploy, (3) dữ liệu hợp lệ (giá > 0, tên không rỗng).`
      );
    }
  };

  const [params, setParams] = useState<QuoteParams>(() => {
    const saved = localStorage.getItem('lastQuoteParams');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* hỏng thì dùng mặc định */ }
    }
    return {
      materialId: '', hours: 10, minutes: 14, weightG: 394,
      infillPercent: 20, layerHeightMm: 0.2, extraFee: 10000, note: generateShortId(),
    };
  });

  const quoteCategoryRef = useRef(quoteCategory);
  useEffect(() => { quoteCategoryRef.current = quoteCategory; }, [quoteCategory]);

  /* ---------------------------------------------------------------- Auth */
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); }), []);

  /* ------------------------------------------------------ Đồng bộ settings */
  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(doc(db, 'settings', user.uid), snapshot => {
      let finalData = snapshot.exists() ? (snapshot.data() as SystemSettings) : null;
      if (localStorage.getItem('pending_sync') === 'true') {
        const localStr = localStorage.getItem('local_settings');
        if (localStr) finalData = JSON.parse(localStr);
      }
      if (finalData) {
        setSystemSettings(finalData);
        localStorage.setItem('local_settings', JSON.stringify(finalData));
      }
    });
  }, [user?.uid]);

  /* ----------------------------------------------------- Đồng bộ kho nhựa */
  useEffect(() => {
    if (!user?.uid) { setMaterials([]); return; }
    const q = query(collection(db, 'materials'), where('ownerId', '==', user.uid));
    return onSnapshot(q, snapshot => {
      const serverItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material));
      let finalItems = serverItems;

      if (localStorage.getItem('pending_sync') === 'true') {
        const localStr = localStorage.getItem('local_materials');
        const deletedIds = JSON.parse(localStorage.getItem('local_deleted') || '[]');
        if (localStr) {
          const localItems: Material[] = JSON.parse(localStr);
          const mergedMap = new Map<string, Material>();
          serverItems.forEach(item => { if (!deletedIds.includes(item.id)) mergedMap.set(item.id, item); });
          localItems.forEach(item => { if (!deletedIds.includes(item.id)) mergedMap.set(item.id, item); });
          finalItems = Array.from(mergedMap.values());
        }
      }

      finalItems.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now();
        return timeB - timeA;
      });

      setMaterials(finalItems);
      localStorage.setItem('local_materials', JSON.stringify(finalItems));

      setParams(p => {
        const current = finalItems.find(m => m.id === p.materialId);
        if (!p.materialId || !current) {
          const firstInCat = finalItems.find(m => (m.category || 'PLA') === quoteCategoryRef.current);
          if (firstInCat) return { ...p, materialId: firstInCat.id };
        }
        return p;
      });
    }, error => {
      console.error('Firestore sync error:', error);
      setPermissionError(`Không tải được kho nhựa: ${error.message}`);
    });
  }, [user?.uid]);

  useEffect(() => { localStorage.setItem('lastQuoteParams', JSON.stringify(params)); }, [params]);
  useEffect(() => { localStorage.setItem('lastQuoteCategory', quoteCategory); }, [quoteCategory]);

  /* ------------------------------------------------------- Ghi lên Cloud */
  const enableOfflineMode = () => {
    setPendingSync(true);
    localStorage.setItem('pending_sync', 'true');
  };

  const safeCloudWrite = async (writePromise: Promise<any>) => {
    try {
      await Promise.race([
        writePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
    } catch (e: any) {
      if (e.message === 'timeout' || e.code === 'resource-exhausted') enableOfflineMode();
      throw e;
    }
  };

  const handleSyncToFirebase = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const q = query(collection(db, 'materials'), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const remoteIds = snap.docs.map(d => d.id);
      const localIds = materials.map(m => m.id);

      const deletePromises = remoteIds
        .filter(id => !localIds.includes(id))
        .map(id => deleteDoc(doc(db, 'materials', id)));

      // createdAt phải luôn do server đặt: rules chặn timestamp client tự bịa
      // khi create, và chặn sửa createdAt khi update.
      const writePromises = materials.map(m => {
        const { createdAt: _clientCreatedAt, ...rest } = m;
        const isNewOnServer = !remoteIds.includes(m.id);
        return setDoc(
          doc(db, 'materials', m.id),
          {
            ...rest,
            ownerId: user.uid,
            ...(isNewOnServer ? { createdAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      const settingsPromise = setDoc(doc(db, 'settings', user.uid), { ...systemSettings, ownerId: user.uid });

      await Promise.all([...deletePromises, ...writePromises, settingsPromise]);

      setPendingSync(false);
      localStorage.setItem('pending_sync', 'false');
      localStorage.setItem('local_deleted', '[]');
    } catch (e: any) {
      console.error('Sync Error:', e);
      setPermissionError(`Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettings = async (newSettings: SystemSettings) => {
    if (!user) return;
    setSystemSettings(newSettings);
    localStorage.setItem('local_settings', JSON.stringify(newSettings));
    try {
      await safeCloudWrite(setDoc(doc(db, 'settings', user.uid), { ...newSettings, ownerId: user.uid }));
    } catch (e) {
      reportWriteError(e, 'lưu cài đặt');
    }
  };

  const patchSettings = (patch: Partial<SystemSettings>) =>
    setSystemSettings(s => ({ ...s, ...patch }));

  /* ------------------------------------------------------------ Tính giá */
  const selectedMaterial = materials.find(m => m.id === params.materialId);
  const markup = systemSettings.markupMultiplier ?? DEFAULT_MARKUP;

  const results = useMemo<CalculationResult>(() => {
    if (!selectedMaterial) {
      return { materialCost: 0, electricityCost: 0, depreciationCost: 0, internalTotal: 0, customerTotal: 0 };
    }
    const totalHours = params.hours + params.minutes / 60;
    const materialCost = (params.weightG / 1000) * selectedMaterial.pricePerKg;
    const electricityCost = (systemSettings.machinePowerW / 1000) * systemSettings.electricityPriceKwh * totalHours;
    const depreciationCost = systemSettings.depreciationPerHour * totalHours;

    const internalTotal = Math.round((materialCost + electricityCost + depreciationCost) / 1000) * 1000;
    const customerTotal = Math.ceil((internalTotal * markup + params.extraFee) / 1000) * 1000;

    return { materialCost, electricityCost, depreciationCost, internalTotal, customerTotal };
  }, [params, systemSettings, selectedMaterial, markup]);

  const qrUrl = `https://qr.limcorp.vn/qrcode.png?bank=${BANK.bin}&number=${BANK.number}&amount=${results.customerTotal}&content=${encodeURIComponent(params.note)}`;
  const qrLoading = loadedQrUrl !== qrUrl;

  /* ------------------------------------------------------------- Xuất file */
  const renderPng = async () => {
    const htmlToImage = await import('html-to-image');
    return htmlToImage.toPng(quoteRef.current!, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
  };

  const handleExportImage = async () => {
    if (!quoteRef.current || qrLoading) return;
    try {
      setIsExporting(true);
      const dataUrl = await renderPng();
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (e) {
      console.error('Copy to clipboard failed', e);
      setPermissionError('Không sao chép được ảnh. Trình duyệt có thể chưa cấp quyền clipboard.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!quoteRef.current || qrLoading) return;
    try {
      setIsExporting(true);
      const [{ jsPDF }, dataUrl] = await Promise.all([import('jspdf'), renderPng()]);
      const img = new Image();
      img.src = dataUrl;
      await new Promise(res => { img.onload = res; });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [img.width / 2, img.height / 2] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width / 2, img.height / 2);
      pdf.save(`BAO_GIA_${params.note || 'IN3D'}.pdf`);
    } catch (e) {
      console.error('Export PDF failed', e);
      setPermissionError('Không xuất được PDF. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  /* ------------------------------------------------------------ Kho nhựa */
  const handleMaterialAdd = async (materialData: Partial<Material>) => {
    if (!user) { setPermissionError('Vui lòng đăng nhập để thực hiện tính năng này.'); return; }

    const materialRef = doc(collection(db, 'materials'));
    const id = materialRef.id;
    const newMaterial: Material = {
      name: materialData.name || 'Nhựa Mới',
      brand: materialData.brand || 'No name',
      pricePerKg: materialData.pricePerKg || 300000,
      color: materialData.color || 'Chưa đặt màu',
      colorHex: materialData.colorHex || '#3b82f6',
      category: materialData.category || quoteCategory,
      inStock: materialData.inStock ?? true,
      id,
      ownerId: user.uid,
      createdAt: { seconds: Date.now() / 1000 } as any,
      updatedAt: { seconds: Date.now() / 1000 } as any,
    };

    const next = [newMaterial, ...materials];
    setMaterials(next);
    localStorage.setItem('local_materials', JSON.stringify(next));

    try {
      await safeCloudWrite(setDoc(materialRef, { ...newMaterial, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    } catch (e: any) {
      reportWriteError(e, 'thêm vật liệu');
    }
  };

  const handleMaterialUpdate = async (id: string, updates: Partial<Material>) => {
    if (!user) return;
    const next = materials.map(m => (m.id === id ? { ...m, ...updates, updatedAt: { seconds: Date.now() / 1000 } as any } : m));
    setMaterials(next);
    localStorage.setItem('local_materials', JSON.stringify(next));
    try {
      await safeCloudWrite(setDoc(doc(db, 'materials', id), { ...updates, updatedAt: serverTimestamp() }, { merge: true }));
    } catch (e: any) {
      reportWriteError(e, 'sửa vật liệu');
    }
  };

  const handleMaterialDelete = async (id: string) => {
    if (!user) return;
    const next = materials.filter(m => m.id !== id);
    setMaterials(next);
    localStorage.setItem('local_materials', JSON.stringify(next));

    const deletedIds = JSON.parse(localStorage.getItem('local_deleted') || '[]');
    localStorage.setItem('local_deleted', JSON.stringify([...deletedIds, id]));

    try {
      await safeCloudWrite(deleteDoc(doc(db, 'materials', id)));
    } catch (e) {
      reportWriteError(e, 'xoá vật liệu');
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    try {
      await Promise.all(INITIAL_MATERIALS.map(m => {
        const ref = doc(collection(db, 'materials'));
        return setDoc(ref, { ...m, id: ref.id, ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }));
    } catch (e) {
      handleFirestoreError(e, 'create', 'materials/batch');
    }
  };

  const handleImagePick = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
        else if (height > MAX) { width *= MAX / height; height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        handleMaterialUpdate(id, { imageUrl: canvas.toDataURL('image/jpeg', 0.8) });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const filteredMaterials = useMemo(() => materials.filter(m => {
    const q = inventorySearch.toLowerCase();
    const searchMatch = !q ||
      m.brand?.toLowerCase().includes(q) ||
      m.color?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q);
    const stockMatch = inventoryStockFilter === 'all' ||
      (inventoryStockFilter === 'in' && m.inStock !== false) ||
      (inventoryStockFilter === 'out' && m.inStock === false);
    return searchMatch && stockMatch;
  }), [materials, inventorySearch, inventoryStockFilter]);

  const categoryMaterials = materials.filter(m => (m.category || 'PLA') === quoteCategory);
  const serviceNotes = systemSettings.serviceNotes || DEFAULT_SERVICE_NOTES;

  /* ==========================================================================
     Giao diện
     ========================================================================== */

  return (
    <div data-themed className="min-h-screen bg-app text-ink font-sans flex flex-col">

      {/* ---------------------------------------------------------- Header */}
      <header
        data-themed
        className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-line"
      >
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand rounded-xl flex items-center justify-center text-brand-ink shrink-0 shadow-card">
              <Printer size={17} strokeWidth={2.5} />
            </div>
            <span className="font-black text-brand text-lg sm:text-xl tracking-tight truncate">PLASTICALC</span>
          </div>

          {/* Tab trên máy tính */}
          <div className="hidden md:block">
            <Segmented<'quote' | 'inventory'>
              layoutId="tab-desktop"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'quote', label: 'Báo giá', icon: <Calculator size={13} /> },
                { value: 'inventory', label: 'Kho nhựa', icon: <Package size={13} /> },
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <AnimatePresence>
              {pendingSync && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.8, width: 0 }}
                  transition={spring}
                >
                  <Button variant="warn" size="sm" onClick={handleSyncToFirebase} disabled={isSyncing}
                    icon={isSyncing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}>
                    <span className="hidden sm:inline">{isSyncing ? 'Đang đồng bộ' : 'Đồng bộ'}</span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <Button variant="ghost" size="sm" onClick={() => setShowShowroom(true)} className="!p-2 rounded-full" aria-label="Showroom">
              <Eye size={17} />
            </Button>

            {user && (
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="!p-2 rounded-full" aria-label="Cài đặt">
                <SettingsIcon size={17} />
              </Button>
            )}

            {/* Nút đổi sáng/tối */}
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="!p-2 rounded-full overflow-hidden" aria-label="Đổi giao diện sáng/tối">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ y: -16, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 16, opacity: 0, rotate: 90 }}
                  transition={spring}
                  className="block"
                >
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </motion.span>
              </AnimatePresence>
            </Button>

            <div className="w-px h-5 bg-line mx-0.5 hidden sm:block" />

            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-[10px] font-black text-ink-soft bg-surface-2 border border-line px-2.5 py-1.5 rounded-lg uppercase tracking-wider max-w-[130px] truncate">
                  {user.email?.split('@')[0]}
                </span>
                <Button variant="ghost" size="sm" onClick={() => logOut()} className="!p-2 rounded-full text-danger" aria-label="Đăng xuất">
                  <LogOut size={16} />
                </Button>
              </div>
            ) : (
              <Button variant="brand" size="sm" onClick={() => signIn()} icon={<LogIn size={13} />}>
                Admin
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------- Banner lỗi */}
      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className="overflow-hidden"
          >
            <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-3 flex items-start gap-3 bg-danger/10 border-b border-danger/25">
              <XCircle size={16} className="text-danger shrink-0 mt-0.5" />
              <p className="flex-1 text-xs font-bold text-danger leading-relaxed">{permissionError}</p>
              <button onClick={() => setPermissionError(null)} className="p-1 text-danger/60 hover:text-danger shrink-0" aria-label="Đóng">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------- Nội dung */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 md:pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            {activeTab === 'quote' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_290px] gap-4 sm:gap-5 items-start">

                {/* ------- Cột nhập liệu ------- */}
                <div className="space-y-4 sm:space-y-5">
                  <Card title="Vật liệu" icon={<Layers size={13} />}>
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Loại nhựa">
                          <Select
                            value={quoteCategory}
                            onChange={e => {
                              const cat = e.target.value;
                              setQuoteCategory(cat);
                              const first = materials.find(m => (m.category || 'PLA') === cat);
                              if (first) setParams(p => ({ ...p, materialId: first.id }));
                            }}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </Field>
                        <Field label="Giá nhựa / kg">
                          <div className="w-full bg-brand-soft border border-line rounded-xl px-3.5 py-2.5 text-sm font-black text-brand truncate">
                            {formatCurrency(selectedMaterial?.pricePerKg || 0)}
                          </div>
                        </Field>
                      </div>

                      <Field label="Cuộn nhựa trong kho" hint={`${categoryMaterials.length} loại`}>
                        <Select
                          value={params.materialId}
                          onChange={e => setParams({ ...params, materialId: e.target.value })}
                        >
                          {categoryMaterials.map(m => (
                            <option key={m.id} value={m.id} disabled={m.inStock === false}>
                              {m.brand} — {m.color}{m.inStock === false ? ' (HẾT HÀNG)' : ''}
                            </option>
                          ))}
                          {categoryMaterials.length === 0 && <option value="">(Trống)</option>}
                        </Select>
                      </Field>
                    </div>
                  </Card>

                  <Card title="Thông số bản in" icon={<Box size={13} />}>
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Giờ in">
                          <NumberInput value={params.hours} onChange={e => setParams({ ...params, hours: Number(e.target.value) })} />
                        </Field>
                        <Field label="Phút">
                          <NumberInput value={params.minutes} onChange={e => setParams({ ...params, minutes: Number(e.target.value) })} />
                        </Field>
                        <Field label="Khối lượng (g)">
                          <NumberInput value={params.weightG} onChange={e => setParams({ ...params, weightG: Number(e.target.value) })} />
                        </Field>
                        <Field label="Lớp (mm)">
                          <Select value={params.layerHeightMm} onChange={e => setParams({ ...params, layerHeightMm: Number(e.target.value) })}>
                            {[0.1, 0.12, 0.16, 0.2, 0.24, 0.28, 0.3, 0.4].map(v => <option key={v} value={v}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Infill (%)">
                          <NumberInput value={params.infillPercent} onChange={e => setParams({ ...params, infillPercent: Number(e.target.value) })} />
                        </Field>
                        <Field label="Phụ phí (đ)">
                          <NumberInput value={params.extraFee} onChange={e => setParams({ ...params, extraFee: Number(e.target.value) })} />
                        </Field>
                      </div>

                      <Field label="Nội dung chuyển khoản">
                        <div className="flex gap-2">
                          <TextInput
                            value={params.note}
                            onChange={e => setParams({ ...params, note: e.target.value.toUpperCase() })}
                            className="tracking-[0.2em] font-black"
                          />
                          <Button variant="plain" onClick={() => setParams({ ...params, note: generateShortId() })} className="!px-3 shrink-0" aria-label="Tạo mã mới">
                            <RefreshCw size={15} />
                          </Button>
                        </div>
                      </Field>
                    </div>
                  </Card>

                  {/* Tổng kết giá */}
                  <Card className="bg-surface-2">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                        <span>Giá vốn nội bộ</span>
                        <span className="text-ink font-black">{results.internalTotal.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                        <span>Hệ số nhân</span>
                        <button onClick={() => setShowSettings(true)} className="text-brand font-black hover:underline">
                          × {markup}
                        </button>
                      </div>
                      <div className="h-px bg-line" />
                      <div className="flex justify-between items-end">
                        <span className="text-[11px] font-black uppercase text-brand tracking-wider">Tổng báo giá</span>
                        <motion.span
                          key={results.customerTotal}
                          initial={{ scale: 0.92, opacity: 0.5 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={spring}
                          className="text-2xl font-black text-brand"
                        >
                          {results.customerTotal.toLocaleString('vi-VN')} đ
                        </motion.span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* ------- Phiếu báo giá ------- */}
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Button variant="plain" size="sm" onClick={() => setIsEditingNotes(v => !v)} icon={<Edit2 size={13} />} disabled={!user}>
                        {isEditingNotes ? 'Đang sửa lưu ý' : 'Sửa lưu ý'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="plain" size="sm" onClick={handleExportPDF} disabled={qrLoading || isExporting}
                        icon={isExporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}>
                        PDF
                      </Button>
                      <Button
                        variant={isCopying ? 'plain' : 'brand'}
                        size="sm"
                        onClick={handleExportImage}
                        disabled={qrLoading || isExporting}
                        className={cn(isCopying && '!bg-ok !text-white')}
                        icon={isCopying ? <Check size={13} /> : <Copy size={13} />}
                      >
                        {isCopying ? 'Đã chép' : 'Chép ảnh'}
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isEditingNotes && user && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={springSoft}
                        className="overflow-hidden"
                      >
                        <Card className="mb-1">
                          <textarea
                            value={serviceNotes}
                            onChange={e => patchSettings({ serviceNotes: e.target.value })}
                            className="w-full min-h-[180px] bg-surface-2 border border-line rounded-xl p-3.5 text-sm font-medium text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3.5px_var(--ring)] transition-[box-shadow,border-color]"
                          />
                          <div className="flex justify-end mt-3">
                            <Button variant="brand" size="sm" icon={<Save size={13} />}
                              onClick={() => { saveSettings(systemSettings); setIsEditingNotes(false); }}>
                              Lưu lưu ý
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <QuoteSheet
                    ref={quoteRef}
                    params={params}
                    material={selectedMaterial}
                    results={results}
                    category={quoteCategory}
                    characteristics={MATERIAL_CHARACTERISTICS[quoteCategory] || 'Chọn loại nhựa để xem đặc tính.'}
                    serviceNotes={serviceNotes}
                    qrUrl={qrUrl}
                    qrLoading={qrLoading}
                    onQrLoad={() => setLoadedQrUrl(qrUrl)}
                    bank={BANK}
                  />
                </div>

                {/* ------- Kho tham khảo (chỉ màn hình rộng) ------- */}
                <Card
                  title="Kho tham khảo"
                  icon={<Box size={13} />}
                  className="hidden xl:flex flex-col max-h-[calc(100vh-7.5rem)] sticky top-[5.5rem]"
                  padded={false}
                >
                  <div className="px-4 pb-3">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                      <TextInput
                        placeholder="Tìm nhựa..."
                        value={inventorySearch}
                        onChange={e => setInventorySearch(e.target.value)}
                        className="!py-2 !pl-8 !text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 space-y-2.5">
                    {filteredMaterials.map(m => (
                      <MaterialPill
                        key={m.id}
                        m={m}
                        active={params.materialId === m.id}
                        onClick={() => {
                          if (m.inStock === false) return;
                          setQuoteCategory(m.category || 'PLA');
                          setParams(p => ({ ...p, materialId: m.id }));
                        }}
                      />
                    ))}
                    {filteredMaterials.length === 0 && (
                      <p className="text-center text-xs text-ink-faint py-8 font-bold uppercase tracking-wider">Trống</p>
                    )}
                  </div>

                  <div className="px-4 pb-4 pt-3 border-t border-line">
                    <div className="bg-brand rounded-xl p-3 text-brand-ink">
                      <p className="text-[10px] font-bold uppercase opacity-80">Thống kê</p>
                      <p className="text-lg font-black tracking-tight">{filteredMaterials.length} loại nhựa</p>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              /* ================= Tab kho nhựa ================= */
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Quản lý kho nhựa</h2>
                    <p className="text-sm font-medium text-ink-soft mt-0.5">Cập nhật vật liệu và bảng giá</p>
                  </div>
                  {user && (
                    <Button variant="brand" onClick={() => handleMaterialAdd({})} icon={<Plus size={16} />}>
                      Thêm nhựa
                    </Button>
                  )}
                </div>

                {user && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                      <TextInput
                        placeholder="Tìm theo hãng, màu hoặc loại nhựa..."
                        value={inventorySearch}
                        onChange={e => setInventorySearch(e.target.value)}
                        className="!pl-10"
                      />
                    </div>
                    <Segmented<'all' | 'in' | 'out'>
                      layoutId="stock-filter"
                      value={inventoryStockFilter}
                      onChange={setInventoryStockFilter}
                      options={[
                        { value: 'all', label: 'Tất cả' },
                        { value: 'in', label: 'Còn hàng' },
                        { value: 'out', label: 'Hết hàng' },
                      ]}
                    />
                  </div>
                )}

                {authLoading ? (
                  <Empty icon={<Loader2 size={38} className="animate-spin" />} title="Đang tải kho nhựa..." />
                ) : !user ? (
                  <Card>
                    <Empty
                      icon={<UserIcon size={44} strokeWidth={1.5} />}
                      title="Chưa đăng nhập"
                      desc="Đăng nhập tài khoản admin để quản lý dữ liệu kho."
                      action={<Button variant="brand" onClick={() => signIn()} icon={<LogIn size={16} />}>Đăng nhập Google</Button>}
                    />
                  </Card>
                ) : materials.length === 0 ? (
                  <Card>
                    <Empty
                      icon={<Box size={44} strokeWidth={1.5} />}
                      title="Kho nhựa trống"
                      desc="Thêm loại nhựa đầu tiên hoặc tạo dữ liệu mẫu để bắt đầu."
                      action={
                        <div className="flex gap-3 flex-wrap justify-center">
                          <Button variant="brand" onClick={() => handleMaterialAdd({})} icon={<Plus size={16} />}>Thêm nhựa</Button>
                          <Button variant="plain" onClick={handleSeedData} icon={<Sparkles size={16} />}>Tạo dữ liệu mẫu</Button>
                        </div>
                      }
                    />
                  </Card>
                ) : filteredMaterials.length === 0 ? (
                  <Card>
                    <Empty icon={<Search size={40} strokeWidth={1.5} />} title="Không tìm thấy" desc="Thử từ khoá hoặc bộ lọc khác." />
                  </Card>
                ) : (
                  <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredMaterials.map(m => (
                        <MaterialCard
                          key={m.id}
                          m={m}
                          confirming={confirmDeleteId === m.id}
                          onAskDelete={() => setConfirmDeleteId(m.id)}
                          onCancelDelete={() => setConfirmDeleteId(null)}
                          onDelete={() => { setConfirmDeleteId(null); handleMaterialDelete(m.id); }}
                          onUpdate={updates => handleMaterialUpdate(m.id, updates)}
                          onPickImage={file => handleImagePick(m.id, file)}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ------------------------------------------------ Thanh tab dưới (mobile) */}
      <nav
        data-themed
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-line pb-safe"
      >
        <div className="flex items-stretch">
          {([
            { id: 'quote', label: 'Báo giá', icon: Calculator },
            { id: 'inventory', label: 'Kho nhựa', icon: Package },
          ] as const).map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-2.5"
              >
                {active && (
                  <motion.span layoutId="tab-mobile" transition={springSoft}
                    className="absolute top-0 inset-x-5 h-[3px] bg-brand rounded-full" />
                )}
                <motion.span animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }} transition={spring}>
                  <t.icon size={19} className={active ? 'text-brand' : 'text-ink-faint'} />
                </motion.span>
                <span className={cn('text-[10px] font-bold', active ? 'text-brand' : 'text-ink-faint')}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ---------------------------------------------------------- Cài đặt */}
      <Sheet
        open={showSettings}
        onClose={() => { setShowSettings(false); if (user) saveSettings(systemSettings); }}
        title="Cài đặt tính giá"
        footer={
          <Button variant="brand" size="lg" className="w-full" icon={<Save size={15} />}
            onClick={() => { setShowSettings(false); if (user) saveSettings(systemSettings); }}>
            Lưu cài đặt
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="bg-brand-soft border border-line rounded-2xl p-4">
            <Field label="Hệ số nhân giá bán" hint="giá vốn × hệ số">
              <div className="flex items-center gap-3">
                <NumberInput
                  step="0.05" min="1"
                  value={markup}
                  onChange={e => patchSettings({ markupMultiplier: Number(e.target.value) })}
                  className="!text-lg !font-black !text-brand"
                />
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-ink-soft uppercase">Ví dụ</p>
                  <p className="text-sm font-black text-ink">
                    100k → {(100000 * markup / 1000).toLocaleString('vi-VN')}k
                  </p>
                </div>
              </div>
            </Field>
            <p className="text-[11px] text-ink-soft font-medium mt-2.5 leading-relaxed">
              Trước đây con số này nằm cứng trong code, muốn đổi giá phải sửa code rồi deploy lại.
              Giờ đổi ở đây là áp dụng ngay.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Công suất máy (W)">
              <NumberInput value={systemSettings.machinePowerW}
                onChange={e => patchSettings({ machinePowerW: Number(e.target.value) })} />
            </Field>
            <Field label="Giá điện (đ/kWh)">
              <NumberInput value={systemSettings.electricityPriceKwh}
                onChange={e => patchSettings({ electricityPriceKwh: Number(e.target.value) })} />
            </Field>
            <Field label="Khấu hao (đ/giờ)">
              <NumberInput value={systemSettings.depreciationPerHour}
                onChange={e => patchSettings({ depreciationPerHour: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Bản báo giá hiện tại</p>
            <Row label="Tiền nhựa" value={formatCurrency(results.materialCost)} />
            <Row label="Tiền điện" value={formatCurrency(results.electricityCost)} />
            <Row label="Khấu hao máy" value={formatCurrency(results.depreciationCost)} />
            <div className="h-px bg-line my-1" />
            <Row label="Giá vốn (làm tròn)" value={`${results.internalTotal.toLocaleString('vi-VN')} đ`} strong />
            <Row label={`× ${markup} + phụ phí`} value={`${results.customerTotal.toLocaleString('vi-VN')} đ`} brand />
          </div>
        </div>
      </Sheet>

      {/* -------------------------------------------------------- Showroom */}
      <AnimatePresence>
        {showShowroom && (
          <motion.div
            data-themed
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-app flex flex-col"
          >
            <header className="shrink-0 bg-surface border-b border-line px-4 sm:px-6 py-3 flex items-center gap-4">
              <Button variant="ghost" onClick={() => setShowShowroom(false)} className="!p-2 rounded-full" aria-label="Quay lại">
                <ArrowLeft size={20} />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black tracking-tight truncate">Bộ sưu tập màu sắc</h1>
                <p className="text-[10px] font-bold text-ink-soft uppercase tracking-[0.14em]">Danh mục nhựa tại kho</p>
              </div>
            </header>

            <div className="shrink-0 px-4 sm:px-6 py-3 overflow-x-auto no-scrollbar border-b border-line bg-surface">
              <div className="flex gap-2 w-max">
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={showroomCategory === cat ? 'brand' : 'plain'}
                    onClick={() => setShowroomCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight">{showroomCategory}</h2>
                    <div className="h-1.5 w-16 bg-brand rounded-full mt-2" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-ink-soft uppercase tracking-[0.16em]">Tổng số</p>
                    <p className="text-2xl font-black text-brand">
                      {materials.filter(m => (m.category || 'PLA') === showroomCategory).length} mẫu
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {materials.filter(m => (m.category || 'PLA') === showroomCategory).map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 24, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...springSoft, delay: Math.min(i * 0.035, 0.4) }}
                      whileHover={{ y: -6 }}
                      className="bg-surface rounded-3xl p-3 border border-line shadow-card group"
                    >
                      <div className="aspect-square bg-surface-2 rounded-2xl overflow-hidden border border-line relative">
                        {m.imageUrl ? (
                          <img src={m.imageUrl} alt={m.name}
                            className={cn('w-full h-full object-cover transition-transform duration-500 group-hover:scale-105',
                              m.inStock === false && 'grayscale opacity-50')} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-faint opacity-50">
                            <Camera size={40} strokeWidth={1.5} />
                          </div>
                        )}
                        {m.inStock === false && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-danger text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.14em]">
                              Hết hàng
                            </span>
                          </div>
                        )}
                        <span className="absolute top-3 right-3 w-8 h-8 rounded-full border-2 border-white shadow-float"
                          style={{ backgroundColor: m.colorHex }} />
                      </div>
                      <div className="px-1.5 pt-3 pb-1">
                        <p className="text-[10px] font-black text-brand uppercase tracking-[0.14em] truncate">{m.brand}</p>
                        <h3 className="text-base font-black tracking-tight truncate">{m.category} {m.brand}</h3>
                        <p className="text-sm font-bold text-ink-soft truncate">{m.color}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {materials.filter(m => (m.category || 'PLA') === showroomCategory).length === 0 && (
                  <Empty icon={<Box size={56} strokeWidth={1} />} title="Chưa có nhựa trong danh mục này" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="hidden md:block py-4 text-center border-t border-line">
        <p className="text-[10px] text-ink-faint font-bold uppercase tracking-[0.4em]">
          NSHOPVN • PREMIUM 3D PRINTING
        </p>
      </footer>
    </div>
  );
}

/* ==========================================================================
   Thành phần phụ
   ========================================================================== */

function Row({ label, value, strong, brand }: { label: string; value: string; strong?: boolean; brand?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 text-xs">
      <span className="font-semibold text-ink-soft truncate">{label}</span>
      <span className={cn('font-black shrink-0', brand ? 'text-brand text-sm' : strong ? 'text-ink' : 'text-ink-soft')}>
        {value}
      </span>
    </div>
  );
}

function MaterialPill({ m, active, onClick }: { m: Material; active: boolean; onClick: () => void }) {
  const out = m.inStock === false;
  return (
    <motion.button
      onClick={onClick}
      whileTap={out ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={out}
      className={cn(
        'w-full text-left p-2.5 border rounded-xl transition-colors relative overflow-hidden flex items-center gap-2.5',
        out ? 'opacity-40 grayscale bg-surface-2 border-line cursor-not-allowed'
            : active ? 'bg-brand-soft border-brand' : 'bg-surface-2 border-line hover:border-brand/40'
      )}
    >
      <div className="w-9 h-9 bg-surface rounded-lg border border-line overflow-hidden flex items-center justify-center shrink-0">
        {m.imageUrl ? <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <Box size={15} className="text-ink-faint" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{m.category} {m.brand}</p>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: m.colorHex }} />
          <p className="text-[10px] font-semibold text-ink-soft truncate">{m.color || '---'}</p>
        </div>
        <p className="text-[11px] font-black text-brand">{formatCurrency(m.pricePerKg)}</p>
      </div>
      {active && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}
          className="w-5 h-5 bg-brand text-brand-ink rounded-full flex items-center justify-center shrink-0">
          <Check size={11} strokeWidth={3.5} />
        </motion.span>
      )}
    </motion.button>
  );
}

function MaterialCard({
  m, confirming, onAskDelete, onCancelDelete, onDelete, onUpdate, onPickImage,
}: {
  m: Material;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onUpdate: (u: Partial<Material>) => void;
  onPickImage: (f: File) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={springSoft}
      className={cn(
        'bg-surface border rounded-2xl overflow-hidden group shadow-card',
        m.inStock === false ? 'border-danger/30' : 'border-line'
      )}
    >
      <div className="h-32 bg-surface-3 relative overflow-hidden flex items-center justify-center">
        {m.imageUrl
          ? <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
          : <Camera size={30} className="text-ink-faint opacity-50" />}

        <label className="absolute inset-0 bg-brand/65 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-bold text-xs">
          Tải ảnh mới
          <input
            type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPickImage(f); }}
          />
        </label>

        <motion.button
          onClick={onAskDelete}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          title="Xoá vật liệu"
          className="absolute top-2 right-2 z-10 p-1.5 bg-surface text-danger rounded-lg shadow-card opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </motion.button>

        <AnimatePresence>
          {confirming && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-20 bg-[#1c1c1e]/92 flex flex-col items-center justify-center gap-1.5 px-3 text-center"
            >
              <p className="text-[11px] font-black text-white uppercase tracking-wide leading-tight">
                Xoá {m.category || 'PLA'} {m.brand}?
              </p>
              <p className="text-[9px] font-bold text-white/50">Không hoàn tác được</p>
              <div className="flex gap-2 mt-1">
                <Button variant="danger" size="sm" onClick={onDelete}>Xoá</Button>
                <Button size="sm" onClick={onCancelDelete} className="!bg-white/15 !text-white !border-white/20">Huỷ</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="flex gap-2">
          <Field label="Loại" className="shrink-0 w-[92px]">
            <Select value={m.category || 'PLA'} onChange={e => onUpdate({ category: e.target.value })} className="!py-2 !text-xs !font-black uppercase">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Hãng" className="flex-1 min-w-0">
            <TextInput defaultValue={m.brand} placeholder="Nhập hãng..." onBlur={e => onUpdate({ brand: e.target.value })} className="!py-2 !text-xs" />
          </Field>
        </div>

        <div className="flex gap-2 items-end">
          <Field label="Màu sắc" className="flex-1 min-w-0">
            <TextInput defaultValue={m.color} placeholder="Tên màu..." onBlur={e => onUpdate({ color: e.target.value })} className="!py-2 !text-xs !text-brand" />
          </Field>
          <ColorPicker defaultColor={m.colorHex || '#000000'} onBlur={hex => onUpdate({ colorHex: hex })} />
        </div>

        <div className="flex gap-3 items-end">
          <Field label="Giá / kg (đ)" className="flex-1 min-w-0">
            <NumberInput defaultValue={m.pricePerKg} onBlur={e => onUpdate({ pricePerKg: Number(e.target.value) })} className="!py-2 !text-sm !font-black !text-brand" />
          </Field>
          <div className="shrink-0 pb-1">
            <p className="text-[11px] font-bold text-ink-soft mb-1.5 text-center">Còn</p>
            <Switch checked={m.inStock ?? true} onChange={v => onUpdate({ inStock: v })} label="Còn hàng" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
