/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  Settings as SettingsIcon, 
  Box, 
  Printer, 
  Coins, 
  Info, 
  Camera, 
  Plus, 
  Trash2, 
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Clock,
  Weight,
  Layers,
  Percent,
  CreditCard,
  LogIn,
  LogOut,
  User as UserIcon,
  Loader2,
  Eye,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Edit2,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { cn, formatCurrency } from '@/lib/utils';
import { Material, SystemSettings, QuoteParams, CalculationResult } from './types';
import { auth, db, signIn, logOut, handleFirestoreError } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

// Default Materials (Dummy for type safety if needed, but we fetch from DB)
const INITIAL_MATERIALS: Material[] = [
  { id: '1', name: 'PLA Standard', brand: 'eSUN', pricePerKg: 315000, color: 'Trắng', colorHex: '#ffffff', ownerId: 'system', category: 'PLA', inStock: true },
  { id: '2', name: 'PETG Standard', brand: 'Overture', pricePerKg: 350000, color: 'Đen', colorHex: '#000000', ownerId: 'system', category: 'PETG', inStock: true },
  { id: '3', name: 'ABS Premium', brand: 'Flashforge', pricePerKg: 315000, color: 'Xám', colorHex: '#808080', ownerId: 'system', category: 'ABS', inStock: true },
  { id: '4', name: 'ASA Heavy', brand: 'Polymaker', pricePerKg: 450000, color: 'Đen', colorHex: '#000000', ownerId: 'system', category: 'ASA', inStock: true },
];

// Material Characteristics
const MATERIAL_CHARACTERISTICS: Record<string, string> = {
  'PETG': 'Nhựa có độ bền và độ cứng khá tốt. Chịu nhiệt dưới 65°C. Bề mặt bóng , nhựa có tính trong suốt , xuyên sáng (tùy màu).',
  'PLA': 'Nhựa thân thiện môi trường, dễ in, nhiều màu đẹp. Độ cứng tốt nhưng giòn, chịu nhiệt dưới 50°C. Tự phân hủy sau một thời gian',
  'ASA': 'Chuyên dụng ngoài trời, kháng tia UV. Độ bền cơ học cao, chịu nhiệt tới 110°C và giữ màu lâu dưới tác động thời tiết.',
  'PETG-CF': 'Nhựa kỹ thuật gia cường sợi Carbon, độ cứng rất tốt. Bề mặt nhám mờ sang trọng, ổn định kích thước cao.',
  'ABS': 'Nhựa kỹ thuật bền bỉ, chịu va đập cực tốt, chịu nhiệt cao tới 90°C. Khó in , dễ cong vênh, dễ gia công hậu kỳ.',
  'TPU': 'Nhựa dẻo đàn hồi như cao su ( tùy mã ). Chống mài mòn, chống va đập và chịu uốn cong hoàn hảo. Khó in, giá thành cao'
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'quote' | 'inventory'>('quote');
  const [showShowroom, setShowShowroom] = useState(false);
  const [showroomCategory, setShowroomCategory] = useState('PLA');
  const [quoteCategory, setQuoteCategory] = useState(() => {
    return localStorage.getItem('lastQuoteCategory') || 'PLA';
  });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const quoteRef = useRef<HTMLElement>(null);
  
  // State for Settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const local = localStorage.getItem('local_settings');
    return local ? JSON.parse(local) : {
      machinePowerW: 200,
      electricityPriceKwh: 5000,
      depreciationPerHour: 4000,
      serviceNotes: DEFAULT_SERVICE_NOTES
    };
  });

  // State for Inventory
  const [materials, setMaterials] = useState<Material[]>(() => {
    const local = localStorage.getItem('local_materials');
    return local ? JSON.parse(local) : [];
  });

  // Offline Sync State
  const [pendingSync, setPendingSync] = useState(() => localStorage.getItem('pending_sync') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Settings Sync
  useEffect(() => {
    if (!user) return;
    const settingsDoc = doc(db, 'settings', user.uid);
    return onSnapshot(settingsDoc, (snapshot) => {
      if (localStorage.getItem('pending_sync') === 'true') return;
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemSettings;
        setSystemSettings(data);
        localStorage.setItem('local_settings', JSON.stringify(data));
      }
    });
  }, [user]);

  // Materials Sync
  useEffect(() => {
    if (!user) {
      setMaterials([]);
      return;
    }
    const q = query(
      collection(db, 'materials'), 
      where('ownerId', '==', user.uid)
    );
    return onSnapshot(q, (snapshot) => {
      if (localStorage.getItem('pending_sync') === 'true') return;
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material))
        .sort((a, b) => {
          // If createdAt is pending (no seconds), assume it's "now" so new items stay at the top
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now();
          return timeB - timeA;
        });
      setMaterials(items);
      localStorage.setItem('local_materials', JSON.stringify(items));
      
      // Auto-select if nothing is selected or if current selection is invalid
      setParams(p => {
        const currentMaterial = items.find(m => m.id === p.materialId);
        if (!p.materialId || !currentMaterial) {
          const firstInCat = items.find(m => (m.category || 'PLA') === quoteCategory);
          if (firstInCat) return { ...p, materialId: firstInCat.id };
        }
        return p;
      });
    }, (error) => {
      console.error("Firestore sync error:", error);
      alert(`Dữ liệu kho nhựa bị gián đoạn. Không thể tải: ${error.message}`);
    });
  }, [user, quoteCategory]);

  const enableOfflineMode = () => {
    setPendingSync(true);
    localStorage.setItem('pending_sync', 'true');
  };

  const safeCloudWrite = async (writePromise: Promise<any>) => {
    try {
      await Promise.race([
        writePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
    } catch (e: any) {
      if (e.message === 'timeout' || e.code === 'resource-exhausted') {
        enableOfflineMode();
      }
      throw e;
    }
  };

  const handleSyncToFirebase = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // Get remote to find deletions
      const q = query(collection(db, 'materials'), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const remoteIds = snap.docs.map(d => d.id);
      const localIds = materials.map(m => m.id);
      
      const toDelete = remoteIds.filter(id => !localIds.includes(id));
      const deletePromises = toDelete.map(id => deleteDoc(doc(db, 'materials', id)));
      
      // Upsert local changes
      const writePromises = materials.map(m => {
        return setDoc(doc(db, 'materials', m.id), { ...m, updatedAt: serverTimestamp() }, { merge: true });
      });

      // Sync settings
      const settingsPromise = setDoc(doc(db, 'settings', user.uid), {
        ...systemSettings,
        ownerId: user.uid
      });

      await Promise.all([...deletePromises, ...writePromises, settingsPromise]);
      
      setPendingSync(false);
      localStorage.setItem('pending_sync', 'false');
      alert('Đồng bộ lên Cloud thành công! Dữ liệu đã an toàn.');
    } catch (e: any) {
      console.error("Sync Error:", e);
      alert(`Đồng bộ thất bại. Có thể do giới hạn quota. Vui lòng thử lại vào ngày mai.\nChi tiết: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettings = async (newSettings: SystemSettings) => {
    if (!user) return;
    setSystemSettings(newSettings);
    localStorage.setItem('local_settings', JSON.stringify(newSettings));
    try {
      await safeCloudWrite(setDoc(doc(db, 'settings', user.uid), {
        ...newSettings,
        ownerId: user.uid
      }));
    } catch (e) {
      console.warn("Saved settings locally. Enabling offline mode.");
    }
  };

  // State for Quote Parameters with Persistence
  const [params, setParams] = useState<QuoteParams>(() => {
    const saved = localStorage.getItem('lastQuoteParams');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved params', e);
      }
    }
    return {
      materialId: '',
      hours: 10,
      minutes: 14,
      weightG: 394,
      infillPercent: 20,
      layerHeightMm: 0.2,
      extraFee: 10000,
      note: '67UYHXF',
    };
  });

  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'in' | 'out'>('all');

  // Save params and category to localStorage on change
  useEffect(() => {
    localStorage.setItem('lastQuoteParams', JSON.stringify(params));
  }, [params]);

  useEffect(() => {
    localStorage.setItem('lastQuoteCategory', quoteCategory);
  }, [quoteCategory]);

  const selectedMaterial = materials.find(m => m.id === params.materialId);

  // Calculation Logic
  const results = useMemo<CalculationResult>(() => {
    if (!selectedMaterial) return { materialCost: 0, electricityCost: 0, depreciationCost: 0, internalTotal: 0, customerTotal: 0 };

    const totalHours = params.hours + (params.minutes / 60);
    const materialCost = (params.weightG / 1000) * selectedMaterial.pricePerKg;
    const electricityCost = (systemSettings.machinePowerW / 1000) * systemSettings.electricityPriceKwh * totalHours;
    const depreciationCost = systemSettings.depreciationPerHour * totalHours;
    
    const internalTotal = Math.round((materialCost + electricityCost + depreciationCost) / 1000) * 1000;
    
    // Custom logic: rounded up to nearest thousand or fixed margin
    // Let's use a 2.2x margin roughly to match screenshot (108k -> 243k)
    // Or just a formula: (InternalCost * 2) + offset
    const baseCustomerTotal = internalTotal * 2.25;
    const customerTotal = Math.ceil((baseCustomerTotal + params.extraFee) / 1000) * 1000;

    return {
      materialCost,
      electricityCost,
      depreciationCost,
      internalTotal,
      customerTotal
    };
  }, [params, systemSettings, selectedMaterial]);

  const handleExportImage = async () => {
    if (!quoteRef.current) return;
    try {
      setIsCopying(true);
      const dataUrl = await htmlToImage.toPng(quoteRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      setTimeout(() => setIsCopying(false), 2000);
    } catch (e) {
      console.error('Copy to clipboard failed', e);
      setIsCopying(false);
      alert('Không thể sao chép ảnh vào Clipboard. Trình duyệt của bạn có thể không hỗ trợ hoặc cần cấp quyền.');
    }
  };

  const handleExportPDF = async () => {
    if (!quoteRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(quoteRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [img.width / 2, img.height / 2]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width / 2, img.height / 2);
        pdf.save(`BAO_GIA_${params.note || 'IN3D'}.pdf`);
      };
    } catch (e) {
      console.error('Export PDF failed', e);
      alert('Không thể xuất PDF. Vui lòng thử lại.');
    }
  };

  const handleMaterialAdd = async (materialData: Partial<Material>) => {
    if (!user) {
      alert('Vui lòng đăng nhập để thực hiện tính năng này.');
      return;
    }
    
    const materialRef = doc(collection(db, 'materials'));
    const id = materialRef.id;

    const newMaterial = {
      name: materialData.name || 'Nhựa Mới',
      brand: materialData.brand || 'No name',
      pricePerKg: materialData.pricePerKg || 300000,
      color: materialData.color || 'Chưa đặt màu',
      colorHex: materialData.colorHex || '#3b82f6',
      category: materialData.category || 'PLA',
      inStock: materialData.inStock ?? true,
      id,
      ownerId: user.uid,
      createdAt: { seconds: Date.now() / 1000 } as any,
      updatedAt: { seconds: Date.now() / 1000 } as any
    };

    const newMaterials = [newMaterial, ...materials];
    setMaterials(newMaterials);
    localStorage.setItem('local_materials', JSON.stringify(newMaterials));

    try {
      await safeCloudWrite(setDoc(materialRef, { ...newMaterial, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    } catch (e: any) {
      // Offline mode enabled
    }
  };

  const handleMaterialUpdate = async (id: string, updates: Partial<Material>) => {
    if (!user) return;
    
    // Update local immediately
    const updatedMaterials = materials.map(m => m.id === id ? { ...m, ...updates, updatedAt: { seconds: Date.now()/1000 } as any } : m);
    setMaterials(updatedMaterials);
    localStorage.setItem('local_materials', JSON.stringify(updatedMaterials));

    try {
      await safeCloudWrite(setDoc(doc(db, 'materials', id), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true }));
    } catch (e: any) {
      // Offline mode enabled
    }
  };

  const handleMaterialDelete = async (id: string) => {
    if (!user) return;

    // Update local immediately
    const updatedMaterials = materials.filter(m => m.id !== id);
    setMaterials(updatedMaterials);
    localStorage.setItem('local_materials', JSON.stringify(updatedMaterials));

    try {
      await safeCloudWrite(deleteDoc(doc(db, 'materials', id)));
    } catch (e) {
      // Offline mode enabled
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    const batch = INITIAL_MATERIALS.map(m => {
      const id = Math.random().toString(36).substr(2, 9);
      return setDoc(doc(db, 'materials', id), {
        ...m,
        id,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    try {
      await Promise.all(batch);
    } catch (e) {
      handleFirestoreError(e, 'create', 'materials/batch');
    }
  };

  const filteredMaterials = materials.filter(m => {
    const searchMatch = !inventorySearch || 
      m.brand.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      m.color?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      m.category?.toLowerCase().includes(inventorySearch.toLowerCase());
    
    const stockMatch = inventoryStockFilter === 'all' || 
      (inventoryStockFilter === 'in' && m.inStock !== false) ||
      (inventoryStockFilter === 'out' && m.inStock === false);
      
    return searchMatch && stockMatch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans selection:bg-[#2563eb]/20 flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1600px] mx-auto w-full border-x border-[#e2e8f0]/40 shadow-2xl bg-white shadow-slate-200">
        {/* Bento Header */}
      <header className="h-[60px] px-8 border-b border-[#e2e8f0] bg-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white">
            <Printer size={18} strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-[#2563eb] text-2xl tracking-tighter">PLASTICALC HUB</span>
        </div>
        
        <nav className="flex items-center gap-3">
          {pendingSync && (
            <button 
              onClick={handleSyncToFirebase}
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-md active:scale-95 bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600 disabled:opacity-50 animate-pulse"
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('quote')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-md active:scale-95",
              activeTab === 'quote' 
                ? "bg-[#2563eb] text-white shadow-blue-200 ring-2 ring-white/20" 
                : "bg-[#2563eb]/90 text-white/90 hover:bg-[#2563eb] hover:text-white hover:shadow-lg"
            )}
          >
            <Printer size={16} /> Bảng Điều Khiển
          </button>
          
          <button 
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-md active:scale-95",
              activeTab === 'inventory' 
                ? "bg-[#2563eb] text-white shadow-blue-200 ring-2 ring-white/20" 
                : "bg-[#2563eb]/90 text-white/90 hover:bg-[#2563eb] hover:text-white hover:shadow-lg"
            )}
          >
            <Box size={16} /> Nhập Kho Nhựa
          </button>
          
          <button 
            onClick={() => setShowShowroom(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] text-white rounded-xl text-sm font-extrabold shadow-md hover:bg-blue-600 transition-all active:scale-95"
          >
            <Eye size={16} /> Showroom
          </button>
          <div className="w-[1px] h-4 bg-[#e2e8f0] mx-2" />
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#64748b] bg-[#f1f5f9] px-2 py-1 rounded-md uppercase tracking-wider">
                {user.email?.split('@')[0]}
              </span>
              <button 
                onClick={() => logOut()}
                className="text-sm font-bold text-red-500 hover:text-red-600"
              >
                Đăng Xuất
              </button>
            </div>
          ) : (
            <button 
              onClick={() => signIn()}
              className="text-base font-bold text-[#2563eb] hover:underline"
            >
              Admin Mode
            </button>
          )}
        </nav>
      </header>
        
      <main className="flex-1 p-4 grid grid-cols-[320px_1fr_300px] gap-4">
        {activeTab === 'quote' ? (
          <>
            {/* Column 1: Inputs */}
            <div className="flex flex-col gap-4 pr-1">
              {/* HE THONG Section */}
              <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm">
                <div className="flex items-center gap-2 mb-5 text-[#64748b]">
                  <SettingsIcon size={14} />
                  <h2 className="font-bold text-xs uppercase tracking-[0.1em]">Hệ Thống</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Loại Nhựa</label>
                      <select 
                        value={quoteCategory}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          setQuoteCategory(newCat);
                          // Auto select first material of new category if available
                          const firstOfCat = materials.find(m => (m.category || 'PLA') === newCat);
                          if (firstOfCat) {
                            setParams(p => ({ ...p, materialId: firstOfCat.id }));
                          }
                        }}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      >
                        {['PLA', 'PETG', 'PETG-CF', 'ABS', 'ASA', 'TPU'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Nhựa Trong Kho</label>
                      <select 
                        value={params.materialId}
                        onChange={(e) => setParams({ ...params, materialId: e.target.value })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      >
                        {materials
                          .filter(m => (m.category || 'PLA') === quoteCategory)
                          .map(m => (
                          <option key={m.id} value={m.id} disabled={m.inStock === false}>
                            {m.category || 'PLA'} | {m.brand} - {m.color} {m.inStock === false ? '(HẾT HÀNG)' : ''}
                          </option>
                        ))}
                        {materials.filter(m => (m.category || 'PLA') === quoteCategory).length === 0 && (
                          <option value="">(Trống)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Giá Nhựa/KG</label>
                      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-bold text-[#2563eb]">
                        {formatCurrency(selectedMaterial?.pricePerKg || 0)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Máy (W)</label>
                      <input 
                        type="number"
                        value={systemSettings.machinePowerW}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSystemSettings(s => ({ ...s, machinePowerW: val }));
                        }}
                        onBlur={() => saveSettings(systemSettings)}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Điện/KWH</label>
                      <input 
                        type="number"
                        value={systemSettings.electricityPriceKwh}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSystemSettings(s => ({ ...s, electricityPriceKwh: val }));
                        }}
                        onBlur={() => saveSettings(systemSettings)}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Khấu Hao/H</label>
                      <input 
                        type="number"
                        value={systemSettings.depreciationPerHour}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSystemSettings(s => ({ ...s, depreciationPerHour: val }));
                        }}
                        onBlur={() => saveSettings(systemSettings)}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* THONG SO Section */}
              <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm">
                <div className="flex items-center gap-2 mb-5 text-[#64748b]">
                  <Box size={14} />
                  <h2 className="font-bold text-xs uppercase tracking-[0.1em]">Thông Số Bản In</h2>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Giờ In</label>
                      <input 
                        type="number"
                        value={params.hours}
                        onChange={(e) => setParams({ ...params, hours: Number(e.target.value) })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Phút</label>
                      <input 
                        type="number"
                        value={params.minutes}
                        onChange={(e) => setParams({ ...params, minutes: Number(e.target.value) })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Cân Nặng (G)</label>
                      <input 
                        type="number"
                        value={params.weightG}
                        onChange={(e) => setParams({ ...params, weightG: Number(e.target.value) })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Layer (mm)</label>
                      <select 
                        value={params.layerHeightMm}
                        onChange={(e) => setParams({ ...params, layerHeightMm: Number(e.target.value) })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      >
                        {[0.1, 0.12, 0.16, 0.2, 0.24, 0.28, 0.3, 0.4].map(lh => (
                          <option key={lh} value={lh}>{lh}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1e293b] px-1">Infill (%)</label>
                      <input 
                        type="number"
                        value={params.infillPercent}
                        onChange={(e) => setParams({ ...params, infillPercent: Number(e.target.value) })}
                        className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1e293b] px-1">Phụ Phí Xử Lý (VND)</label>
                    <input 
                      type="number"
                      value={params.extraFee}
                      onChange={(e) => setParams({ ...params, extraFee: Number(e.target.value) })}
                      className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-bold text-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1e293b] px-1">Nội Dung</label>
                    <input 
                      type="text"
                      value={params.note}
                      onChange={(e) => setParams({ ...params, note: e.target.value })}
                      className="w-full bg-[#fdfdfd] border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-1 focus:ring-[#2563eb] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Internal Cost Summary */}
              <div className="bg-[#f1f5f9] rounded-2xl p-5 border border-[#e2e8f0] mt-auto">
                 <div className="flex justify-between items-center text-xs font-bold text-[#64748b] uppercase tracking-widest mb-2">
                   <span>Giá vốn nội bộ</span>
                   <span className="text-[#1e293b]">{results.internalTotal.toLocaleString()} đ</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase text-[#2563eb]">Tổng báo giá</span>
                    <span className="text-2xl font-extrabold text-[#2563eb]">{results.customerTotal.toLocaleString()} đ</span>
                 </div>
              </div>
            </div>

            {/* Column 2: Center Display */}
            <div className="">
              <main ref={quoteRef} className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] flex flex-col">
                <div className="p-8 border-b border-[#e2e8f0] flex justify-between items-center bg-[#fdfdfd]">
                  <div>
                    <p className="text-[11px] font-black text-[#64748b] uppercase tracking-[0.3em] mb-1">NSHOP DIGITAL FABRICATION</p>
                    <h1 className="text-xl font-extrabold tracking-tight">Xác Nhận Báo Giá</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleExportPDF}
                      title="Xuất báo giá PDF"
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#22c55e] text-white shadow-lg cursor-pointer hover:scale-105 transition-all active:scale-95"
                    >
                      <Printer size={18} />
                    </button>
                    <button 
                      onClick={handleExportImage}
                      title="Sao chép ảnh báo giá"
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-all active:scale-95",
                        isCopying ? "bg-[#22c55e]" : "bg-[#2563eb]"
                      )}
                    >
                      {isCopying ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                        <div className="p-8 space-y-8 flex-1">
                  {/* Top Info Grid */}
                  <div className="grid grid-cols-[1fr_320px] gap-4">
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4 text-[#2563eb]">
                        <Info size={14} />
                        <h3 className="text-xs font-extrabold uppercase tracking-widest">Thông số sản phẩm</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div className="col-span-2 border-b border-[#e2e8f0] pb-2 mb-0.5">
                          <p className="text-xs font-bold text-[#64748b] uppercase mb-0.5">Vật liệu</p>
                          <p className="font-bold text-base">{selectedMaterial?.category || '---'} {selectedMaterial?.brand}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#64748b] uppercase mb-0.5">Khối lượng</p>
                          <p className="font-bold text-[#22c55e]">{params.weightG}G</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#64748b] uppercase mb-0.5">Màu sắc</p>
                          <div className="flex items-center gap-2 justify-end">
                             <div className="w-4 h-4 rounded-full border border-black/5" style={{ backgroundColor: selectedMaterial?.colorHex }} />
                             <span className="font-bold">{selectedMaterial?.color || '---'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#64748b] uppercase mb-0.5">Chiều cao Layer</p>
                          <p className="font-bold">{params.layerHeightMm} mm</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#64748b] uppercase mb-0.5">Độ dày Infill</p>
                          <p className="font-bold">{params.infillPercent}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden flex items-center justify-center shadow-sm h-full max-h-[320px]">
                      {selectedMaterial?.imageUrl ? (
                        <img 
                          src={selectedMaterial.imageUrl} 
                          alt={selectedMaterial.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[#cbd5e1]">
                          <Camera size={32} strokeWidth={1.5} />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Chưa có hình mẫu</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Characteristics Card */}
                  <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-[#6d28d9]">
                      <Sparkles size={16} />
                      <h3 className="text-xs font-black uppercase tracking-widest">
                        Đặc tính nhựa {quoteCategory}
                      </h3>
                    </div>
                    <p className="text-xs font-bold text-[#4c1d95] italic leading-relaxed">
                      {MATERIAL_CHARACTERISTICS[quoteCategory] || 'Chọn loại nhựa để xem đặc tính.'}
                    </p>
                  </div>

                  {/* Notes Card */}
                  <div className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-2xl p-6 relative group/notes">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-extrabold text-[#64748b] uppercase tracking-widest flex items-center gap-2">
                        <Info size={14} className="text-[#2563eb]" /> Lưu ý dịch vụ in 3D
                      </h3>
                      {user && (
                        <button 
                          onClick={() => setIsEditingNotes(!isEditingNotes)}
                          className="p-1.5 hover:bg-[#e2e8f0] rounded-lg text-[#64748b] transition-colors"
                          title="Sửa lưu ý"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>

                    {isEditingNotes ? (
                      <div className="space-y-3">
                        <textarea 
                          value={systemSettings.serviceNotes || DEFAULT_SERVICE_NOTES}
                          onChange={(e) => setSystemSettings(s => ({ ...s, serviceNotes: e.target.value }))}
                          className="w-full min-h-[200px] bg-white border border-[#e2e8f0] rounded-xl p-4 text-sm font-medium focus:ring-1 focus:ring-[#2563eb] outline-none"
                        />
                        <button 
                          onClick={() => {
                            saveSettings(systemSettings);
                            setIsEditingNotes(false);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-600 transition-colors"
                        >
                          <Save size={14} /> Lưu thay đổi
                        </button>
                      </div>
                    ) : (
                      <div className="whitespace-pre-line text-xs text-[#64748b] font-bold leading-[1.6]">
                        {systemSettings.serviceNotes || DEFAULT_SERVICE_NOTES}
                      </div>
                    )}
                  </div>

                  {/* QR, Payment & Bank Section */}
                  <div className="mt-auto border-t border-[#e2e8f0] pt-8 flex items-end justify-between gap-8">
                    <div className="flex items-center gap-8 flex-1">
                      <div className="p-1.5 bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden flex items-center justify-center">
                         <img 
                           src={`https://qr.limcorp.vn/qrcode.png?bank=970448&&number=0344970774&amount=${results.customerTotal}&content=${encodeURIComponent(params.note)}`}
                           alt="Chuyển khoản QR"
                           className="w-[110px] h-[110px] object-contain"
                           referrerPolicy="no-referrer"
                         />
                      </div>
                      <div className="space-y-4">
                         <div>
                            <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Thông tin chuyển khoản</p>
                            <p className="text-xs font-bold uppercase tracking-tight text-[#2563eb]">NGÂN HÀNG OCB</p>
                            <p className="text-xs font-bold uppercase tracking-tight text-[#64748b]">CTK: VO THANH NAM</p>
                            <p className="text-xs font-bold text-[#64748b]">STK: 0344970774</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Nội dung</p>
                            <p className="text-xs font-bold tracking-tighter uppercase text-[#1e293b]">{params.note}</p>
                         </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-3 min-w-[280px]">
                       <div className="bg-[#822fbd] border border-[#822fbd]/20 rounded-3xl p-7 w-full text-left shadow-xl shadow-purple-200/50">
                          <p className="text-[11px] font-black text-white/80 uppercase tracking-[0.3em] mb-2">TỔNG THANH TOÁN</p>
                          <div className="text-5xl font-black tracking-tighter text-white">
                            {results.customerTotal.toLocaleString()} <span className="text-lg font-bold opacity-60">VND</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>

            {/* Column 3: Quick Reference / Inventory List */}
            <div className="sticky top-4 self-start flex flex-col gap-4 pl-1 h-[calc(100vh-140px)]">
              <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#64748b]">
                    <Box size={14} />
                    <h2 className="font-bold text-xs uppercase tracking-[0.1em]">Kho Nhựa Tham Khảo</h2>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <input 
                    type="text"
                    placeholder="Tìm nhựa..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl pl-8 pr-3 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-[#2563eb] outline-none"
                  />
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                  {inventorySearch && (
                    <button 
                      onClick={() => setInventorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pb-4 pr-1">
                  {filteredMaterials.map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => {
                        if (m.inStock === false) return;
                        setQuoteCategory(m.category || 'PLA');
                        setParams(p => ({ ...p, materialId: m.id }));
                      }}
                      className={cn(
                        "group p-3 border rounded-xl transition-all cursor-pointer relative overflow-hidden",
                        m.inStock === false ? "opacity-40 grayscale pointer-events-none bg-[#f1f5f9] border-[#e2e8f0]" : 
                        params.materialId === m.id 
                          ? "bg-blue-50/50 border-[#2563eb] ring-2 ring-[#2563eb]/10 shadow-sm"
                          : "bg-[#f8fafc] border-[#e2e8f0] hover:border-[#2563eb]/30 hover:shadow-md hover:-translate-y-0.5"
                      )}
                    >
                      {params.materialId === m.id && (
                        <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-[#2563eb] text-white rounded-bl-xl">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg border border-[#e2e8f0] overflow-hidden flex items-center justify-center shrink-0">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <Box size={16} className="text-[#cbd5e1]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold leading-none mb-1 truncate">{m.category} {m.brand}</p>
                          <div className="flex items-center gap-1.5 opacity-60">
                             <div className="w-2 h-2 rounded-full border border-black/5" style={{ backgroundColor: m.colorHex }} />
                             <p className="text-[10px] font-bold truncate">{m.color || '---'}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs font-bold text-[#2563eb]">{formatCurrency(m.pricePerKg)}</p>
                            {m.inStock === false && (
                              <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-1 rounded">HẾT HÀNG</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {materials.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-[#cbd5e1] gap-2">
                       <Box size={32} strokeWidth={1} />
                       <p className="text-[10px] font-extrabold uppercase tracking-widest">Trống</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#e2e8f0] mt-auto">
                   <div className="bg-[#2563eb] rounded-xl p-3 text-white">
                      <p className="text-[10px] font-bold uppercase opacity-80 mb-1">Thống kê</p>
                      <p className="text-xl font-black tracking-tight">Tổng {filteredMaterials.length} Loại</p>
                   </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Bento-style Inventory tab */
          <div className="col-span-3 bg-white rounded-2xl p-8 border border-[#e2e8f0] overflow-y-auto shadow-sm">
             <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-[#e2e8f0] pb-6">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Quản Lý Kho Nhựa</h2>
                    <p className="text-base font-medium text-[#64748b]">
                      Cập nhật danh sách vật liệu và bảng giá hệ thống
                    </p>
                  </div>
                  {user && (
                    <button 
                      onClick={() => handleMaterialAdd({
                        name: 'Nhựa Mới',
                        brand: 'No name',
                        pricePerKg: 300000,
                        color: 'Chưa đặt màu',
                        colorHex: '#3b82f6',
                        inStock: true
                      })}
                      className="bg-[#2563eb] text-white px-6 py-2.5 rounded-xl font-bold text-base shadow-md hover:scale-105 transition-all flex items-center gap-2"
                    >
                      <Plus size={18} /> Thêm Nhựa
                    </button>
                  )}
                </div>

                {user && (
                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                     <div className="flex-1 relative">
                        <input 
                          type="text"
                          placeholder="Tìm theo hãng, màu hoặc loại nhựa..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl pl-10 pr-10 py-3 text-sm font-bold focus:ring-1 focus:ring-[#2563eb] outline-none"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                        {inventorySearch && (
                          <button 
                            onClick={() => setInventorySearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b] p-1 hover:bg-[#e2e8f0] rounded-full transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                     </div>
                     <div className="flex bg-[#f1f5f9] p-1 rounded-xl gap-1">
                        {[
                          { id: 'all', label: 'Tất cả' },
                          { id: 'in', label: 'Còn hàng' },
                          { id: 'out', label: 'Hết hàng' }
                        ].map((btn) => (
                           <button
                             key={btn.id}
                             onClick={() => setInventoryStockFilter(btn.id as any)}
                             className={cn(
                               "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all",
                               inventoryStockFilter === btn.id 
                                ? "bg-white text-[#2563eb] shadow-sm" 
                                : "text-[#64748b] hover:text-[#1e293b]"
                             )}
                           >
                             {btn.label}
                           </button>
                        ))}
                     </div>
                  </div>
                )}

                {authLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={32} className="animate-spin text-[#2563eb]" />
                    <p className="text-sm font-bold text-[#64748b]">Đang tải kho nhựa...</p>
                  </div>
                ) : !user ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-[32px] gap-6">
                    <UserIcon size={48} className="text-[#cbd5e1]" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg mb-2">Chưa đăng nhập</h3>
                      <p className="text-sm text-[#64748b] mb-6">Đăng nhập tài khoản Admin để quản lý dữ liệu kho.</p>
                      <button 
                        onClick={() => signIn()}
                        className="bg-[#2563eb] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-all flex items-center gap-2 mx-auto"
                      >
                        <LogIn size={18} /> Đăng nhập Google
                      </button>
                    </div>
                  </div>
                ) : (materials.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-[32px] gap-6">
                    <Box size={48} className="text-[#cbd5e1]" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg mb-2">Kho nhựa trống</h3>
                      <p className="text-sm text-[#64748b] mb-6">Bạn chưa có loại nhựa nào trong kho. Hãy thêm mới hoặc tạo dữ liệu mẫu.</p>
                      <div className="flex gap-4 justify-center">
                        <button 
                          onClick={() => handleMaterialAdd({
                            name: 'Nhựa Mới',
                            brand: 'No name',
                            pricePerKg: 300000,
                            color: 'Chưa đặt màu',
                            colorHex: '#3b82f6'
                          })}
                          className="bg-[#2563eb] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition-all flex items-center gap-2"
                        >
                          <Plus size={18} /> Thêm Nhựa
                        </button>
                        <button 
                          onClick={handleSeedData}
                          className="bg-white text-[#2563eb] border border-[#2563eb]/20 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-blue-50 transition-all flex items-center gap-2"
                        >
                          <Sparkles size={18} /> Tạo Dữ Liệu Mẫu
                        </button>
                      </div>
                    </div>
                  </div>
                ) : filteredMaterials.length === 0 && materials.length > 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-[32px] gap-4">
                    <Search size={48} className="text-[#cbd5e1]" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg mb-1">Không tìm thấy kết quả</h3>
                      <p className="text-sm text-[#64748b]">Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredMaterials.map(m => (
                      <div key={m.id} className={cn(
                        "bg-[#f8fafc] border rounded-2xl overflow-hidden group transition-all",
                        (m.inStock === false) ? "opacity-75 border-red-100" : "border-[#e2e8f0]"
                      )}>
                        <div className="h-32 bg-[#cbd5e1] relative overflow-hidden flex items-center justify-center">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                             <Camera size={32} className="text-white/40" />
                          )}
                          <label className="absolute inset-0 bg-[#2563eb]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-bold text-xs">
                             Tải ảnh mới
                             <input 
                               type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,image/*"
                               onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                   const reader = new FileReader();
                                   reader.onload = (event) => {
                                     const img = new Image();
                                     img.onload = () => {
                                       const canvas = document.createElement('canvas');
                                       let width = img.width;
                                       let height = img.height;
                                       const MAX_SIZE = 800;
                                       if (width > height) {
                                         if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                                       } else {
                                         if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                                       }
                                       canvas.width = width;
                                       canvas.height = height;
                                       const ctx = canvas.getContext('2d');
                                       ctx?.drawImage(img, 0, 0, width, height);
                                       const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                       handleMaterialUpdate(m.id, { imageUrl: dataUrl });
                                     };
                                     img.src = event.target?.result as string;
                                   };
                                   reader.readAsDataURL(file);
                                 }
                               }}
                             />
                          </label>
                          <button 
                            onClick={() => handleMaterialDelete(m.id)}
                            className="absolute top-2 right-2 p-1.5 bg-white text-red-500 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="p-4 space-y-1.5">
                           {/* Row 1: Category & Brand */}
                           <div className="flex gap-2">
                             <div className="shrink-0">
                               <label className="text-[10px] font-bold text-[#64748b] uppercase block mb-1">Loại</label>
                               <select 
                                 value={m.category || 'PLA'}
                                 onChange={(e) => handleMaterialUpdate(m.id, { category: e.target.value })}
                                 className="h-9 text-xs font-black bg-[#f1f5f9] text-[#1e293b] px-2 rounded-lg border border-[#e2e8f0] outline-none focus:ring-1 focus:ring-[#2563eb] uppercase cursor-pointer"
                               >
                                 {['PLA', 'PETG', 'PETG-CF', 'ABS', 'ASA', 'TPU'].map(cat => (
                                   <option key={cat} value={cat}>{cat}</option>
                                 ))}
                               </select>
                             </div>
                             <div className="flex-1">
                               <label className="text-[10px] font-bold text-[#64748b] uppercase block mb-1">Hãng</label>
                               <input 
                                 defaultValue={m.brand} 
                                 onBlur={(e) => handleMaterialUpdate(m.id, { brand: e.target.value })}
                                 placeholder="Nhập hãng nhựa..."
                                 className="w-full h-9 text-xs font-bold text-[#1e293b] bg-white border border-[#e2e8f0] px-3 rounded-lg outline-none focus:ring-1 focus:ring-[#2563eb]"
                               />
                             </div>
                           </div>

                           {/* Row 2: Color Name & Hex Picker */}
                           <div className="flex gap-2">
                             <div className="flex-1">
                               <label className="text-[10px] font-bold text-[#64748b] uppercase block mb-1">Màu sắc</label>
                               <input 
                                 defaultValue={m.color} 
                                 onBlur={(e) => handleMaterialUpdate(m.id, { color: e.target.value })}
                                 placeholder="Nhập tên màu..."
                                 className="w-full h-9 text-xs font-bold text-[#2563eb] bg-white border border-[#e2e8f0] px-3 rounded-lg outline-none focus:ring-1 focus:ring-[#2563eb]"
                               />
                             </div>
                             <div className="shrink-0">
                               <label className="text-[10px] font-bold text-[#64748b] uppercase block mb-1">Mã</label>
                               <div className="w-9 h-9 rounded-lg relative border border-[#e2e8f0] overflow-hidden shadow-sm" style={{ backgroundColor: m.colorHex }}>
                                  <input 
                                    type="color" value={m.colorHex} 
                                    onChange={(e) => {
                                      // Only update local state visually, don't write to DB yet
                                      // Due to how the current state is bound to materials fetched from DB,
                                      // we might need a local state. But since we use onBlur to commit, onChange can be ignored or handled locally.
                                      // We will change the bounding for color picker visually via a ref or just update when mouse released
                                    }}
                                    onBlur={(e) => handleMaterialUpdate(m.id, { colorHex: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                               </div>
                             </div>
                           </div>

                           {/* Row 3: Price & Stock */}
                           <div className="flex gap-2 items-end">
                             <div className="flex-1">
                               <label className="text-[10px] font-extrabold uppercase text-[#64748b] block mb-1">Giá / KG (VNĐ)</label>
                               <input 
                                 type="number"
                                 defaultValue={m.pricePerKg} 
                                 onBlur={(e) => handleMaterialUpdate(m.id, { pricePerKg: Number(e.target.value) })}
                                 className="w-full h-9 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 text-sm font-bold text-[#2563eb] outline-none focus:ring-1 focus:ring-[#2563eb]"
                               />
                             </div>
                             <div className="shrink-0 flex flex-col items-center">
                               <label className="text-[10px] font-extrabold uppercase text-[#64748b] block mb-1">Tồn</label>
                               <button
                                 onClick={() => handleMaterialUpdate(m.id, { inStock: !(m.inStock ?? true) })}
                                 className={cn(
                                   "w-9 h-9 rounded-lg flex items-center justify-center transition-all border shadow-sm active:scale-90",
                                   (m.inStock ?? true) 
                                     ? "bg-emerald-500 text-white border-emerald-400" 
                                     : "bg-red-500 text-white border-red-400"
                                 )}
                                 title={(m.inStock ?? true) ? "Còn hàng" : "Hết hàng"}
                               >
                                 {(m.inStock ?? true) ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                               </button>
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}
      </main>
      
      {/* Footer Bar */}
      <footer className="h-10 bg-[#1e293b] flex items-center justify-center shrink-0 leading-none">
        <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.5em]">NSHOPVN • PREMIUM 3D PRINTING SERVICE</p>
      </footer>

      </div>

      {/* Showroom Overlay */}
      <AnimatePresence>
        {showShowroom && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col"
          >
            {/* Showroom Header */}
            <header className="h-[70px] px-8 bg-white border-b border-[#e2e8f0] flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setShowShowroom(false)}
                  className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b]"
                >
                  <ArrowLeft size={24} />
                </button>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-[#1e293b]">BỘ SƯU TẬP MÀU SẮC</h1>
                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest">Danh mục nhựa thực tế tại kho</p>
                </div>
              </div>

              <div className="flex gap-2">
                {['PLA', 'PETG', 'PETG-CF', 'ABS', 'ASA', 'TPU'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setShowroomCategory(cat)}
                    className={cn(
                      "px-5 py-2 rounded-xl text-xs font-black transition-all",
                      showroomCategory === cat 
                        ? "bg-[#2563eb] text-white shadow-lg shadow-blue-200" 
                        : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </header>

            {/* Showroom Content */}
            <div className="flex-1 overflow-y-auto p-12">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                   <div>
                      <h2 className="text-4xl font-black tracking-tighter text-[#1e293b] mb-2">{showroomCategory} SERIES</h2>
                      <div className="h-1.5 w-24 bg-[#2563eb] rounded-full" />
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-black text-[#64748b] uppercase tracking-[0.2em]">Tổng số lượng</p>
                      <p className="text-3xl font-black text-[#2563eb]">
                        {materials.filter(m => (m.category || 'PLA') === showroomCategory).length} Mẫu
                      </p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {materials
                    .filter(m => (m.category || 'PLA') === showroomCategory)
                    .map(m => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={m.id} 
                        className="bg-white rounded-[32px] p-4 border border-[#e2e8f0] shadow-xl shadow-slate-200/50 flex flex-col gap-4 group"
                      >
                        <div className="aspect-square bg-[#f8fafc] rounded-[24px] overflow-hidden border border-[#e2e8f0] relative">
                          {m.imageUrl ? (
                            <img 
                              src={m.imageUrl} 
                              alt={m.name} 
                              className={cn(
                                "w-full h-full object-cover group-hover:scale-110 transition-transform duration-500",
                                m.inStock === false && "grayscale opacity-50"
                              )}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#cbd5e1]">
                              <Camera size={48} strokeWidth={1.5} />
                            </div>
                          )}
                          {m.inStock === false && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="bg-red-500/90 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-lg">
                                HẾT HÀNG
                              </div>
                            </div>
                          )}
                          <div 
                            className="absolute top-4 right-4 w-10 h-10 rounded-full border-2 border-white shadow-lg" 
                            style={{ backgroundColor: m.colorHex }}
                          />
                        </div>
                        <div className="px-2 pb-2">
                           <p className="text-xs font-black text-[#2563eb] uppercase tracking-widest mb-1">{m.brand}</p>
                           <h3 className="text-xl font-black tracking-tight text-[#1e293b] leading-tight mb-1">{m.category} {m.brand}</h3>
                           <p className="text-base font-bold text-[#64748b]">{m.color}</p>
                        </div>
                      </motion.div>
                    ))}
                </div>

                {materials.filter(m => (m.category || 'PLA') === showroomCategory).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 opacity-30">
                     <Box size={80} strokeWidth={1} />
                     <p className="mt-4 font-black text-xl tracking-tight">CHƯA CÓ NHỰA TRONG DANH MỤC NÀY</p>
                  </div>
                )}
              </div>
            </div>

            <footer className="h-10 bg-[#1e293b] flex items-center justify-center">
               <p className="text-[9px] text-white/40 font-black uppercase tracking-[0.4em]">NSHOPVN • PHÒNG TRƯNG BÀY VẬT LIỆU CAO CẤP</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
