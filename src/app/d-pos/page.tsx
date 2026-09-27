
'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase'; 
import { 
  collection, onSnapshot, query, orderBy, limit, doc, 
  updateDoc, addDoc, getDoc, getDocs, where, setDoc,
  deleteDoc, Timestamp, writeBatch
} from 'firebase/firestore';
import { 
  ShoppingBag, Search, X, Loader2, Clock, Printer, Settings, 
  Database, RefreshCw, Layers, LogOut, Lock, ToggleLeft, ToggleRight, 
  Trash2, UserPlus, Edit3, FileText, LayoutGrid, ChevronLeft, ChevronRight, 
  PackagePlus, BarChart3, HelpCircle, PauseCircle, PlayCircle, 
  Share2, Receipt, Send, Check, Plus, Eye,
  ArrowLeftRight, History, ChevronDown, ChevronUp, BellRing, Tag, Ticket, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { createRoot } from 'react-dom/client';

import CustomerDirectoryModal from '@/components/pos/CustomerDirectoryModal';
import PrintCustomerReceipt from '@/components/d-pos/PrintCustomerReceipt';
import PrintKitchenKot from '@/components/d-pos/PrintKitchenKot';

const SafeLock = Lock as any;
const SafeDatabase = Database as any;
const SafeLogOut = LogOut as any;
const SafeToggleRight = ToggleRight as any;
const SafeToggleLeft = ToggleLeft as any;
const SafeShoppingBag = ShoppingBag as any;
const SafeLayers = Layers as any;
const SafePrinter = Printer as any;
const SafeSearch = Search as any;
const SafeX = X as any;
const SafeRefreshCw = RefreshCw as any;
const SafeTrash2 = Trash2 as any;
const SafeUserPlus = UserPlus as any;
const SafeEdit3 = Edit3 as any;
const SafeFileText = FileText as any;
const SafeChevronLeft = ChevronLeft as any;
const SafeChevronRight = ChevronRight as any;
const SafePackagePlus = PackagePlus as any;
const SafeBarChart3 = BarChart3 as any;
const SafeHelpCircle = HelpCircle as any;
const SafePauseCircle = PauseCircle as any;
const SafePlayCircle = PlayCircle as any;
const SafeShare2 = Share2 as any;
const SafeSend = Send as any;
const SafePlus = Plus as any;
const SafeEye = Eye as any;

interface PosCartItem {
  cartItemId: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string; 
  variation?: string;
  size?: string;
}

interface DeliveryArea {
  name: string;
  fee: number;
  minFree: number;
  range: string;
}

interface HeldCart {
  id: string;
  cart: PosCartItem[];
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  fulfillmentType: 'delivery' | 'pickup' | 'table';
  heldAt: string;
  total: number;
  note?: string;
}

interface QuickCustomer {
  phone: string;
  name: string;
  address?: string;
  points?: number;
}

const PIZZA_ADDONS: { [size: string]: { [addon: string]: number } } = {
  "small": { "Veg Add-on": 10, "Paneer": 20, "Black Olives": 20, "Jalapeno": 20, "Extra Cheese": 20, "Mushroom": 20 },
  "medium": { "Veg Add-on": 10, "Paneer": 30, "Black Olives": 30, "Jalapeno": 30, "Extra Cheese": 30, "Mushroom": 30 },
  "large": { "Veg Add-on": 20, "Paneer": 40, "Black Olives": 40, "Jalapeno": 40, "Extra Cheese": 40, "Mushroom": 40 },
  "extra large": { "Veg Add-on": 30, "Paneer": 50, "Black Olives": 50, "Jalapeno": 50, "Extra Cheese": 60, "Mushroom": 50 }
};

const COOKING_TAGS = ['🌶️ Less Spicy', '🧅 No Onion/Garlic', '📦 Parcel/To-Go', '🧊 Less Ice', '🧀 Extra Dip', '☕ Kadak'];

const PROMO_COUPONS: { [code: string]: { type: 'percent' | 'flat', value: number } } = {
  'CAFE10': { type: 'percent', value: 10 },
  'BUM50': { type: 'flat', value: 50 },
  'WELCOME': { type: 'percent', value: 15 },
  'FLAT100': { type: 'flat', value: 100 }
};

let globalAudioCtx: AudioContext | null = null;

const getCategoryBaseCode = (catName: string): number => {
  const c = (catName || '').trim().toLowerCase();
  if (c.includes('burger')) return 1;
  if (c.includes('chinese')) return 100;
  if (c.includes('bread') || c.includes('roti') || c.includes('paratha')) return 200;
  if (c.includes('momo')) return 300;
  if (c.includes('paneer')) return 400;
  if (c.includes('fast food') || c.includes('snack') || c.includes('sandwich')) return 500;
  if (c.includes('pizza')) return 600;
  if (c.includes('shake') || c.includes('beverage') || c.includes('drink') || c.includes('super cool') || c.includes('chai') || c.includes('coffee')) return 700;
  if (c.includes('thali')) return 800;
  if (c.includes('rice') || c.includes('khichdi') || c.includes('biryani')) return 900;
  return 1000;
};

export default function BbCafeDesktopPos() {
  const DELIVERY_AREAS: DeliveryArea[] = useMemo(() => [
    { name: "Mohandra Town", fee: 20, minFree: 99, range: "0-2 KM" },
    { name: "Within 5 KM (Bum Bum Cafe से 5km के दायरे में)", fee: 50, minFree: 499, range: "2-5 KM" },
    { name: "Within 12 KM (12km के दायरे में)", fee: 99, minFree: 999, range: "5-12 KM" }
  ], []);

  // System States
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'billing' | 'settlement' | 'inventory' | 'receipts' | 'settings' | 'orders' | 'tables' | 'reports' | 'udhari' | 'customers'>('billing');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(5);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [kotEnabled, setKotEnabled] = useState<boolean>(true); 
  const [upiIdConfig, setUpiIdConfig] = useState<string>('Q991347275@ybl');
  const [ownerPhoneConfig, setOwnerPhoneConfig] = useState<string>('919714293759');
  const [manualInvoiceCounterInput, setManualInvoiceCounterInput] = useState<string>('200');

  // Customer Directory & Numeric Search
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [searchedCustomers, setSearchedCustomers] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  
  const [customerPhone, setCustomerPhone] = useState('');
  const [recentCartCustomers, setRecentCartCustomers] = useState<any[]>([]);
  // 👉 NEW: स्मार्ट सर्च ड्रॉपडाउन के स्टेट्स
  const [cartCustSearchInput, setCartCustSearchInput] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [custSuggestions, setCustSuggestions] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPoints, setCustomerPoints] = useState(0);
  const [address, setAddress] = useState('');
  const [isRedeemingPoints, setIsRedeemingPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const [showNewCustForm, setShowNewCustForm] = useState(false);
  const [newCustNameInput, setNewCustNameInput] = useState('');
  const [newCustAddressInput, setNewCustAddressInput] = useState('');

 // Cash Change Calculator
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  // 🎰 GAME VERIFICATION STATES & FUNCTIONS (यह छूट गया था)
  const [isGameVerifyModalOpen, setIsGameVerifyModalOpen] = useState(false);
  const [gameSearchInput, setGameSearchInput] = useState('');
  const [gameVerifyResult, setGameVerifyResult] = useState<any>(null);
  const [isGameVerifying, setIsGameVerifying] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);

  // गेम कूपन / नंबर चेक करने का फंक्शन
  const handleVerifyGameCode = async (searchVal: string) => {
    const term = searchVal.trim();
    if (!term) return toast.error("मोबाइल नंबर या BOM-XXXX कोड डालें!");

    setIsGameVerifying(true);
    setGameVerifyResult(null);

    try {
      let targetDoc: any = null;
      const cleanPhone = term.replace(/\D/g, '').slice(-10);

      // 1. अगर 10 अंकों का नंबर डाला है
      if (cleanPhone.length === 10) {
        const snap = await getDoc(doc(db, "customer_points", cleanPhone));
        if (snap.exists()) targetDoc = { id: snap.id, ...snap.data() };
      }

      // 2. अगर कूपन कोड डाला है (उदा. BOM-4821)
      if (!targetDoc && term.toUpperCase().startsWith("BOM-")) {
        const q = query(collection(db, "customer_points"), where("voucherCode", "==", term.toUpperCase()), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) targetDoc = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
      }

      if (!targetDoc) {
        toast.error("❌ कोई रिकॉर्ड नहीं मिला! (फर्जी नंबर या कोड)");
        setIsGameVerifying(false);
        return;
      }

      const playedAt = targetDoc.lastPlayedAt?.toDate ? targetDoc.lastPlayedAt.toDate() : null;
      const minutesAgo = playedAt ? Math.floor((Date.now() - playedAt.getTime()) / 60000) : 999;

      setGameVerifyResult({
        ...targetDoc,
        minutesAgo
      });

      if (targetDoc.voucherClaimed) {
        toast.error("🚫 यह कूपन पहले ही इस्तेमाल हो चुका है!");
      } else if (targetDoc.lastPrizeWon === "Better Luck") {
        toast("⚠️ इस ग्राहक को कोई इनाम नहीं मिला था (Better Luck)!", { icon: "ℹ️" });
      } else {
        toast.success(`असली इनाम: ${targetDoc.lastPrizeWon} ✅`);
      }
    } catch (e) {
      toast.error("वेरिफाई करने में समस्या आई!");
    } finally {
      setIsGameVerifying(false);
    }
  };

  // इनाम को इस्तेमाल (Redeem) मार्क करना
  const handleClaimGameReward = async () => {
    if (!gameVerifyResult) return;
    setIsClaimingReward(true);

    try {
      const phoneId = gameVerifyResult.phone || gameVerifyResult.id;
      await updateDoc(doc(db, "customer_points", phoneId), {
        voucherClaimed: true,
        voucherClaimedAt: new Date()
      });

      setGameVerifyResult((prev: any) => ({ ...prev, voucherClaimed: true }));
      toast.success("🎉 इनाम दे दिया गया और सिस्टम में लॉक हो गया!");
      fetchAllCustomers();
    } catch (e) {
      toast.error("स्टेटस अपडेट नहीं हो सका");
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Menu States
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [liveDbCoupons, setLiveDbCoupons] = useState<any[]>([]); // 👉 NEW: Database से कूपन लोड करने के लिए
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Category Manager
  const [isCatManagerModalOpen, setIsCatManagerModalOpen] = useState(false);
  const [mergeSourceCat, setMergeSourceCat] = useState('');
  const [mergeTargetCat, setMergeTargetCat] = useState('');

  // Reports
  const [reportFilter, setReportFilter] = useState<'today' | 'yesterday' | 'last7days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportOrders, setReportOrders] = useState<any[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [physicalCashInput, setPhysicalCashInput] = useState<number | ''>('');

  // Modals
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isItemEditorModalOpen, setIsItemEditorModalOpen] = useState(false);

  // Dynamic Item Editor
  const [editingItemObj, setEditingItemObj] = useState<any>(null);
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemCodeInput, setItemCodeInput] = useState('');
  const [itemPriceInput, setItemPriceInput] = useState<number | ''>(100);
  const [itemCatInput, setItemCatInput] = useState('Burgers');
  const [isAddingNewCatInput, setIsAddingNewCatInput] = useState(false);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('');
  const [itemImageInput, setItemImageInput] = useState('');
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [itemVariantsList, setItemVariantsList] = useState<{ [key: string]: number }>({});
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<number | ''>('');

  // Expense Form
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCategory, setExpenseCategory] = useState('Milk / Dairy');

  // Held Carts Storage
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Variation Modal (Keyboard First!)
  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);
  const [selectedProductForVariation, setSelectedProductForVariation] = useState<any>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedSizePrice, setSelectedSizePrice] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<{ [addon: string]: boolean }>({});
  const [itemNoteInput, setItemNoteInput] = useState('');

  // Past Receipts
  const [pastReceipts, setPastReceipts] = useState<any[]>([]);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptFilterDay, setReceiptFilterDay] = useState<'all' | 'today' | 'yesterday'>('today');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false); 
  const [receiptsLimit, setReceiptsLimit] = useState(200);
  const [isReceiptsLoading, setIsReceiptsLoading] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
// --- UDHARI BOOK STATES & LOGIC ---
  const [dueOrders, setDueOrders] = useState<any[]>([]);
  const [isUdhariLoading, setIsUdhariLoading] = useState(false);
  const [udhariSearchQuery, setUdhariSearchQuery] = useState('');

  const fetchDueOrders = async () => {
    setIsUdhariLoading(true);
    try {
      if (navigator.onLine) {
        const q = query(collection(db, "orders"), where("paymentMethod", "==", "due"));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by newest first
        docs.sort((a: any, b: any) => {
           const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
           const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
           return timeB - timeA;
        });
        setDueOrders(docs);
      }
    } catch (e) {
      toast.error("उधार लोड करने में त्रुटि आई!");
    } finally {
      setIsUdhariLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'udhari') fetchDueOrders();
  }, [activeTab]);

  const handleClearUdhari = async (orderId: string, method: 'cash' | 'upi') => {
    triggerBeep('tap');
    const toastId = toast.loading("उधार जमा किया जा रहा है...");
    try {
      await updateDoc(doc(db, "orders", orderId), {
        paymentMethod: method,
        udhariClearedAt: new Date(),
        udhariCleared: true
      });
      setDueOrders(prev => prev.filter(o => o.id !== orderId));
      toast.dismiss(toastId);
      toast.success(`उधार सफलतापूर्वक ${method.toUpperCase()} में जमा हो गया! ✅`);
      triggerBeep('success');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("उधार क्लियर करने में त्रुटि आई।");
    }
  };
  // ----------------------------------
  // --- CUSTOMER DIRECTORY TAB STATES & LOGIC ---
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerTabSearch, setCustomerTabSearch] = useState('');
// 👉 NEW: CUSTOMER SORTING & FILTERING
  const [customerSortBy, setCustomerSortBy] = useState<'recent' | 'points_high' | 'points_low' | 'spent_high'>('recent');
  
  // 👉 NEW: Pagination (पेज) के स्टेट्स (सिर्फ 50 ग्राहक दिखाने के लिए)
  const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
  const customersPerPage = 50;

  useEffect(() => {
    // जब भी कोई सर्च करे या फ़िल्टर बदले, तो पेज वापस 1 पर आ जाए
    setCustomerCurrentPage(1);
  }, [customerTabSearch, customerSortBy]);

  // 👉 FIX 2: फ़िल्टर (Sorting) फिक्स कर दिया गया है
  const processedCustomers = useMemo(() => {
    let filtered = [...allCustomers]; 
    
    if (customerTabSearch) {
      const q = customerTabSearch.toLowerCase();
      filtered = filtered.filter(c => 
        String(c.name || '').toLowerCase().includes(q) || 
        String(c.phone || c.id || '').includes(q) || 
        String(c.address || '').toLowerCase().includes(q)
      );
    }
    
    return filtered.sort((a, b) => {
      if (customerSortBy === 'spent_high') return (b.totalSpent || 0) - (a.totalSpent || 0);
      if (customerSortBy === 'points_high') return (b.points || 0) - (a.points || 0);
      if (customerSortBy === 'points_low') return (a.points || 0) - (b.points || 0);
      
      const timeA = a.lastActive?.toDate ? a.lastActive.toDate().getTime() : new Date(a.lastActive || 0).getTime();
      const timeB = b.lastActive?.toDate ? b.lastActive.toDate().getTime() : new Date(b.lastActive || 0).getTime();
      return timeB - timeA; // Default: Recent
    });
  }, [allCustomers, customerTabSearch, customerSortBy]);

  // 👉 NEW: 50 ग्राहकों का टुकड़ा (Slice) बनाने का लॉजिक
  const paginatedCustomers = useMemo(() => {
    const startIndex = (customerCurrentPage - 1) * customersPerPage;
    return processedCustomers.slice(startIndex, startIndex + customersPerPage);
  }, [processedCustomers, customerCurrentPage]);

  const totalCustomerPages = Math.ceil(processedCustomers.length / customersPerPage);
  const totalCustomersCount = allCustomers.length;
  const totalPointsInSystem = allCustomers.reduce((acc, c) => acc + (Number(c.points) || 0), 0);
  
  const [isAddEditCustModalOpen, setIsAddEditCustModalOpen] = useState(false);
  const [editingCustProfile, setEditingCustProfile] = useState<any>(null);
  
  const [custFormName, setCustFormName] = useState('');
  const [custFormPhone, setCustFormPhone] = useState('');
  const [custFormAddress, setCustFormAddress] = useState('');
  const [custFormPoints, setCustFormPoints] = useState<number | ''>(0);
// NEW: CUSTOMER HISTORY STATES & FUNCTION
  const [isCustHistoryModalOpen, setIsCustHistoryModalOpen] = useState(false);
  const [selectedHistoryCust, setSelectedHistoryCust] = useState<any>(null);
  const [custHistoryList, setCustHistoryList] = useState<any[]>([]);
  const [isCustHistoryLoading, setIsCustHistoryLoading] = useState(false);

  const handleViewCustomerHistory = async (cust: any) => {
    triggerBeep('tap');
    setSelectedHistoryCust(cust);
    setIsCustHistoryModalOpen(true);
    setIsCustHistoryLoading(true);
    setCustHistoryList([]);
    
    try {
      if (navigator.onLine) {
        const cleanPhone = cust.phone || cust.id;
        // Fetch recent 50 orders
        const q = query(collection(db, "orders"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);
        
        // Filter those orders that match the customer's phone
        const matchedOrders = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((o: any) => String(o.customerPhone || '').includes(cleanPhone));
        
        setCustHistoryList(matchedOrders);
      }
    } catch (e) {
      toast.error("हिस्ट्री लोड करने में त्रुटि आई!");
    } finally {
      setIsCustHistoryLoading(false);
    }
  };
  // 👉 FIX 1: 300 की लिमिट हटा दी गई है, अब सारे ग्राहक आएँगे!
 // 👉 FIX 1: 300 की लिमिट हटा दी गई है, अब सारे ग्राहक आएँगे!
  const fetchAllCustomers = async () => {
    setIsCustomersLoading(true);
    try {
      if (navigator.onLine) {
        // limit(300) हटा दिया गया है
        const q = query(collection(db, "customer_points"), orderBy("lastActive", "desc"));
        const snap = await getDocs(q);
        setAllCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      toast.error("ग्राहक सूची लोड नहीं हो सकी");
    } finally {
      setIsCustomersLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchAllCustomers(); // लॉगिन होते ही सारे कस्टमर लोड कर ले ताकि सर्च सुपरफास्ट हो
    }
  }, [isLoggedIn]);

 const handleSaveCustomerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = getSanitizedPhone(custFormPhone);
    if (cleanPhone.length !== 10) return toast.error("10-अंकों का सही मोबाइल नंबर डालें!");
    if (!custFormName.trim()) return toast.error("ग्राहक का नाम डालना अनिवार्य है!");

    const toastId = toast.loading("Saving customer...");
    try {
      const userRef = doc(db, "customer_points", cleanPhone);
      const payload = {
        name: custFormName.trim(),
        phone: cleanPhone,
        address: custFormAddress.trim(),
        points: Number(custFormPoints) || 0,
        lastActive: editingCustProfile ? editingCustProfile.lastActive : new Date()
      };
      
      await setDoc(userRef, payload, { merge: true });
      
      toast.dismiss(toastId);
      toast.success("ग्राहक की जानकारी सेव हो गई! ✅");
      setIsAddEditCustModalOpen(false);
      fetchAllCustomers();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("ग्राहक को सेव करने में त्रुटि आई");
    }
  };

  // 🗑️ ग्राहक को कन्फर्मेशन लेकर डिलीट करने का फंक्शन
  const handleDeleteCustomer = async (cust: any) => {
    triggerBeep('tap');
    const cleanPhone = cust.phone || cust.id;
    const custName = cust.name || 'Valued Guest';

    // पहले यूजर से पूछेंगे (कन्फर्मेशन अलर्ट)
    const isConfirmed = window.confirm(
      `⚠️ क्या आप सच में ग्राहक "${custName}" (${cleanPhone}) को डिलीट करना चाहते हैं?\n\nयह डेटाबेस से हमेशा के लिए हट जाएगा!`
    );

    if (!isConfirmed) return;

    const toastId = toast.loading("ग्राहक डिलीट हो रहा है...");
    try {
      await deleteDoc(doc(db, "customer_points", cleanPhone));
      setAllCustomers(prev => prev.filter(c => (c.phone || c.id) !== cleanPhone));
      toast.dismiss(toastId);
      toast.success(`"${custName}" सफलतापूर्वक डिलीट कर दिया गया! 🗑️`);
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("ग्राहक को डिलीट करने में त्रुटि आई!");
    }
  };

// 👉 NEW: ADVANCED LOYVERSE CSV IMPORT (With Duplicate Merging)
// 👉 NEW: ADVANCED LOYVERSE CSV IMPORT (With Duplicate Merging)
  const handleImportCustomersCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Loyverse डेटा चेक और मर्ज हो रहा है...");
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length < 2) {
          toast.dismiss(toastId);
          return toast.error("CSV फाइल खाली है या हेडर नहीं है!");
        }

        const headers = rows[0].toLowerCase().split(',');
        const nameIdx = headers.findIndex(h => h.includes('customer name') || h.includes('name'));
        const phoneIdx = headers.findIndex(h => h === 'phone' || h.includes('phone'));
        const pointsIdx = headers.findIndex(h => h.includes('points balance') || h.includes('points'));
        const addrIdx = headers.findIndex(h => h === 'address');
        const cityIdx = headers.findIndex(h => h === 'city');
        const spentIdx = headers.findIndex(h => h.includes('total spent'));
        const visitsIdx = headers.findIndex(h => h.includes('total visits'));

        if (phoneIdx === -1) {
          toast.dismiss(toastId);
          return toast.error("CSV में 'Phone' कॉलम नहीं मिला!");
        }

        // 👉 स्मार्ट डुप्लीकेट चेकर (Excel के अंदर डुप्लीकेट पकड़ने के लिए)
        const uniqueCustomers = new Map();

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          const rawPhone = cols[phoneIdx] || '';
          const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
          
          if (cleanPhone.length === 10) {
            const name = nameIdx > -1 ? (cols[nameIdx] || 'Walk-in Guest').replace(/"/g, '').trim() : 'Guest';
            const points = pointsIdx > -1 && cols[pointsIdx] ? Math.round(Number(cols[pointsIdx])) : 0;
            const totalSpent = spentIdx > -1 && cols[spentIdx] ? Math.round(Number(cols[spentIdx])) : 0;
            const totalVisits = visitsIdx > -1 && cols[visitsIdx] ? Math.round(Number(cols[visitsIdx])) : 0;
            
            let address = addrIdx > -1 ? (cols[addrIdx] || '').replace(/"/g, '').trim() : '';
            const city = cityIdx > -1 ? (cols[cityIdx] || '').replace(/"/g, '').trim() : '';
            if (city && !address.includes(city)) address = address ? `${address}, ${city}` : city;

            // अगर यह नंबर मैप में पहले से है, तो दोनों का डेटा जोड़ (Merge) दें
            if (uniqueCustomers.has(cleanPhone)) {
              const existing = uniqueCustomers.get(cleanPhone);
              existing.points = Math.max(existing.points, points); // जो पॉइंट्स ज्यादा हों, वो रखें
              existing.totalSpent += totalSpent; // खर्चा जोड़ दें
              existing.totalVisits += totalVisits; // विजिट्स जोड़ दें
              if (!existing.address && address) existing.address = address; // एड्रेस खाली हो तो भर दें
              if (existing.name === 'Guest' || existing.name === 'Walk-in Guest') existing.name = name;
            } else {
              // नया नंबर है तो मैप में सेव करें
              uniqueCustomers.set(cleanPhone, { name, points, totalSpent, totalVisits, address });
            }
          }
        }

        let importedCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;

        // अब बिना डुप्लीकेट वाले इस क्लीन डेटा को Firebase में डालें
        uniqueCustomers.forEach((data, phone) => {
          const docRef = doc(db, "customer_points", phone);
          batch.set(docRef, {
            name: data.name || 'Valued Guest',
            phone: phone,
            points: isNaN(data.points) ? 0 : data.points,
            totalSpent: isNaN(data.totalSpent) ? 0 : data.totalSpent,
            totalVisits: isNaN(data.totalVisits) ? 0 : data.totalVisits,
            address: data.address,
            lastActive: new Date(),
            isImported: true,
            importSource: 'Loyverse'
          }, { merge: true }); // Merge True = पुराने सेव डेटा को उड़ाएगा नहीं!

          importedCount++;
          batchCount++;

          if (batchCount >= 450) {
            batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }

        toast.dismiss(toastId);
        toast.success(`डुप्लीकेट्स हटा दिए गए! ${importedCount} ग्राहक सफलतापूर्वक मर्ज और सेव हो गए! 🎉`);
        fetchAllCustomers();
        
      } catch (err) {
        toast.dismiss(toastId);
        toast.error("CSV इम्पोर्ट फेल हो गया।");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // इनपुट रीसेट
  };
  const openAddCustomerModal = () => {
    setEditingCustProfile(null);
    setCustFormName('');
    setCustFormPhone('');
    setCustFormAddress('');
    setCustFormPoints(0);
    setIsAddEditCustModalOpen(true);
  };

  const openEditCustomerModal = (cust: any) => {
    setEditingCustProfile(cust);
    setCustFormName(cust.name || '');
    setCustFormPhone(cust.phone || cust.id || '');
    setCustFormAddress(cust.address || '');
    setCustFormPoints(cust.points || 0);
    setIsAddEditCustModalOpen(true);
  };
  // ---------------------------------------------
  
  // Cart & Order States
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // Collapsible Discount & Admin Promo Code State
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [promoCouponInput, setPromoCouponInput] = useState('');
  const [appliedPromoName, setAppliedPromoName] = useState<string | null>(null);

  // 📦 PACKING CHARGE STATE
  const [applyPackingCharge, setApplyPackingCharge] = useState<boolean>(false);
  const [packingCharge, setPackingCharge] = useState<number | ''>(10);

  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup' | 'table'>('pickup');
  const [selectedArea, setSelectedArea] = useState<DeliveryArea>(DELIVERY_AREAS[0]);
  const [applyDeliveryFee, setApplyDeliveryFee] = useState<boolean>(false);
  const [customDeliveryFee, setCustomDeliveryFee] = useState<number | ''>(20);
  const [tableNumber, setTableNumber] = useState('Table 1');
  
  // Track Active Editing Table Order & Previous Items for KOT Delta
  const [activeEditingOrderId, setActiveEditingOrderId] = useState<string | null>(null);
  const [activeEditingBillNumber, setActiveEditingBillNumber] = useState<number | null>(null);
  const [activeEditingOriginalItems, setActiveEditingOriginalItems] = useState<PosCartItem[]>([]);
  const [activeEditingPreviousOrder, setActiveEditingPreviousOrder] = useState<any>(null); // 👈 पुराने बिल का हिसाब याद रखने के लिए
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'split' | 'due'>('cash');
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitUpiAmount, setSplitUpiAmount] = useState<number>(0);

  // Settlement Filter
  const [settlementFilter, setSettlementFilter] = useState<'all' | 'unsettled' | 'settled'>('all');

  // Focus & Audio Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const newCustNameRef = useRef<HTMLInputElement | null>(null);
  const newCustAddressRef = useRef<HTMLInputElement | null>(null);
  const isInitialOrdersLoad = useRef<boolean>(true);
  
  // 👉 NEW: बाहर क्लिक करने पर ड्रॉपडाउन बंद करने का Ref
  const custDropdownRef = useRef<HTMLDivElement | null>(null);

  // 👉 NEW: बाहर क्लिक करने को पकड़ने वाला लॉजिक
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (custDropdownRef.current && !custDropdownRef.current.contains(event.target as Node)) {
        setShowCustDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getSanitizedPhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
  // Invoice Number Generator
  const getNextBillNumber = (): number => {
    const saved = localStorage.getItem("bb_pos_local_bill_counter_pc");
    let current = saved ? parseInt(saved, 10) : 199;
    if (isNaN(current) || current < 199 || current >= 10000) {
      current = 199;
    }
    const next = current + 1;
    localStorage.setItem("bb_pos_local_bill_counter_pc", String(next));
    setManualInvoiceCounterInput(String(next + 1));
    return next;
  };

  const triggerBeep = (type: 'tap' | 'success' | 'alarm') => {
    try {
      if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (globalAudioCtx.state === 'suspended') { globalAudioCtx.resume(); }
      const osc = globalAudioCtx.createOscillator();
      const gain = globalAudioCtx.createGain();
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      if (type === 'tap') {
        osc.frequency.setValueAtTime(600, globalAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, globalAudioCtx.currentTime);
        osc.start(); osc.stop(globalAudioCtx.currentTime + 0.08);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523, globalAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, globalAudioCtx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(659, globalAudioCtx.currentTime + 0.12);
        osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime + 0.24);
        osc.stop(globalAudioCtx.currentTime + 0.4);
      } else if (type === 'alarm') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, globalAudioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1400, globalAudioCtx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.2, globalAudioCtx.currentTime);
        osc.start(); osc.stop(globalAudioCtx.currentTime + 0.65);
      }
    } catch (e) {}
  };

  // Calculations
  const getCartSubtotal = () => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  
  const getDeliveryCharge = () => {
    if (fulfillmentType !== "delivery" || getCartSubtotal() === 0 || !applyDeliveryFee) {
      return 0;
    }
    return Number(customDeliveryFee) || 0;
  };

  const getGstAmountCalculated = () => gstEnabled ? Number(((getCartSubtotal() * gstRate) / 100).toFixed(2)) : 0;
  const getRedemptionDiscount = () => isRedeemingPoints ? Math.min(pointsToRedeem, getCartSubtotal() + getGstAmountCalculated()) : 0;
  
  const getCalculatedDiscountAmount = () => {
    const sub = getCartSubtotal();
    if (discountType === 'amount') {
      return Math.min(discountValue, sub);
    } else {
      return Math.min(Number(((sub * discountValue) / 100).toFixed(2)), sub);
    }
  };

  const getPackingCharge = () => {
    if (!applyPackingCharge || getCartSubtotal() === 0) return 0;
    return Number(packingCharge) || 0;
  };

  const getTotalBillPrice = () => Math.max(0, getCartSubtotal() + getGstAmountCalculated() - getCalculatedDiscountAmount() - getRedemptionDiscount()) + getDeliveryCharge() + getPackingCharge();
  // Change Return Calculation
  const changeReturnAmount = useMemo(() => {
    if (cashTendered === '' || isNaN(Number(cashTendered))) return 0;
    const diff = Number(cashTendered) - getTotalBillPrice();
    return diff > 0 ? diff : 0;
  }, [cashTendered, cart, discountValue, isRedeemingPoints, pointsToRedeem, applyDeliveryFee, customDeliveryFee]);

  // Active Orders
  const activeLiveOrders = useMemo(() => liveOrders.filter((o) => (o.fulfillmentType === 'delivery' || o.fulfillmentType === 'pickup') && o.status !== 'completed' && o.status !== 'rejected'), [liveOrders]);
  const activeTableOrders = useMemo(() => liveOrders.filter((o) => o.fulfillmentType === 'table' && o.status !== 'completed' && o.status !== 'rejected'), [liveOrders]);

  // Today's orders for Daily Bills (रिजेक्टेड ऑर्डर्स हटाये गए)
  const todaySettlementOrders = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).getTime();
    return liveOrders.filter((o) => {
      const orderTime = o.timestamp?.toDate ? o.timestamp.toDate().getTime() : new Date(o.timestamp || Date.now()).getTime();
      // 🚫 रिजेक्टेड या कैंसल ऑर्डर्स डेली बिल्स में नहीं दिखेंगे
      return orderTime >= todayStart && o.status !== 'rejected' && o.status !== 'cancelled';
    });
  }, [liveOrders]);

  const unsettledOrdersCount = useMemo(() => {
    return todaySettlementOrders.filter(o => o.status === 'unsettled' || (o.status === 'pending' && !o.paymentSettled)).length;
  }, [todaySettlementOrders]);

  const filteredSettlementOrders = useMemo(() => {
    if (settlementFilter === 'unsettled') {
      return todaySettlementOrders.filter(o => o.status === 'unsettled' || (o.status === 'pending' && !o.paymentSettled));
    }
    if (settlementFilter === 'settled') {
      return todaySettlementOrders.filter(o => o.status === 'completed');
    }
    return todaySettlementOrders;
  }, [todaySettlementOrders, settlementFilter]);

  // Offline / Online Detection & Sync
  const syncOfflineAll = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    let orderCount = 0;
    let expenseCount = 0;

    try {
      const offlineOrdersStr = localStorage.getItem("bb_pos_offline_orders_queue");
      if (offlineOrdersStr) {
        let queue: any[] = JSON.parse(offlineOrdersStr);
        let remainingQueue = [...queue];
        if (queue.length > 0) {
          for (const ord of queue) {
            await addDoc(collection(db, "orders"), {
              ...ord,
              timestamp: ord.timestamp ? new Date(ord.timestamp) : new Date()
            });
            orderCount++;
            // FIX: Remove synced order immediately to prevent duplicates on internet drop
            remainingQueue = remainingQueue.filter(o => o.billNumber !== ord.billNumber);
            localStorage.setItem("bb_pos_offline_orders_queue", JSON.stringify(remainingQueue));
          }
          if (remainingQueue.length === 0) localStorage.removeItem("bb_pos_offline_orders_queue");
        }
      }

      const offlineExpensesStr = localStorage.getItem("bb_pos_offline_expenses_queue");
      if (offlineExpensesStr) {
        let expQueue: any[] = JSON.parse(offlineExpensesStr);
        let remainingExpQueue = [...expQueue];
        if (expQueue.length > 0) {
          for (const exp of expQueue) {
            await addDoc(collection(db, "daily_expenses"), {
              ...exp,
              timestamp: exp.timestamp ? new Date(exp.timestamp) : new Date()
            });
            expenseCount++;
            // FIX: Remove synced expense immediately
            remainingExpQueue = remainingExpQueue.filter(e => e.title !== exp.title || e.amount !== exp.amount);
            localStorage.setItem("bb_pos_offline_expenses_queue", JSON.stringify(remainingExpQueue));
          }
          if (remainingExpQueue.length === 0) localStorage.removeItem("bb_pos_offline_expenses_queue");
        }
      }

      if (orderCount > 0 || expenseCount > 0) {
        toast.success(`Cloud Sync: ${orderCount} Orders & ${expenseCount} Expenses Synced! ✅`);
      }
    } catch (e) {
      console.error("Offline sync error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Internet re-connected! 🟢");
      syncOfflineAll();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast("Working Offline Mode! Data will save locally 💾", { icon: '⚠️' });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Split payment auto-sync
  useEffect(() => {
    const total = getTotalBillPrice();
    if (paymentMethod === 'split') {
      const half = Math.floor(total / 2);
      setSplitCashAmount(half);
      setSplitUpiAmount(total - half);
    }
  }, [cart, discountValue, discountType, isRedeemingPoints, pointsToRedeem, paymentMethod, fulfillmentType, applyDeliveryFee, customDeliveryFee]);

  const saveHeldCartsToStorage = (newList: HeldCart[]) => {
    setHeldCarts(newList);
    localStorage.setItem("bb_pos_held_carts", JSON.stringify(newList));
  };

  const handleHoldCurrentCart = () => {
    if (cart.length === 0) return toast.error("Cart is empty!");
    triggerBeep('tap');

    const newHold: HeldCart = {
      id: `hold_${Date.now()}`,
      cart: [...cart],
      customerName: customerName || 'Walk-in Guest',
      customerPhone,
      tableNumber,
      fulfillmentType,
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: getTotalBillPrice()
    };

    saveHeldCartsToStorage([newHold, ...heldCarts]);
    toast.success(`Cart parked on Hold! [${newHold.customerName}]`, { icon: '⏸️' });

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCartCustSearchInput(''); // <--- यह नई लाइन यहाँ भी जोड़ें
    setAddress('');
    setDiscountValue(0);
    setIsRedeemingPoints(false);
    setPointsToRedeem(0);
    setCashTendered('');
    localStorage.removeItem("bb_pos_saved_cart_pc");
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  const handleRestoreHeldCart = (heldItem: HeldCart) => {
    triggerBeep('tap');
    if (cart.length > 0) {
      if (!window.confirm("Replace active cart with this held order?")) return;
    }
    setCart(heldItem.cart);
    setCustomerName(heldItem.customerName === 'Walk-in Guest' ? '' : heldItem.customerName);
    setCustomerPhone(heldItem.customerPhone || '');
    setTableNumber(heldItem.tableNumber || 'Table 1');
    setFulfillmentType(heldItem.fulfillmentType || 'pickup');
    
    saveHeldCartsToStorage(heldCarts.filter(h => h.id !== heldItem.id));
    setIsHeldCartsModalOpen(false);
    setActiveTab('billing');
    toast.success(`Restored order of ${heldItem.customerName}!`, { icon: '▶️' });
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  const handleDeleteHeldCart = (holdId: string) => {
    triggerBeep('tap');
    saveHeldCartsToStorage(heldCarts.filter(h => h.id !== holdId));
    toast.success("Held cart removed.");
  };

  // Load Saved Settings
  useEffect(() => {
    const savedHeld = localStorage.getItem("bb_pos_held_carts");
    if (savedHeld) {
      try { setHeldCarts(JSON.parse(savedHeld)); } catch (e) {}
    }
    const savedUpi = localStorage.getItem("bb_pos_upi_id");
    if (savedUpi) setUpiIdConfig(savedUpi);
    const savedOwnerPhone = localStorage.getItem("bb_pos_owner_phone");
    if (savedOwnerPhone) setOwnerPhoneConfig(savedOwnerPhone);

    const savedCounter = localStorage.getItem("bb_pos_local_bill_counter_pc");
    if (!savedCounter || Number(savedCounter) < 199 || Number(savedCounter) >= 10000) {
      localStorage.setItem("bb_pos_local_bill_counter_pc", "199");
      setManualInvoiceCounterInput("200");
    } else {
      setManualInvoiceCounterInput(String(Number(savedCounter) + 1));
    }

    const savedUser = localStorage.getItem("bb_pos_user_pc");
    if (savedUser) { 
      try { 
        setIsLoggedIn(true); 
        setCurrentUser(JSON.parse(savedUser)); 
      } catch (e) {} 
    }
    setGstEnabled(localStorage.getItem("bb_pos_gst_enabled_pc") === 'true');
    setGstRate(Number(localStorage.getItem("bb_pos_gst_rate_pc")) || 5);
    setKotEnabled(localStorage.getItem("bb_pos_kot_enabled_pc") !== 'false'); 

    const localTheme = localStorage.getItem("bb_pos_theme_pc") || 'light';
    setThemeMode(localTheme as any);
    if (localTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const savedCart = localStorage.getItem("bb_pos_saved_cart_pc");
    const savedRecents = localStorage.getItem("bb_pos_recent_customers");
    if (savedRecents) {
      try { setRecentCartCustomers(JSON.parse(savedRecents)); } catch (err) {}
    }
    if (savedCart) { 
      try { setCart(JSON.parse(savedCart)); } catch (err) {} 
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("bb_pos_saved_cart_pc", JSON.stringify(cart));
  }, [cart]);

  // Clean Categories
  const normalizeCategoryList = (rawItems: any[]) => {
    const cleaned = rawItems.map((i: any) => {
      const c = (i.category || 'Burgers').trim();
      return c.charAt(0).toUpperCase() + c.slice(1);
    });
    const unique = Array.from(new Set(cleaned.filter(Boolean))) as string[];
    
    const savedOrderStr = localStorage.getItem("bb_pos_category_order");
    let ordered = unique.sort();
    if (savedOrderStr) {
      try {
        const savedOrder: string[] = JSON.parse(savedOrderStr);
        ordered = [
          ...savedOrder.filter(c => unique.includes(c)),
          ...unique.filter(c => !savedOrder.includes(c))
        ];
      } catch (e) {}
    }
    return ['All', ...ordered];
  };

  const handleMoveCategory = (catName: string, direction: 'left' | 'right') => {
    if (catName === 'All') return;
    const cleanCats = categories.filter(c => c !== 'All');
    const index = cleanCats.indexOf(catName);
    if (index === -1) return;

    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cleanCats.length) return;

    const updated = [...cleanCats];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    localStorage.setItem("bb_pos_category_order", JSON.stringify(updated));
    setCategories(['All', ...updated]);
    toast.success(`Category "${catName}" moved!`);
  };

  const handleMergeCategories = async () => {
    if (!mergeSourceCat || !mergeTargetCat) return toast.error("Select both categories to merge!");
    if (mergeSourceCat === mergeTargetCat) return toast.error("Source and Target must be different!");
    if (!window.confirm(`Merge all items from "${mergeSourceCat}" into "${mergeTargetCat}"? This cannot be undone.`)) return;

    const toastId = toast.loading("Merging categories...");
    try {
      const itemsToUpdate = products.filter(p => (p.category || '').toLowerCase() === mergeSourceCat.toLowerCase());
      for (const item of itemsToUpdate) {
        await updateDoc(doc(db, "products", item.id), { category: mergeTargetCat });
      }

      setProducts(prev => prev.map(p => (p.category || '').toLowerCase() === mergeSourceCat.toLowerCase() ? { ...p, category: mergeTargetCat } : p));
      const newItems = products.map(p => (p.category || '').toLowerCase() === mergeSourceCat.toLowerCase() ? { ...p, category: mergeTargetCat } : p);
      setCategories(normalizeCategoryList(newItems));
      
      setIsCatManagerModalOpen(false);
      toast.dismiss(toastId);
      toast.success(`Merged ${itemsToUpdate.length} items into "${mergeTargetCat}"! ✅`);
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("Failed to merge categories");
    }
  };

  const generateNextCategoryCode = (catName: string, currentList = products) => {
    const base = getCategoryBaseCode(catName);
    const existingNums = currentList
      .filter(p => (p.category || '').trim().toLowerCase() === catName.trim().toLowerCase())
      .map(p => parseInt(String(p.itemCode || '0'), 10))
      .filter(num => !isNaN(num) && num >= base && num < base + 100);

    if (existingNums.length === 0) {
      return String(base === 1 ? 1 : base + 1);
    }
    return String(Math.max(...existingNums) + 1);
  };

  // Products Loading with guaranteed Name & Price fallback
  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      setLoading(true);
      try {
        let items: any[] = [];
        if (navigator.onLine) {
          const prodSnap = await getDocs(collection(db, "products"));
          items = prodSnap.docs.map((d) => {
            const data = d.data();
            const cat = data.category || 'Burgers';

            let resolvedPrice = Number(data.price);
            if (isNaN(resolvedPrice) || resolvedPrice <= 0) {
              if (data.variants && typeof data.variants === 'object') {
                const vals = Object.values(data.variants);
                if (vals.length > 0) resolvedPrice = Number(vals[0]) || 0;
              }
            }
            if (isNaN(resolvedPrice)) resolvedPrice = 0;

            return {
              id: d.id,
              ...data,
              name: data.name || data.title || data.itemName || 'Cafe Item',
              price: resolvedPrice,
              category: cat,
              itemCode: data.itemCode ? String(data.itemCode).trim() : ''
            };
          });

          const catCountMap: { [cat: string]: number } = {};
          items = items.map((item) => {
            const cat = item.category;
            const base = getCategoryBaseCode(cat);
            if (!catCountMap[cat]) catCountMap[cat] = base === 1 ? 0 : base;
            catCountMap[cat] += 1;
            
            if (!item.itemCode || isNaN(parseInt(item.itemCode, 10))) {
              return { ...item, itemCode: String(catCountMap[cat]) };
            }
            return item;
          });

          localStorage.setItem("bb_pos_cached_products", JSON.stringify(items));
        } else {
          const cached = localStorage.getItem("bb_pos_cached_products");
          if (cached) items = JSON.parse(cached);
        }
        setProducts(items);
        setCategories(normalizeCategoryList(items));
      } catch (err) {
        const cached = localStorage.getItem("bb_pos_cached_products");
        if (cached) {
          const items = JSON.parse(cached);
          setProducts(items);
          setCategories(normalizeCategoryList(items));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // Real-time listener for live orders
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLiveOrders(ordersList);

      if (isInitialOrdersLoad.current) {
        isInitialOrdersLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newOrd: any = change.doc.data();
          if (newOrd.status === 'pending' && newOrd.source !== 'PC_POS') {
            triggerBeep('alarm');
            toast((t) => (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 text-white rounded-full animate-bounce">
                  <BellRing size={20} />
                </div>
                <div>
                  <p className="font-black text-xs uppercase text-orange-600">🔔 नया ऑनलाइन आर्डर आया है!</p>
                  <p className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                    {newOrd.customerName || 'Customer'} - ₹{newOrd.total} ({newOrd.fulfillmentType || 'delivery'})
                  </p>
                </div>
              </div>
            ), { duration: 7000 });
            // 👉 NEW: ऑनलाइन आर्डर आने पर नंबर अपने-आप Customer List और Recent 10 में सेव करें
            const cleanOnlinePhone = (newOrd.customerPhone || '').replace(/\D/g, '').slice(-10);
            if (cleanOnlinePhone.length === 10) {
              
              // 1. Recent 10 List में जोड़ें
              setRecentCartCustomers(prev => {
                const filtered = prev.filter(c => c.phone !== cleanOnlinePhone);
                const next = [{ name: newOrd.customerName || "Online Guest", phone: cleanOnlinePhone }, ...filtered].slice(0, 10);
                localStorage.setItem("bb_pos_recent_customers", JSON.stringify(next));
                return next;
              });

              // 2. Main Customer Directory में जोड़ें
              const userRef = doc(db, "customer_points", cleanOnlinePhone);
              setDoc(userRef, { 
                name: newOrd.customerName || "Online Guest", 
                phone: cleanOnlinePhone,
                lastActive: new Date()
              }, { merge: true });
            }
          }
        }
      });
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for live orders
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // ... (यहाँ आपका पुराना कोड होगा)
    });
    return () => unsubscribe();
  }, []);

  // 👇👇 यहाँ अपना नया कोड पेस्ट करें 👇👇

  // 👉 NEW: Firebase से लाइव कूपन लोड करें
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsubCoupons = onSnapshot(collection(db, "coupons"), (snap) => {
      setLiveDbCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubCoupons();
  }, [isLoggedIn]);

  // 👆👆 नया कोड यहाँ खत्म 👆👆
 
  // 👉 NEW: स्मार्ट नाम और नंबर सर्च लॉजिक
  // 👉 NEW: स्मार्ट नाम और नंबर सर्च लॉजिक (Recent 10 Customers के साथ)
  const handleCustomerSearchChange = (val: string) => {
    setCartCustSearchInput(val);
    setCustomerPhone(val.replace(/\D/g, '').slice(0, 10)); // बैकग्राउंड के लिए सिर्फ नंबर अलग करें

    if (val.length >= 3) {
      const lowerVal = val.toLowerCase();
      const matches = allCustomers.filter(c => 
        (c.phone && c.phone.includes(lowerVal)) || 
        (c.name && c.name.toLowerCase().includes(lowerVal))
      ).slice(0, 6);
      
      setCustSuggestions(matches);
      setShowCustDropdown(true);
    } else if (val.length === 0) {
      // 👉 NEW: जब इनपुट खाली हो, तो ड्रॉपडाउन में Recent 10 Customers दिखाएँ
      const enrichedRecents = recentCartCustomers.map(rc => {
        // पॉइंट्स और लेटेस्ट डेटा के लिए Main लिस्ट से मैच करें
        const fullCust = allCustomers.find(c => c.phone === rc.phone || c.id === rc.phone);
        return fullCust || rc; 
      });
      setCustSuggestions(enrichedRecents);
      if (enrichedRecents.length > 0) setShowCustDropdown(true);
    } else {
      setShowCustDropdown(false);
      setCustSuggestions([]);
      setCustomerName('');
      setCustomerPoints(0);
      setAddress('');
      setShowNewCustForm(false);
    }
  };
  // ड्रॉपडाउन से कस्टमर सेलेक्ट करने पर
  const handleSelectDropdownCustomer = (cust: any) => {
    triggerBeep('tap');
    setCustomerPhone(cust.phone || cust.id);
    setCustomerName(cust.name || 'Valued Guest');
    setCustomerPoints(cust.points || 0);
    setAddress(cust.address || '');
    setCartCustSearchInput(`${cust.name} - ${cust.phone || ''}`); // इनपुट बॉक्स में नाम दिखेगा
    setShowCustDropdown(false);
    setShowNewCustForm(false);
    toast.success(`ग्राहक मिला: ${cust.name}`);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const searchCustomerByExactPhone = async (phoneStr: string) => {
    const toastId = toast.loading("ग्राहक खोज रहे हैं...");
    try {
      const userRef = doc(db, "customer_points", phoneStr);
      const snap = await getDoc(userRef);
      toast.dismiss(toastId);

      if (snap.exists()) {
        const data = snap.data();
        setCustomerName(data.name || 'Valued Guest');
        setCustomerPoints(Number(data.points) || 0);
        setAddress(data.address || '');
        setShowNewCustForm(false);
        toast.success(`ग्राहक मिला: ${data.name} (${data.points || 0} Pts)`);
        setTimeout(() => searchInputRef.current?.focus(), 80);
      } else {
        setCustomerName('');
        setCustomerPoints(0);
        setAddress('');
        setShowNewCustForm(true);
        toast("नया ग्राहक! नाम दर्ज करें", { icon: '👤' });
        setTimeout(() => newCustNameRef.current?.focus(), 80);
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("ग्राहक डेटा लोड नहीं हो सका");
    }
  };

  const handleSaveNewCustomerQuick = async () => {
    const cleanPhone = getSanitizedPhone(customerPhone);
    const nameTrim = newCustNameInput.trim();
    if (!nameTrim) return toast.error("Enter customer name!");
    if (cleanPhone.length !== 10) return toast.error("Enter valid 10-digit phone!");

    const toastId = toast.loading("Saving customer...");
    try {
      const userRef = doc(db, "customer_points", cleanPhone);
      const newCustObj = {
        name: nameTrim,
        phone: cleanPhone,
        address: newCustAddressInput.trim(),
        points: 0,
        lastActive: new Date()
      };
      if (navigator.onLine) {
        await setDoc(userRef, newCustObj, { merge: true });
      }

      setCustomerName(nameTrim);
      setCartCustSearchInput(`${nameTrim} - ${cleanPhone}`); // 👉 यह लाइन जोड़ें
      setAddress(newCustAddressInput.trim());
      setCustomerPoints(0);
      setShowNewCustForm(false);
      setNewCustNameInput('');
      setNewCustAddressInput('');
      toast.dismiss(toastId);
      toast.success("Customer saved & linked! ✅");
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to save customer");
    }
  };

  // Search input keydown with support for QTY*CODE (e.g. 3*101)
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchQuery.trim().toLowerCase();
      if (!val) return;

      let qty = 1;
      let cleanQ = val;

      if (val.includes('*')) {
        const parts = val.split('*');
        qty = parseInt(parts[0], 10) || 1;
        cleanQ = (parts[1] || '').trim();
      }

      const exactCodeMatch = products.find(p => String(p.itemCode || '').trim().toLowerCase() === cleanQ);
      if (exactCodeMatch) {
        handleItemClick(exactCodeMatch, qty);
        setSearchQuery('');
        return;
      }

      const matchedByName = products.find(p => (p.name || '').toLowerCase().includes(cleanQ));
      if (matchedByName) {
        handleItemClick(matchedByName, qty);
        setSearchQuery('');
      } else {
        toast.error("No matching item found!");
      }
    }
  };

  const handleApplyPromoCoupon = () => {
    const code = promoCouponInput.trim().toUpperCase();
    if (!code) return toast.error("Enter a promo code!");

    // 1. सबसे पहले Firebase (Admin Panel) वाले लाइव कूपन में चेक करें
    const dbCoupon = liveDbCoupons.find(c => c.code === code);
    
    if (dbCoupon) {
      setDiscountType('amount'); // एडमिन से अभी फ्लैट डिस्काउंट ही बन रहा है
      setDiscountValue(Number(dbCoupon.discountValue));
      setAppliedPromoName(code);
      toast.success(`Coupon "${code}" (₹${dbCoupon.discountValue} OFF) लागू हो गया! 🎉`);
      return;
    }

    // 2. अगर वहां नहीं मिला, तो पुरानी फिक्स लिस्ट (PROMO_COUPONS) में चेक करें
    if (PROMO_COUPONS[code]) {
      const c = PROMO_COUPONS[code];
      if (c.type === 'percent') {
        setDiscountType('percentage');
        setDiscountValue(c.value);
      } else {
        setDiscountType('amount');
        setDiscountValue(c.value);
      }
      setAppliedPromoName(code);
      toast.success(`Coupon "${code}" लागू हो गया! 🎉`);
      return;
    }

    toast.error("कूपन कोड गलत है या एक्सपायर हो चुका है! ❌");
  };

  const handleDeleteProduct = async (itemId: string, itemName: string) => {
    triggerBeep('tap');
    if (!window.confirm(`Are you sure you want to permanently delete "${itemName}"? This item will be removed from your menu.`)) {
      return;
    }
    const toastId = toast.loading(`Deleting ${itemName}...`);
    try {
      await deleteDoc(doc(db, "products", itemId));
      setProducts(prev => prev.filter(p => p.id !== itemId));
      toast.dismiss(toastId);
      toast.success(`"${itemName}" deleted successfully! 🗑️`);
      setIsItemEditorModalOpen(false);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to delete item");
    }
  };

  const handleAddVariantRow = () => {
    const name = newVariantName.trim();
    const price = Number(newVariantPrice);
    if (!name) return toast.error("Enter variation name (e.g. Half, Full)!");
    if (isNaN(price) || price < 0) return toast.error("Enter a valid price!");
    setItemVariantsList(prev => ({ ...prev, [name]: price }));
    setNewVariantName('');
    setNewVariantPrice('');
    toast.success(`Variant "${name} (₹${price})" added!`);
  };

  const handleRemoveVariantRow = (key: string) => {
    setItemVariantsList(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleApplyVariantPreset = (presetType: 'half_full' | 'plain_butter' | 'pizza' | 'reg_large') => {
    const base = Number(itemPriceInput) || 100;
    setHasVariants(true);
    if (presetType === 'half_full') {
      setItemVariantsList({ 'Half': Math.round(base * 0.6), 'Full': base });
    } else if (presetType === 'plain_butter') {
      setItemVariantsList({ 'Plain': base, 'Butter': base + 10, 'Cheese': base + 30 });
    } else if (presetType === 'pizza') {
      setItemVariantsList({ 'Small': base, 'Medium': Math.round(base * 1.6), 'Large': Math.round(base * 2.2) });
    } else if (presetType === 'reg_large') {
      setItemVariantsList({ 'Regular': base, 'Large': Math.round(base * 1.4) });
    }
    toast.success("Applied presets!");
  };

  const handleOpenItemEditor = (item: any = null) => {
    triggerBeep('tap');
    setIsAddingNewCatInput(false);
    setNewCustomCategoryName('');
    if (item) {
      setEditingItemObj(item);
      setItemNameInput(item.name || item.title || '');
      setItemCodeInput(item.itemCode || '');
      setItemPriceInput(item.price !== undefined ? Number(item.price) : 100);
      setItemCatInput(item.category || 'Burgers');
      setItemImageInput(item.image || item.imageUrl || '');
      setItemIsAvailable(item.isAvailable !== false);
      if (item.variants && typeof item.variants === 'object' && Object.keys(item.variants).length > 0) {
        setHasVariants(true);
        setItemVariantsList({ ...item.variants });
      } else {
        setHasVariants(false);
        setItemVariantsList({});
      }
    } else {
      setEditingItemObj(null);
      setItemNameInput('');
      const defaultCat = categories.find(c => c !== 'All') || 'Burgers';
      setItemCatInput(defaultCat);
      setItemCodeInput(generateNextCategoryCode(defaultCat));
      setItemPriceInput(100);
      setItemImageInput('');
      setItemIsAvailable(true);
      setHasVariants(false);
      setItemVariantsList({});
    }
    setNewVariantName('');
    setNewVariantPrice('');
    setIsItemEditorModalOpen(true);
  };

  const handleSaveItemToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameInput.trim()) return toast.error("Item name required!");
    const toastId = toast.loading("Saving menu item...");

    const finalCategory = isAddingNewCatInput && newCustomCategoryName.trim() 
      ? newCustomCategoryName.trim() 
      : itemCatInput.trim() || 'Burgers';

    try {
      const cleanVariants = (hasVariants && Object.keys(itemVariantsList).length > 0) ? itemVariantsList : null;

      const itemData: any = {
        name: itemNameInput.trim(),
        itemCode: itemCodeInput.trim(),
        price: Number(itemPriceInput) || 0,
        category: finalCategory,
        image: itemImageInput.trim(),
        variants: cleanVariants,
        isAvailable: itemIsAvailable,
        updatedAt: new Date()
      };

      if (editingItemObj) {
        await updateDoc(doc(db, "products", editingItemObj.id), itemData);
        setProducts(prev => prev.map(p => p.id === editingItemObj.id ? { id: editingItemObj.id, ...itemData } : p));
        toast.success("Item updated! ✅");
      } else {
        const docRef = await addDoc(collection(db, "products"), itemData);
        setProducts(prev => [...prev, { id: docRef.id, ...itemData }]);
        toast.success("New item added! ✅");
      }

      setCategories(normalizeCategoryList([...products, itemData]));
      toast.dismiss(toastId);
      setIsItemEditorModalOpen(false);
      setEditingItemObj(null);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to save item");
    }
  };

  // Add Item to Cart

    const handleItemClick = (item: any, quantityToAdd = 1) => {
    triggerBeep('tap');

    // 👉 NEW: जो आइटम कार्ट में जा रहा है, उसका काउंट बढ़ा दें (ताकि वो Favorites में ऊपर आए)
    const savedPop = JSON.parse(localStorage.getItem("bb_pos_item_popularity") || "{}");
    savedPop[item.id] = (savedPop[item.id] || 0) + quantityToAdd;
    localStorage.setItem("bb_pos_item_popularity", JSON.stringify(savedPop));

  
    const hasItemVariants = item.variants && typeof item.variants === 'object' && Object.keys(item.variants).length > 0;

    if (hasItemVariants) {
      setSelectedProductForVariation(item);
      const variantKeys = Object.keys(item.variants);
      const firstSize = variantKeys[0];
      const firstPrice = Number(item.variants[firstSize]) || Number(item.price) || 100;
      setSelectedVariantIndex(0);
      setSelectedSize(firstSize);
      setSelectedSizePrice(firstPrice);
      setSelectedAddons({});
      setItemNoteInput('');
      setIsVariationModalOpen(true);
    } else {
      const itemPrice = Number(item.price) || 100;
      const itemName = item.name || item.title || "Cafe Item";
      const cartItemId = `std-${item.id}`;
      setCart((prev) => {
        const existingIndex = prev.findIndex((c) => c.cartItemId === cartItemId);
        if (existingIndex > -1) {
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + quantityToAdd };
          return next;
        }
        return [...prev, { cartItemId, id: item.id, name: itemName, price: itemPrice, quantity: quantityToAdd }];
      });
      toast.success(`जोड़ा गया: ${itemName} x${quantityToAdd}!`);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  };

  const handleAddCustomizedItemToCart = () => {
    if (!selectedProductForVariation) return;
    triggerBeep('tap');

    let finalItemPrice = selectedSizePrice;
    const activeAddonsList: string[] = [];

    Object.entries(selectedAddons).forEach(([addon, isSelected]) => {
      if (isSelected) {
        const cost = PIZZA_ADDONS[selectedSize.toLowerCase()]?.[addon] || 20;
        finalItemPrice += cost;
        activeAddonsList.push(addon);
      }
    });

    const baseName = selectedProductForVariation.name || selectedProductForVariation.title || "Item";
    const sizeSuffix = selectedSize && selectedSize !== 'Standard' ? `(${selectedSize.toUpperCase()})` : '';
    const fullName = `${baseName} ${sizeSuffix}`.trim();

    const noteParts: string[] = [];
    if (activeAddonsList.length > 0) noteParts.push(`Add-ons: ${activeAddonsList.join(', ')}`);
    if (itemNoteInput) noteParts.push(`Note: ${itemNoteInput}`);

    const combinedNote = noteParts.join(' | ');
    const cartItemId = `${selectedProductForVariation.id}-${selectedSize}-${combinedNote}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + 1 };
        return next;
      }
      return [...prev, { 
        cartItemId,
        id: selectedProductForVariation.id, 
        name: fullName, 
        price: finalItemPrice, 
        quantity: 1, 
        size: selectedSize,
        note: combinedNote 
      }];
    });

    setIsVariationModalOpen(false);
    setSelectedProductForVariation(null);
    setSearchQuery('');
    toast.success(`जोड़ा गया: ${fullName}!`);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  // WINDOW-LEVEL KEYBOARD LISTENER FOR VARIATION MODAL (TAB / ARROWS / ENTER)
  useEffect(() => {
    if (!isVariationModalOpen || !selectedProductForVariation?.variants) return;

    const handleModalKeys = (e: KeyboardEvent) => {
      const entries = Object.entries(selectedProductForVariation.variants);
      const totalVariants = entries.length;
      if (totalVariants === 0) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedVariantIndex((prev) => {
          const next = e.shiftKey
            ? (prev - 1 + totalVariants) % totalVariants
            : (prev + 1) % totalVariants;
          setSelectedSize(entries[next][0]);
          setSelectedSizePrice(Number(entries[next][1]) || 0);
          return next;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedVariantIndex((prev) => {
          const next = (prev + 1) % totalVariants;
          setSelectedSize(entries[next][0]);
          setSelectedSizePrice(Number(entries[next][1]) || 0);
          return next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedVariantIndex((prev) => {
          const prevIdx = (prev - 1 + totalVariants) % totalVariants;
          setSelectedSize(entries[prevIdx][0]);
          setSelectedSizePrice(Number(entries[prevIdx][1]) || 0);
          return prevIdx;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleAddCustomizedItemToCart();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsVariationModalOpen(false);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const numIdx = parseInt(e.key, 10) - 1;
        if (entries[numIdx]) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedVariantIndex(numIdx);
          setSelectedSize(entries[numIdx][0]);
          setSelectedSizePrice(Number(entries[numIdx][1]) || 0);
        }
      }
    };

    window.addEventListener('keydown', handleModalKeys, true);
    return () => window.removeEventListener('keydown', handleModalKeys, true);
  }, [isVariationModalOpen, selectedProductForVariation, selectedSizePrice, selectedSize, itemNoteInput, selectedAddons]);

  const handleUpdateCartQuantity = (cartItemId: string, amount: number) => {
    triggerBeep('tap');
    setCart((prev) => prev.map((item) => {
      if (item.cartItemId === cartItemId) {
        const updatedQty = item.quantity + amount;
        return updatedQty > 0 ? { ...item, quantity: updatedQty } : null;
      }
      return item;
    }).filter(Boolean) as PosCartItem[]);
  };

  const getDailyTokenNumber = () => {
    const todayStr = new Date().toDateString();
    let lastResetDate = localStorage.getItem("bb_pos_token_reset_date");
    let currentTokenSeq = Number(localStorage.getItem("bb_pos_daily_token_seq") || "0");

    if (lastResetDate !== todayStr) {
      currentTokenSeq = 1;
      localStorage.setItem("bb_pos_token_reset_date", todayStr);
    } else {
      currentTokenSeq += 1;
    }
    localStorage.setItem("bb_pos_daily_token_seq", String(currentTokenSeq));
    return currentTokenSeq;
  };

  const preloadQrCode = async (upiString: string): Promise<string> => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiString)}`;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(qrUrl);
      img.onerror = () => resolve(qrUrl);
      img.src = qrUrl;
      setTimeout(() => resolve(qrUrl), 1500);
    });
  };

  // ==========================================
  // UPDATED: ROBUST IFRAME PRINTING + ALL IMAGES LOAD CHECK
  // ==========================================
  const handlePrintReceiptDirect = async (orderObj: any, isKot = false): Promise<void> => {
    return new Promise(async (resolve) => {
      if (!orderObj || !orderObj.items || orderObj.items.length === 0) return resolve();

      // Preload QR Code for extra safety if you still use external image API
      if (!isKot) {
        const upiString = `upi://pay?pa=${orderObj.upiId || upiIdConfig}&pn=BumBumCafe&am=${orderObj.total}&cu=INR&tn=Bill-${orderObj.billNumber || 'Order'}`;
        await preloadQrCode(upiString);
      }

      // 1. Create a hidden iframe (Stops "Popup Blocked" errors entirely)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const printDocument = iframe.contentWindow?.document;
      if (!printDocument) {
        toast.error("प्रिंटिंग फ्रेम लोड नहीं हो पाया!");
        return resolve();
      }

      printDocument.write('<!DOCTYPE html><html><head><title>Print Receipt</title>');
      printDocument.write(`
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * { font-family: Verdana, Geneva, Tahoma, sans-serif !important; box-sizing: border-box; }
          html, body { margin: 0 !important; padding: 0 !important; width: 80mm !important; background: #ffffff !important; color: #000000 !important; }
          #print-root { width: 68mm !important; max-width: 68mm !important; margin-left: 2mm !important; padding-right: 2mm !important; }
          img { display: block !important; margin: 0 auto !important; max-width: 100% !important; }
        </style>
      `);

      // Inject parent CSS
      Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((styleTag) => {
        printDocument.write(styleTag.outerHTML);
      });

      printDocument.write('</head><body><div id="print-root"></div></body></html>');
      printDocument.close();

      const container = printDocument.getElementById('print-root');
      if (container) {
        const root = createRoot(container);
        
        // Render React Components into Iframe
        if (isKot) {
          root.render(<PrintKitchenKot orderObj={orderObj} />);
        } else {
          root.render(<PrintCustomerReceipt orderObj={orderObj} currentUser={currentUser} />);
        }

        // Trigger iframe print & cleanup
        const triggerPrintAndCleanup = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            // Cleanup after print dialog closes
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                root.unmount(); // <-- FIX: Memory Leak prevented
                document.body.removeChild(iframe);
              }
              resolve();
            }, 1000);
          }, 300); // give dom time to paint
        };

        if (isKot) {
          triggerPrintAndCleanup();
          return;
        }

        // 2. WAIT FOR ALL IMAGES (Including QR) TO LOAD COMPLETELY
        const executeGuaranteedPrint = () => {
          const images = printDocument.querySelectorAll('img');
          const totalImages = images.length;

          if (totalImages === 0) {
            triggerPrintAndCleanup();
            return;
          }

          let loadedCount = 0;
          let hasPrinted = false;

          const checkAndPrint = () => {
            if (hasPrinted) return;
            hasPrinted = true;
            triggerPrintAndCleanup();
          };

          images.forEach((img) => {
            if (img.complete && img.naturalWidth > 0) {
              loadedCount++;
              if (loadedCount === totalImages) checkAndPrint();
            } else {
              img.onload = () => {
                loadedCount++;
                if (loadedCount === totalImages) checkAndPrint();
              };
              img.onerror = () => {
                loadedCount++; // Ignore errors and continue so print doesn't get stuck
                if (loadedCount === totalImages) checkAndPrint();
              };
            }
          });

          // Maximum wait time: 2.5 seconds (Fall back to print whatever loaded)
          setTimeout(checkAndPrint, 2500); 
        };

        // Allow a small delay for React rendering to inject <img> tags into DOM
        setTimeout(executeGuaranteedPrint, 300);
      } else {
        document.body.removeChild(iframe);
        resolve();
      }
    });
  };
  // ==========================================

  // Running Table Order: Save & Print ONLY Newly Added Items in KOT
  const handleSaveTableOrderKotOnly = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    const subtotal = getCartSubtotal();
    const finalTotal = getTotalBillPrice();
    const discountAmt = getCalculatedDiscountAmount();
    const token = getDailyTokenNumber();

    try {
      let billNumber: number;

      if (activeEditingOrderId) {
        billNumber = activeEditingBillNumber || getNextBillNumber();
        
        const newlyAddedKotItems: PosCartItem[] = [];
        cart.forEach((currItem) => {
          const prevItem = activeEditingOriginalItems.find(
            p => p.cartItemId === currItem.cartItemId || 
                 (p.name === currItem.name && p.size === currItem.size && p.note === currItem.note)
          );
          const prevQty = prevItem ? prevItem.quantity : 0;
          const diffQty = currItem.quantity - prevQty;
          if (diffQty > 0) {
            newlyAddedKotItems.push({
              ...currItem,
              quantity: diffQty
            });
          }
        });

        const orderRef = doc(db, "orders", activeEditingOrderId);
        const updatedOrderObj = { 
          items: cart, 
          subtotal, 
          discountType,
          discountValue,
          discountAmount: discountAmt, 
          gstRate: gstEnabled ? gstRate : 0, 
          gstAmount: getGstAmountCalculated(), 
          total: finalTotal, 
          tableNumber: tableNumber,
          customerName: customerName || "Walk-in Guest",
          customerPhone: customerPhone ? `+91${getSanitizedPhone(customerPhone)}` : "",
          upiId: upiIdConfig,
          status: 'unsettled',
          paymentSettled: false,
          fulfillmentType: 'table',
          lastUpdated: new Date()
        };

        if (navigator.onLine) {
          await updateDoc(orderRef, updatedOrderObj);
        }
        setLiveOrders(prev => prev.map(o => o.id === activeEditingOrderId ? { ...o, ...updatedOrderObj } : o));

        triggerBeep('success');

        if (kotEnabled) {
          if (newlyAddedKotItems.length > 0) {
            toast.success(`टेबल ${tableNumber} अपडेट! केवल ${newlyAddedKotItems.length} नए आइटम की KOT प्रिंट हुई। 🪑`);
            await handlePrintReceiptDirect({ ...updatedOrderObj, items: newlyAddedKotItems, billNumber, tokenNumber: token, fulfillmentType: 'table' }, true);
          } else {
            toast.success(`टेबल ${tableNumber} अपडेट! कोई नया आइटम नहीं जुड़ा।`);
          }
        }
      } else {
        billNumber = getNextBillNumber();

        const orderObj = { 
          billNumber, 
          tokenNumber: token, 
          customerName: customerName || "Walk-in Guest", 
          customerPhone: customerPhone ? `+91${getSanitizedPhone(customerPhone)}` : "", 
          items: cart, 
          subtotal, 
          discountType, 
          discountValue, 
          discountAmount: discountAmt, 
          gstRate: gstEnabled ? gstRate : 0, 
          gstAmount: getGstAmountCalculated(), 
          deliveryFee: 0, 
          total: finalTotal, 
          timestamp: new Date(), 
          status: 'unsettled', 
          paymentSettled: false,
          fulfillmentType: 'table', 
          deliveryArea: "", 
          tableNumber: tableNumber, 
          paymentMethod, 
          source: 'PC_POS', 
          address: '',
          upiId: upiIdConfig
        };

        if (navigator.onLine) {
          const docRef = await addDoc(collection(db, "orders"), orderObj);
          setLiveOrders(prev => [{ id: docRef.id, ...orderObj }, ...prev]);
        } else {
          try {
            const offlineQueue = JSON.parse(localStorage.getItem("bb_pos_offline_orders_queue") || "[]");
            offlineQueue.push(orderObj);
            localStorage.setItem("bb_pos_offline_orders_queue", JSON.stringify(offlineQueue));
          } catch (e) {
            toast.error("Offline storage full! Please connect to internet.");
          }
          setLiveOrders(prev => [{ id: `offline_${Date.now()}`, ...orderObj }, ...prev]);
        }

        triggerBeep('success');
        toast.success(`टेबल ${tableNumber} पर बिल सेव हुआ व KOT निकल गई! 🪑`);

        if (kotEnabled) {
          await handlePrintReceiptDirect(orderObj, true);
        }
      }

      // Reset state & default pickup
      setCart([]); 
      setCustomerPhone(''); 
      setCustomerName(''); 
      setCartCustSearchInput('');  // <--- यह लाइन जोड़ें
      setAddress('');
      setDiscountValue(0); 
      setIsDiscountOpen(false);
      setIsRedeemingPoints(false); 
      setPointsToRedeem(0);
      setCashTendered('');
      setFulfillmentType('pickup');
      setTableNumber('Table 1');
      setApplyDeliveryFee(false);
      setApplyPackingCharge(false); // 👈 अगले बिल के लिए पैकिंग चार्ज रीसेट
      setActiveEditingOrderId(null);
      setActiveEditingBillNumber(null);
      setActiveEditingOriginalItems([]);
      setActiveEditingPreviousOrder(null); // 👈 रीसेट
      localStorage.removeItem("bb_pos_saved_cart_pc");
      setTimeout(() => searchInputRef.current?.focus(), 60);

    } catch (err) {
      toast.error("Failed to save table order");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Final Checkout & Bill Print: Saved as 'unsettled' until settled in Daily Bills tab!
  const handleFinalCheckoutAndPrintBill = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    const subtotal = getCartSubtotal();
    const finalTotal = getTotalBillPrice();
    const discountAmt = getCalculatedDiscountAmount();
    const token = getDailyTokenNumber();
    const earned = Math.floor(finalTotal / 100);
    const redeemed = isRedeemingPoints ? pointsToRedeem : 0;
    const cleanPhone = getSanitizedPhone(customerPhone);

    try {
      let billNumber: number;
      let remainingPts = customerPoints;

      if (cleanPhone.length === 10 && navigator.onLine) {
        const userRef = doc(db, "customer_points", cleanPhone);
        const userDoc = await getDoc(userRef);
        let prevPoints = 0;
        let prevSpent = 0;
        let prevVisits = 0;
        
        if (userDoc.exists()) {
                const data = userDoc.data();
                prevPoints = Number(data.points) || 0;
                prevSpent = Number(data.totalSpent) || 0;
                prevVisits = Number(data.totalVisits) || 0;
              }

              // 🛡️ चेक करें कि क्या यह पुराना कम्प्लीट बिल एडिट हो रहा है?
              const isReEditingCompletedBill = 
                activeEditingPreviousOrder && 
                (activeEditingPreviousOrder.status === 'completed' || activeEditingPreviousOrder.paymentSettled);

              let newSpent = prevSpent + finalTotal;
              let newVisits = prevVisits + 1;

              if (isReEditingCompletedBill) {
                // अगर पुराना बिल एडिट हुआ है, तो पहले पुराने बिल का अमाउंट व पॉइंट्स घटाएं
                const oldTotal = Number(activeEditingPreviousOrder.total) || 0;
                const oldEarned = Number(activeEditingPreviousOrder.pointsEarned) || 0;
                const oldRedeemed = Number(activeEditingPreviousOrder.pointsRedeemed) || 0;

                const rolledBackPoints = prevPoints - oldEarned + oldRedeemed;
                remainingPts = Math.max(0, rolledBackPoints - redeemed) + earned;
                newSpent = Math.max(0, prevSpent - oldTotal + finalTotal);
                newVisits = prevVisits; // 👈 विज़िट दोबारा नहीं बढ़ेगी!
              } else {
                // नया बिल है, तो सामान्य रूप से जुड़ेगा
                remainingPts = Math.max(0, prevPoints - redeemed) + earned;
                newSpent = prevSpent + finalTotal;
                newVisits = prevVisits + 1;
              }

             await setDoc(userRef, { 
                name: customerName || "Walk-in Guest", 
                phone: cleanPhone, 
                points: remainingPts, 
                totalSpent: newSpent,
                totalVisits: newVisits,
                lastActive: new Date() 
              }, { merge: true });
      } // 👈 यह ब्रैकेट छूट गया था

      billNumber = activeEditingBillNumber || getNextBillNumber();
      const orderObj = { 
        billNumber, 
        tokenNumber: token, 
        customerName: customerName || "Walk-in Guest", 
        customerPhone: cleanPhone ? `+91${cleanPhone}` : "", 
        items: cart, 
        subtotal, 
        discountType, 
        discountValue, 
        discountAmount: discountAmt, 
        gstRate: gstEnabled ? gstRate : 0, 
        gstAmount: getGstAmountCalculated(), 
        deliveryFee: getDeliveryCharge(), 
        packingCharge: getPackingCharge(), 
        total: finalTotal,
        timestamp: new Date(), 
        status: 'unsettled', 
        paymentSettled: false,
        fulfillmentType, 
        deliveryArea: fulfillmentType === "delivery" ? selectedArea.name : "", 
        tableNumber: fulfillmentType === 'table' ? tableNumber : '', 
        paymentMethod, 
        splitCashAmount: paymentMethod === 'split' ? splitCashAmount : 0,
        splitUpiAmount: paymentMethod === 'split' ? splitUpiAmount : 0,
        source: 'PC_POS', 
        address,
        pointsEarned: earned,
        pointsRedeemed: redeemed, 
        pointsDiscount: redeemed,
        remainingPoints: remainingPts,
        customerPoints: remainingPts,
        upiId: upiIdConfig,
        promoCodeUsed: appliedPromoName || null // 👉 NEW: यहाँ सेव होगा कि कौन सा कूपन यूज़ हुआ
      };

      if (activeEditingOrderId) {
        if (navigator.onLine) {
          await updateDoc(doc(db, "orders", activeEditingOrderId), orderObj);
        }
        setLiveOrders(prev => prev.map(o => o.id === activeEditingOrderId ? { id: o.id, ...orderObj } : o));
      } else {
        if (navigator.onLine) {
          const docRef = await addDoc(collection(db, "orders"), orderObj);
          setLiveOrders(prev => [{ id: docRef.id, ...orderObj }, ...prev]);
        } else {
          try {
            const cachedQueue = JSON.parse(localStorage.getItem("bb_pos_offline_orders_queue") || "[]");
            cachedQueue.push(orderObj);
            localStorage.setItem("bb_pos_offline_orders_queue", JSON.stringify(cachedQueue));
          } catch (e) {
            toast.error("Offline storage full! Please connect to internet.");
          }
        }
      }

      triggerBeep('success');
      if (cleanPhone && cleanPhone.length === 10) {
        setRecentCartCustomers(prev => {
          const filtered = prev.filter(c => c.phone !== cleanPhone);
          const next = [{ name: customerName || "Guest", phone: cleanPhone }, ...filtered].slice(0, 10);
          localStorage.setItem("bb_pos_recent_customers", JSON.stringify(next));
          return next;
        });
      }

      // Print Customer Bill 
      await handlePrintReceiptDirect(orderObj, false);

      // 👉 NEW: KOT Print Logic for Pickup & Delivery
      if (kotEnabled && (fulfillmentType === 'pickup' || fulfillmentType === 'delivery')) {
        toast.success(`Kitchen KOT प्रिंट हो रही है... 🖨️`);
        await handlePrintReceiptDirect(orderObj, true);
      }

      toast.success(`बिल #${billNumber} प्रिंट हुआ! (Daily Bills से सेटल करें)`);
      // Reset state & default pickup
      setCart([]); 
      setCustomerPhone(''); 
      setCustomerName(''); 
      setCartCustSearchInput(''); // <--- यह नई लाइन जोड़ें
      setAddress('');
      setCustomerPoints(0); 
      setDiscountValue(0); 
      setIsDiscountOpen(false);
      setShowNewCustForm(false);
      setIsRedeemingPoints(false); 
      setPointsToRedeem(0);
      setCashTendered('');
      setAppliedPromoName(null);
      setPromoCouponInput('');
      setFulfillmentType('pickup');
      setTableNumber('Table 1');
      setApplyDeliveryFee(false);
      setApplyPackingCharge(false); // 👈 पैकिंग चार्ज रीसेट
      setActiveEditingOrderId(null);
      setActiveEditingBillNumber(null);
      setActiveEditingOriginalItems([]);
      setActiveEditingPreviousOrder(null); // 👈 री-एडिट रीसेट
      localStorage.removeItem("bb_pos_saved_cart_pc");
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } catch (err) {
      toast.error("Checkout failed");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Past Bill Re-Edit Logic
  const handleReEditOrder = (order: any) => {
    triggerBeep('tap');
    if (!window.confirm(`क्या आप बिल #${order.billNumber} को फिर से एडिट करना चाहते हैं? (यह बिल वापस काउंटर पर चला जाएगा)`)) return;

    setActiveEditingOrderId(order.id);
    setActiveEditingBillNumber(order.billNumber);
    setActiveEditingPreviousOrder(order); // 👈 पुराने बिल का डेटा सेव किया
    setActiveEditingOriginalItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    setCart(order.items || []);
    
    setCustomerName(order.customerName || '');
    const cleanPhone = order.customerPhone ? String(order.customerPhone).replace(/\D/g, '').slice(-10) : '';
    setCustomerPhone(cleanPhone);
    if (cleanPhone.length === 10) {
      searchCustomerByExactPhone(cleanPhone); // Fetch latest profile/points
    }
    
    setAddress(order.address || '');
    setFulfillmentType(order.fulfillmentType || 'pickup');
    setTableNumber(order.tableNumber || 'Table 1');
    setPaymentMethod(order.paymentMethod || 'cash');

    if (order.discountValue && order.discountValue > 0) {
      setDiscountValue(order.discountValue);
      setDiscountType(order.discountType || 'amount');
      setIsDiscountOpen(true);
    } else {
      setDiscountValue(0);
      setIsDiscountOpen(false);
    }

    setActiveTab('billing');
    toast.success(`Bill #${order.billNumber} एडिट मोड में खुल गया है! 🛒`);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  // Quick Settle Action (From Daily Bills Tab)
  const handleQuickSettleOrder = async (orderId: string, pMethod: 'cash' | 'upi' | 'due' | 'split') => {
    triggerBeep('tap');
    const toastId = toast.loading(`Settling bill via ${pMethod.toUpperCase()}...`);
    try {
      const updatePayload: any = {
        status: 'completed',
        paymentSettled: true,
        paymentMethod: pMethod,
        settledAt: new Date()
      };
      await updateDoc(doc(db, "orders", orderId), updatePayload);
      setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
      toast.dismiss(toastId);
      toast.success(`बिल सेटल हुआ [${pMethod.toUpperCase()}] और आज की बिक्री में जुड़ गया! ✅`);
      triggerBeep('success');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("सेटलमेंट विफल रहा");
    }
  };

  // WhatsApp Bill Sender
  const handleSendWhatsAppBill = (targetOrder: any = null) => {
    const ord = targetOrder || { customerPhone, customerName, fulfillmentType, items: cart, total: getTotalBillPrice() };
    const clean = getSanitizedPhone(ord.customerPhone || '');
    if (clean.length !== 10) return toast.error("Enter valid 10-digit phone number!");
    if (!ord.items || ord.items.length === 0) return toast.error("No items in cart!");

    const itemsText = ord.items.map((i: any) => `• ${i.name} x${i.quantity} = ₹${i.price * i.quantity}`).join('%0A');
    const msg = `*☕ BUM BUM CAFE - DIGITAL RECEIPT*%0A------------------------------%0A*Customer:* ${ord.customerName || 'Valued Guest'}%0A*Total Amount:* ₹${ord.total}%0A*Payment:* ${ord.paymentMethod || 'Paid'}%0A------------------------------%0A${itemsText}%0A------------------------------%0A_Thank you for visiting Bum Bum Cafe! Visit Again!_ 💛`;
    window.open(`https://wa.me/91${clean}?text=${msg}`, '_blank');
  };

  // Owner EOD Summary WhatsApp
  const handleSendOwnerSummary = () => {
    const cleanOwner = getSanitizedPhone(ownerPhoneConfig);
    const msg = `*☕ BUM BUM CAFE - DAY END SUMMARY*%0A------------------------------%0A*Date:* ${new Date().toLocaleDateString()}%0A*Total Sales:* ₹${reportSummary.totalSale}%0A*Orders Settled:* ${reportSummary.totalOrdersCount}%0A------------------------------%0A*💵 Gross Cash:* ₹${reportSummary.cashSale}%0A*📱 UPI / Bank:* ₹${reportSummary.upiSale}%0A*📕 Udhar / Due:* ₹${reportSummary.dueSale}%0A*🧾 Expenses:* -₹${reportSummary.totalExpenseAmount}%0A------------------------------%0A*💰 Net Cash in Drawer:* ₹${reportSummary.netCashInDrawer}%0A------------------------------%0A_Generated via Bum Bum Cafe Desktop POS_`;
    window.open(`https://wa.me/${cleanOwner}?text=${msg}`, '_blank');
  };

  // Daily Drawer Expense Save
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!expenseTitle.trim() || isNaN(amt) || amt <= 0) return toast.error("Enter valid title and amount!");
    const toastId = toast.loading("Saving expense...");
    
    const expObj = {
      title: expenseTitle.trim(),
      amount: amt,
      category: expenseCategory,
      timestamp: new Date(),
      enteredBy: currentUser?.name || 'Staff'
    };

    try {
      if (navigator.onLine) {
        await addDoc(collection(db, "daily_expenses"), expObj);
      } else {
        const offlineExp = JSON.parse(localStorage.getItem("bb_pos_offline_expenses_queue") || "[]");
        offlineExp.push(expObj);
        localStorage.setItem("bb_pos_offline_expenses_queue", JSON.stringify(offlineExp));
      }
      toast.dismiss(toastId);
      toast.success(`Expense ₹${amt} saved! ✅`);
      setExpenseTitle('');
      setExpenseAmount('');
      setIsExpenseModalOpen(false);
      fetchReportData();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to record expense");
    }
  };

  // Reports Data Fetching: ONLY COUNT SETTLED ORDERS!
  const fetchReportData = async () => {
    setIsReportLoading(true);
    try {
      let startTarget = new Date();
      let endTarget = new Date();

      if (reportFilter === 'today') {
        startTarget.setHours(0, 0, 0, 0);
        endTarget.setHours(23, 59, 59, 999);
    } else if (reportFilter === 'yesterday') {
        startTarget.setDate(startTarget.getDate() - 1);
        startTarget.setHours(0, 0, 0, 0);
        endTarget.setDate(endTarget.getDate() - 1);
        endTarget.setHours(23, 59, 59, 999);
      } else if (reportFilter === 'last7days') {
        // पिछले 7 दिन का लॉजिक
        startTarget.setDate(startTarget.getDate() - 6); 
        startTarget.setHours(0, 0, 0, 0);
        endTarget.setHours(23, 59, 59, 999);
      } else if (reportFilter === 'custom' && customStartDate && customEndDate) {
        const startParts = customStartDate.split('-');
        startTarget = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]), 0, 0, 0, 0);
        
        const endParts = customEndDate.split('-');
        endTarget = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]), 23, 59, 59, 999);
      }

      if (navigator.onLine) {
        const qOrders = query(collection(db, "orders"), orderBy("timestamp", "desc"), limit(2000));
        const snapOrders = await getDocs(qOrders);
        const filteredOrders = snapOrders.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => {
          const raw = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp || Date.now());
          const timeMs = raw.getTime();
          return timeMs >= startTarget.getTime() && timeMs <= endTarget.getTime();
        });
        setReportOrders(filteredOrders);

        const qExpenses = query(collection(db, "daily_expenses"), orderBy("timestamp", "desc"), limit(200));
        const snapExpenses = await getDocs(qExpenses);
        const filteredExp = snapExpenses.docs.map(d => ({ id: d.id, ...d.data() })).filter((exp: any) => {
          const raw = exp.timestamp?.toDate ? exp.timestamp.toDate() : new Date(exp.timestamp || Date.now());
          const timeMs = raw.getTime();
          return timeMs >= startTarget.getTime() && timeMs <= endTarget.getTime();
        });
        setDailyExpenses(filteredExp);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReportData();
  }, [activeTab, reportFilter, customStartDate, customEndDate]);
  // Financial Summary: ONLY COMPLETED / SETTLED BILLS
  const reportSummary = useMemo(() => {
    let totalSale = 0;
    let cashSale = 0;
    let upiSale = 0;
    let dueSale = 0;
    let totalOrdersCount = 0;
    let unsettledTotal = 0;
    let unsettledCount = 0;

    reportOrders.forEach(o => {
      const amt = Number(o.total) || 0;
      if (o.status === 'completed') {
        totalOrdersCount++;
        totalSale += amt;
        if (o.paymentMethod === 'upi') {
          upiSale += amt;
        } else if (o.paymentMethod === 'due') {
          dueSale += amt;
        } else if (o.paymentMethod === 'split') {
          cashSale += Number(o.splitCashAmount || 0);
          upiSale += Number(o.splitUpiAmount || 0);
        } else {
          cashSale += amt;
        }
      } else if (o.status === 'unsettled' || (o.status === 'pending' && !o.paymentSettled)) {
        unsettledTotal += amt;
        unsettledCount++;
      }
    });

    const totalExpenseAmount = dailyExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    const netCashInDrawer = Math.max(0, cashSale - totalExpenseAmount);

    return { totalSale, cashSale, upiSale, dueSale, totalOrdersCount, totalExpenseAmount, netCashInDrawer, unsettledTotal, unsettledCount };
  }, [reportOrders, dailyExpenses]);

// Item-wise Sales Report Calculation
  const itemWiseSales = useMemo(() => {
    const map: { [key: string]: { name: string, quantity: number, revenue: number } } = {};

    reportOrders.forEach((order) => {
      if (order.status === 'completed' && Array.isArray(order.items)) {
        order.items.forEach((item: PosCartItem) => {
          const key = item.name;
          if (!map[key]) {
            map[key] = { name: key, quantity: 0, revenue: 0 };
          }
          map[key].quantity += (Number(item.quantity) || 1);
          map[key].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
        });
      }
    });

    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [reportOrders]);

 // 📊 DAILY SALES TREND (ग्राफ़ के लिए डायनामिक डेटा - 7 दिन और Custom दोनों के लिए)
  const dailyTrendData = useMemo(() => {
    const dateMap: { [key: string]: { date: string, total: number, orders: number } } = {};
    const result = [];

    let start = new Date();
    let end = new Date();

    // चेक करें कि कौन सा बटन दबाया गया है: 7 दिन या Date Picker?
    if (reportFilter === 'last7days') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (reportFilter === 'custom' && customStartDate && customEndDate) {
      const sParts = customStartDate.split('-');
      start = new Date(Number(sParts[0]), Number(sParts[1]) - 1, Number(sParts[2]), 0, 0, 0, 0);
      const eParts = customEndDate.split('-');
      end = new Date(Number(eParts[0]), Number(eParts[1]) - 1, Number(eParts[2]), 23, 59, 59, 999);
    } else if (reportFilter === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    // 1. Start से End तक की हर तारीख का ढांचा बनाएँ
    const loopStart = new Date(start);
    let safetyCounter = 0;
    while (loopStart <= end && safetyCounter < 60) { // अधिकतम 60 दिन तक का ग्राफ़ दिखेगा
      const dateStr = `${String(loopStart.getDate()).padStart(2, '0')} ${loopStart.toLocaleString('default', { month: 'short' })}`;
      const dayData = { date: dateStr, total: 0, orders: 0 };
      dateMap[dateStr] = dayData;
      result.push(dayData);
      
      loopStart.setDate(loopStart.getDate() + 1);
      safetyCounter++;
    }

    // 2. ऑर्डर्स का डेटा इस ढांचे में भरें
    reportOrders.forEach(o => {
      if (o.status === 'completed') {
        const d = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp || Date.now());
        const dateStr = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}`;
        
        if (dateMap[dateStr]) {
          dateMap[dateStr].total += Number(o.total) || 0;
          dateMap[dateStr].orders += 1;
        }
      }
    });

    return result; 
  }, [reportOrders, reportFilter, customStartDate, customEndDate]);
  
  // Past Receipts Fetching
  const fetchPastReceipts = async () => {
    setIsReceiptsLoading(true);
    try {
      if (navigator.onLine) {
        // 👉 NEW: यहाँ से limit(...) पूरी तरह हटा दिया गया है ताकि 100% सारे बिल आ जाएँ!
        const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        setPastReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      toast.error("Failed to load receipts");
    } finally {
      setIsReceiptsLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'receipts') fetchPastReceipts();
  }, [activeTab, receiptsLimit]);

  const filteredPastReceipts = useMemo(() => {
    const qStr = receiptSearchQuery.trim().toLowerCase();
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const yestStart = new Date(todayStart);
    yestStart.setDate(yestStart.getDate() - 1);
    const yestEnd = new Date(todayEnd);
    yestEnd.setDate(yestEnd.getDate() - 1);

   return pastReceipts.filter((o) => {
      // 🚫 रिजेक्टेड बिल पास्ट रसीद में भी नहीं दिखेंगे
      if (o.status === 'rejected' || o.status === 'cancelled') return false;

      const orderDate = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp || Date.now());
      if (receiptFilterDay === 'today') {
        if (orderDate < todayStart || orderDate > todayEnd) return false;
      } else if (receiptFilterDay === 'yesterday') {
        if (orderDate < yestStart || orderDate > yestEnd) return false;
      }

      if (!qStr) return true;
      const billNoMatch = String(o.billNumber || '').toLowerCase().includes(qStr);
      const phoneMatch = String(o.customerPhone || '').replace(/\D/g, '').includes(qStr);
      const nameMatch = String(o.customerName || '').toLowerCase().includes(qStr);
      const totalMatch = String(o.total || '').includes(qStr);

      return billNoMatch || phoneMatch || nameMatch || totalMatch;
    });
  }, [pastReceipts, receiptSearchQuery, receiptFilterDay]);

  // Keyboard Shortcuts Handler - FIXED FOR PERFORMANCE (Latest Ref Pattern)
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // यह वाला useEffect हर बार नया डेटा (State) ref में सेव करेगा, बिना DOM को छेड़े।
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      if (!isLoggedIn) return;

      if (e.key === 'F1') { e.preventDefault(); setIsHelpModalOpen(prev => !prev); }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('billing'); setTimeout(() => searchInputRef.current?.focus(), 80); }
      
      if (e.key === 'F3') { 
        e.preventDefault(); 
        if (cart.length > 0) { handleHoldCurrentCart(); } 
        else { setIsHeldCartsModalOpen(prev => !prev); } 
      }
      
      if (e.key === 'F4') { e.preventDefault(); setActiveTab('reports'); }
      
      if (e.key === 'F5') { 
        e.preventDefault(); 
        setActiveTab('billing'); 
        setTimeout(() => phoneInputRef.current?.focus(), 80); 
      }
      
      if (e.key === 'F6') { e.preventDefault(); setActiveTab('settlement'); }
      
      if (e.key === 'F7') { 
        e.preventDefault(); 
        if (fulfillmentType === 'table' && cart.length > 0 && !isSubmittingOrder) {
          handleSaveTableOrderKotOnly();
        } else if (fulfillmentType !== 'table') {
          toast.error("यह शॉर्टकट सिर्फ टेबल KOT के लिए है।");
        }
      }
      
      if (e.key === 'F8') { e.preventDefault(); setIsDiscountOpen(prev => !prev); }
      if (e.key === 'F9') { e.preventDefault(); if (cart.length > 0 && !isSubmittingOrder) handleFinalCheckoutAndPrintBill(); }
      
      if (e.key === 'F10') { 
        e.preventDefault(); 
        setActiveTab('billing');
        setTimeout(() => document.getElementById('cashTenderedInput')?.focus(), 80);
      }
      
      if (e.key === 'F11') { e.preventDefault(); setActiveTab('customers'); }
      
      if (e.key === 'F12') { e.preventDefault(); setFulfillmentType(prev => prev === 'pickup' ? 'table' : prev === 'table' ? 'delivery' : 'pickup'); }

      if ((e.key === 'Delete' || (e.shiftKey && e.key === 'Backspace')) && document.activeElement?.tagName !== 'INPUT') {
        if (cart.length > 0) setCart([]);
      }
      
      if (e.key === 'Escape') {
        setIsHelpModalOpen(false);
        setIsHeldCartsModalOpen(false);
        setIsExpenseModalOpen(false);
        setIsVariationModalOpen(false);
        setIsReceiptModalOpen(false);
        setIsCustomerModalOpen(false);
        setIsItemEditorModalOpen(false);
        setIsCatManagerModalOpen(false);
        setShowNewCustForm(false);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    };
  }); // यहाँ कोई ब्रैकेट [] नहीं है, यह जानबूझकर किया है ताकि हमेशा ताज़ा डेटा मिले!

  // यह वाला useEffect सिर्फ़ 1 बार चलेगा और Event Listener (गार्ड) को कंप्यूटर से जोड़ेगा।
  useEffect(() => {
    const globalListener = (e: KeyboardEvent) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e); // यह वॉकी-टॉकी से हमेशा ताज़ा फंक्शन लेगा
      }
    };
    window.addEventListener('keydown', globalListener);
    return () => window.removeEventListener('keydown', globalListener);
  }, []); // खाली ब्रैकेट = यह 1 ही बार सेट होगा और कभी नहीं हटेगा!
 

  const filteredMenu = useMemo(() => {
    const queryStr = searchQuery.toLowerCase().trim();
    
    // 👉 NEW: '⭐ Top Items' (ज्यादा बिकने वाले) का लॉजिक
    if (selectedCategory === '⭐ Top Items') {
      const savedPop = JSON.parse(localStorage.getItem("bb_pos_item_popularity") || "{}");
      
      let topProducts = [...products].sort((a, b) => (savedPop[b.id] || 0) - (savedPop[a.id] || 0));
      topProducts = topProducts.filter(p => (savedPop[p.id] || 0) > 0).slice(0, 30);
      
      if (topProducts.length === 0) topProducts = products.slice(0, 24);

      return topProducts.filter((p) => {
        const matchesName = (p.name || '').toLowerCase().includes(queryStr);
        const matchesCode = p.itemCode && String(p.itemCode).toLowerCase().includes(queryStr);
        return matchesName || matchesCode;
      });
    }

    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesName = (p.name || '').toLowerCase().includes(queryStr);
      const matchesCode = p.itemCode && String(p.itemCode).toLowerCase().includes(queryStr);
      return matchesCategory && (matchesName || matchesCode);
    });
  
  
  }, [products, searchQuery, selectedCategory]); 
  const filteredInventoryProducts = useMemo(() => {
    const queryStr = inventorySearchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesName = (p.name || '').toLowerCase().includes(queryStr);
      const matchesCat = (p.category || '').toLowerCase().includes(queryStr);
      const matchesCode = p.itemCode && String(p.itemCode).toLowerCase().includes(queryStr);
      return matchesName || matchesCat || matchesCode;
    });
  }, [products, inventorySearchQuery]);

  const mainClass = "h-screen w-screen flex font-sans antialiased overflow-hidden " + (themeMode === "dark" ? "dark bg-[#121212] text-neutral-100" : "bg-[#f4f5f7] text-neutral-900");

  return (
    <div className={mainClass}>
      <Toaster position="top-right" />

      {/* TERMINAL LOCK / LOGIN */}
      {!isLoggedIn ? (
        <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-10 shadow-2xl space-y-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-orange-500/10 text-orange-500 rounded-full border border-orange-500/20"><SafeLock size={36} /></div>
              <h1 className="text-2xl font-black uppercase text-yellow-500 tracking-wider">BUM BUM CAFE - PC POS</h1>
              <p className="text-xs text-neutral-400">Desktop Terminal Locked • Enter Staff PIN</p>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (navigator.onLine) {
                  const snap = await getDocs(query(collection(db, "cafe_users"), where("pin", "==", pinInput.trim())));
                  if (!snap.empty) {
                    const uDoc = snap.docs[0].data();
                    setIsLoggedIn(true);
                    setCurrentUser({ id: snap.docs[0].id, ...uDoc });
                    localStorage.setItem("bb_pos_user_pc", JSON.stringify({ id: snap.docs[0].id, ...uDoc }));
                    toast.success(`Welcome, ${uDoc.name}!`);
                    setTimeout(() => searchInputRef.current?.focus(), 150);
                    return;
                  }
                }
                if (pinInput.trim() === '1234' || pinInput.trim() === '0000') {
                  setIsLoggedIn(true);
                  setCurrentUser({ name: 'Staff Offline', role: 'cashier' });
                  toast.success("Unlocked Terminal (Offline Mode)!");
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                  return;
                }
                toast.error("Incorrect PIN!");
              } catch (err) {
                toast.error("Login verification failed");
              }
              setPinInput('');
            }} className="space-y-4">
              <input type="password" maxLength={6} value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="Enter PIN" className="w-full bg-neutral-950 border border-neutral-800 text-center text-3xl font-mono py-4 rounded-2xl outline-none text-orange-400 tracking-widest" autoFocus />
              <button type="submit" className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-sm uppercase rounded-2xl tracking-wider transition-all shadow-lg">Unlock Terminal</button>
            </form>
          </motion.div>
        </div>
      ) : (
        <>
          {/* SIDEBAR NAVIGATION */}
          <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-neutral-900 border-r border-neutral-300 dark:border-neutral-800 flex flex-col justify-between p-4 shrink-0 select-none h-full transition-all duration-300 relative`}>
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-7 bg-orange-600 text-white p-1 rounded-full shadow-md hover:bg-orange-500 transition-all z-20">
              {isSidebarCollapsed ? <SafeChevronRight size={14} /> : <SafeChevronLeft size={14} />}
            </button>

            <div className="space-y-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-3 truncate">
                  <SafeDatabase className="text-orange-500 shrink-0" size={22} />
                  {!isSidebarCollapsed && (
                    <div className="truncate">
                      <h1 className="text-xs font-black uppercase text-orange-600 dark:text-yellow-500 truncate">Bum Bum Cafe</h1>
                      <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold">POS Pro v4.4</span>
                    </div>
                  )}
                </div>
              </div>

              <nav className="space-y-1.5">
                {[
                  { id: 'billing', label: 'Counter [F2]', icon: ShoppingBag },
                  { id: 'settlement', label: `Daily Bills (${unsettledOrdersCount})`, icon: Receipt },
                  { id: 'inventory', label: 'Menu & Stock', icon: Layers },
                  { id: 'receipts', label: 'Past Receipts', icon: Printer },
                  { id: 'tables', label: `Tables (${activeTableOrders.length})`, icon: LayoutGrid },
                  { id: 'orders', label: `Live Orders (${activeLiveOrders.length})`, icon: Clock },
                  { id: 'reports', label: 'Reports & Sales', icon: SafeBarChart3 },
                  { id: 'udhari', label: 'Udhari (उधार)', icon: SafeFileText },
                  { id: 'customers', label: 'Customers Profile', icon: SafeUserPlus },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => { triggerBeep('tap'); setActiveTab(item.id as any); }} 
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${isActive ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30" : "text-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon size={16} className="shrink-0" />
                        {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isSidebarCollapsed && item.id === 'settlement' && unsettledOrdersCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">{unsettledOrdersCount}</span>
                      )}
                      {!isSidebarCollapsed && item.id === 'tables' && activeTableOrders.length > 0 && (
                        <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black">{activeTableOrders.length}</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {!isSidebarCollapsed && (
                <div className="pt-2 border-t border-neutral-300 dark:border-neutral-800 space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black uppercase text-neutral-500">POS Tools</span>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-[10px] text-orange-600 font-bold hover:underline flex items-center gap-1">
                      <SafeHelpCircle size={12} /> Help [F1]
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setIsHeldCartsModalOpen(true)} className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded-xl text-[10px] font-bold flex items-center gap-1 text-neutral-800 dark:text-white">
                      <SafePauseCircle size={13} className="text-amber-500 shrink-0" />
                      <span className="truncate">Parked ({heldCarts.length})</span>
                    </button>
                    <button onClick={() => setIsExpenseModalOpen(true)} className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded-xl text-[10px] font-bold flex items-center gap-1 text-neutral-800 dark:text-white">
                      <Receipt size={13} className="text-red-500 shrink-0" />
                      <span className="truncate">Expense [F6]</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-neutral-300 dark:border-neutral-800">
              <button onClick={async () => { await syncOfflineAll(); }} disabled={isSyncing} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-black uppercase text-amber-700 dark:text-yellow-500 bg-amber-500/15 hover:bg-amber-500/25 transition-colors">
                {isSyncing ? <Loader2 className="animate-spin shrink-0" size={13} /> : <SafeRefreshCw size={13} />}
                {!isSidebarCollapsed && <span className="truncate">Sync Cloud</span>}
              </button>
              <button onClick={() => { setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem("bb_pos_user_pc"); }} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-black uppercase text-red-600 bg-red-500/15 hover:bg-red-500/25 transition-colors">
                <SafeLogOut size={13} className="shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Lock Terminal</span>}
              </button>
            </div>
          </aside>

          {/* MAIN WORKSPACE */}
          <main className="flex-1 flex h-full overflow-hidden">
            
            {/* TAB 1: COUNTER BILLING */}
            {activeTab === 'billing' && (
              <div className="flex-1 flex h-full overflow-hidden">
                <div className="flex-1 flex flex-col p-4 h-full overflow-hidden">
                  
                  {/* RUNNING TABLE INDICATOR BANNER */}
                  {activeEditingOrderId && (
                    <div className="mb-2 bg-amber-500/20 border border-amber-500 p-2.5 rounded-xl flex items-center justify-between shrink-0 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-black uppercase">
                        <SafeEdit3 size={16} />
                        <span>🪑 Table {tableNumber} (Active Bill #{activeEditingBillNumber}) - Running Order Active</span>
                      </div>
                      <button onClick={() => { setActiveEditingOrderId(null); setActiveEditingBillNumber(null); setActiveEditingOriginalItems([]); setCart([]); }} className="text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white text-xs font-bold underline">
                        Exit Table (Clear)
                      </button>
                    </div>
                  )}

                  {/* SEARCH BAR (F2) & QUICK ACTIONS */}
                  <div className="flex gap-2.5 mb-2.5 items-center shrink-0">
                    <div className="relative flex-1">
                      <SafeSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                      <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Search item / Type Code or Qty*Code (e.g. 101 or 3*101) & hit [Enter]... [F2]" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchInputKeyDown} 
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-orange-500 shadow-sm" 
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={() => setIsCatManagerModalOpen(true)} 
                      className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-3 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700 shrink-0"
                    >
                      <ArrowLeftRight size={14} className="text-orange-500" /> Reorder Cats
                    </button>
                    <button 
                      onClick={() => handleOpenItemEditor(null)} 
                      className="bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow shrink-0"
                    >
                      <SafePlus size={15} /> Add Item
                    </button>
                  </div>

                  {/* CATEGORIES BAR */}
                  <div className="flex flex-wrap gap-1.5 pb-2 shrink-0 max-h-24 overflow-y-auto pr-1">
                    {['⭐ Top Items', ...categories].map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const count = cat === 'All' ? products.length : products.filter(p => p.category?.toLowerCase() === cat.toLowerCase()).length;
                      return (
                        <button 
                          key={cat}
                          onClick={() => { triggerBeep('tap'); setSelectedCategory(cat); }} 
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shadow-sm ${
                            isSelected 
                              ? "bg-orange-600 text-white border-orange-600 shadow-md scale-[1.02]" 
                              : "bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700"
                          }`}
                        >
                          <span>{cat}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${isSelected ? 'bg-black/30 text-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* PRODUCTS GRID (100% Guaranteed Name & Price Display with Fixed 82px Image Height) */}
                  {loading ? (
                    <div className="flex items-center justify-center flex-1"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-2.5 overflow-y-auto flex-1 pr-1.5 content-start">
                      {filteredMenu.map((item) => {
                        const isAvail = item.isAvailable !== false;
                        const imgUrl = item.image || item.imageUrl || item.img;
                        const displayName = item.name || item.title || item.itemName || "Cafe Item";
                        const displayPrice = Number(item.price) || (item.variants && Object.values(item.variants)[0]) || 0;

                        return (
                          <button 
                            key={item.id} 
                            disabled={!isAvail} 
                            onClick={() => handleItemClick(item)} 
                            className={`border rounded-2xl text-left flex flex-col overflow-hidden h-[155px] min-h-[155px] transition-all duration-150 hover:scale-[1.02] active:scale-95 shadow-sm relative ${
                              isAvail 
                                ? "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 hover:border-orange-500" 
                                : "opacity-40 bg-neutral-200 dark:bg-neutral-950 pointer-events-none"
                            }`}
                          >
                            <div className="w-full h-[82px] max-h-[82px] min-h-[82px] bg-neutral-200 dark:bg-neutral-800 relative shrink-0 overflow-hidden flex items-center justify-center">
                              {imgUrl ? (
                                <img src={imgUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <span className="text-neutral-500 text-[10px] font-black uppercase tracking-wider px-2 text-center">{item.category || "Cafe Item"}</span>
                              )}
                              {item.itemCode && (
                                <span className="absolute top-1 right-1 bg-black/90 text-yellow-400 font-mono text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-500/50 shadow z-10">
                                  #{item.itemCode}
                                </span>
                              )}
                            </div>

                            <div className="p-2 flex-1 flex flex-col justify-between w-full bg-white dark:bg-neutral-900 min-h-[65px]">
                              <p className="font-bold text-[11px] line-clamp-2 text-neutral-900 dark:text-white leading-tight">
                                {displayName}
                              </p>
                              <div className="flex justify-between items-center pt-1 border-t border-neutral-100 dark:border-neutral-800">
                                <span className="text-xs font-mono font-black text-orange-600 dark:text-orange-400">
                                  ₹{displayPrice}
                                </span>
                                <span className="text-[8px] font-bold text-neutral-500 truncate max-w-[70px]">
                                  {item.category || 'General'}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
{/* RIGHT CART PANEL */}
                <div className="w-96 bg-white dark:bg-neutral-900 border-l border-neutral-300 dark:border-neutral-800 flex flex-col p-3 h-full shadow-2xl justify-between overflow-hidden">
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase text-orange-600 dark:text-orange-500">Cart ({cart.length})</h3>
                        <button onClick={handleHoldCurrentCart} title="Park Cart [F3]" className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 rounded-md border border-amber-500/40 flex items-center gap-1">
                          <SafePauseCircle size={11} /> Hold [F3]
                        </button>
                      </div>
                      <button onClick={() => { setCart([]); setCartCustSearchInput(''); }} className="text-red-500 text-xs font-bold hover:underline flex items-center gap-1"><SafeTrash2 size={13} /> Clear [Del]</button>
                    </div>

                    {/* 👉 NEW: DYNAMIC CUSTOMER SEARCH (NAME OR NUMBER) & REDEEM SECTION */}
                    <div className="bg-neutral-100 dark:bg-neutral-800/60 p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mb-2 shrink-0 space-y-2 relative">
                      <div className="flex gap-1.5 relative">
                        {/* 👉 NEW: यहाँ ref={custDropdownRef} जोड़ा गया है ताकि बाहर का क्लिक पहचाना जा सके */}
                        <div className="relative flex-1" ref={custDropdownRef}>
                          <input 
  ref={phoneInputRef}
                            type="text"
                            placeholder="ग्राहक का नाम या मोबाइल नंबर..." 
                            value={cartCustSearchInput} 
                            onChange={e => handleCustomerSearchChange(e.target.value)} 
                            onFocus={() => { 
                              // 👉 Focus होने पर अगर इनपुट खाली है, तो Recent लिस्ट खोलें
                              if (!cartCustSearchInput && recentCartCustomers.length > 0) {
                                const enrichedRecents = recentCartCustomers.map(rc => {
                                  const fullCust = allCustomers.find(c => c.phone === rc.phone || c.id === rc.phone);
                                  return fullCust || rc;
                                });
                                setCustSuggestions(enrichedRecents);
                                setShowCustDropdown(true);
                              } else if (custSuggestions.length > 0) {
                                setShowCustDropdown(true); 
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (showCustDropdown && custSuggestions.length > 0) {
                                  handleSelectDropdownCustomer(custSuggestions[0]); 
                                } else if (customerPhone.length === 10) {
                                  setShowCustDropdown(false);
                                  searchCustomerByExactPhone(customerPhone); 
                                }
                              }
                            }}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white outline-none font-bold placeholder:font-normal placeholder:text-neutral-400" 
                          />
                          
                          {/* कट (X) बटन ताकि नया नाम डाल सकें */}
                          {cartCustSearchInput && (
                            <button onClick={() => { 
                              setCartCustSearchInput(''); 
                              setCustomerPhone(''); 
                              setCustomerName(''); 
                              setShowCustDropdown(false); 
                              setShowNewCustForm(false); 
                              
                              // 👉 क्रॉस दबाते ही रिसेंट लिस्ट खोल दें
                              if (recentCartCustomers.length > 0) {
                                const enrichedRecents = recentCartCustomers.map(rc => {
                                  const fullCust = allCustomers.find(c => c.phone === rc.phone || c.id === rc.phone);
                                  return fullCust || rc;
                                });
                                setCustSuggestions(enrichedRecents);
                                setShowCustDropdown(true);
                              }
                              setTimeout(() => phoneInputRef.current?.focus(), 50);
                            }} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-red-500 transition-colors">
                               <X size={14} />
                            </button>
                          )}
                          
                          {/* 👉 DROPDOWN LIST (हवा में लटकती हुई) */}
                          {showCustDropdown && custSuggestions.length > 0 && (
                             <div className="absolute top-[110%] left-0 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl z-[100] max-h-56 overflow-y-auto">
                                
                                {/* 👉 रिसेंट लिस्ट के लिए छोटा सा हेडर */}
                                {!cartCustSearchInput && (
                                   <div className="px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-[9px] font-black uppercase text-neutral-500 sticky top-0">
                                     🕒 Recent Customers (आखिरी 10)
                                   </div>
                                )}

                                {custSuggestions.map((cust, idx) => (
                                    <div key={idx} onClick={() => handleSelectDropdownCustomer(cust)} className="p-2.5 border-b border-neutral-100 dark:border-neutral-800 hover:bg-orange-50 dark:hover:bg-orange-500/20 cursor-pointer flex justify-between items-center transition-colors">
                                        <div>
                                            <p className="font-black text-xs text-neutral-900 dark:text-white leading-none">{cust.name || 'Walk-in Guest'}</p>
                                            <p className="font-mono text-[10px] text-neutral-500 mt-1">📞 {cust.phone}</p>
                                        </div>
                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-1 rounded-md font-black border border-amber-200 dark:border-amber-500/30">
                                          ⭐ {cust.points || 0}
                                        </span>
                                    </div>
                                ))}
                             </div>
                          )}
                        </div>
                        
                        {/* अगर लिस्ट में न मिले, तो नया बनाने का बटन */}
                        <button 
                          type="button" 
                          onClick={() => {
                             setShowCustDropdown(false);
                             searchCustomerByExactPhone(customerPhone);
                          }} 
                          className="bg-orange-600 hover:bg-orange-500 text-white px-3 rounded-lg text-[10px] font-black uppercase shadow-sm shrink-0"
                        >
                          नया जोड़ें
                        </button>
                        
                        {/* 🎰 गेम चेक करने का क्विक बटन */}
                        <button 
                          type="button"
                          onClick={() => {
                            setGameSearchInput(customerPhone || cartCustSearchInput);
                            if (customerPhone.length === 10) handleVerifyGameCode(customerPhone);
                            setIsGameVerifyModalOpen(true);
                          }} 
                          title="गेम इनाम चेक करें" 
                          className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 rounded-lg text-xs font-bold flex items-center shrink-0 shadow-sm"
                        >
                          🎰
                        </button>

                        <button onClick={() => handleSendWhatsAppBill()} title="Send WhatsApp Receipt [F7]" className="bg-green-600/15 hover:bg-green-600/25 text-green-600 px-2.5 rounded-lg text-xs font-bold flex items-center shrink-0">
                          <SafeShare2 size={13} />
                        </button>
                      </div>

                      {/* CUSTOMER FOUND: FULL PROFILE & LOYALTY POINTS REDEEM */}
                      {customerPhone.length === 10 && customerName && !showNewCustForm && (
                        <div className="bg-white dark:bg-neutral-900 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-neutral-900 dark:text-white">👤 {customerName}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-mono font-black">⭐ {customerPoints} Pts</span>
                          </div>
                          {address && <p className="text-[10px] text-neutral-500 truncate">📍 {address}</p>}

                          {customerPoints > 0 ? (
                            <div className="pt-1.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                रिडीम पॉइंट्स (1 Pt = ₹1):
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number" 
                                  min={1} 
                                  max={customerPoints}
                                  value={pointsToRedeem || ''}
                                  onChange={e => setPointsToRedeem(Math.min(Number(e.target.value), customerPoints))}
                                  placeholder="Pts"
                                  className="w-14 bg-neutral-100 dark:bg-neutral-800 border rounded p-1 text-center font-mono text-xs font-bold" 
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (!isRedeemingPoints && pointsToRedeem > 0) {
                                      setIsRedeemingPoints(true);
                                      toast.success(`₹${pointsToRedeem} पॉइंट्स छूट लागू हुई!`);
                                    } else {
                                      setIsRedeemingPoints(false);
                                      setPointsToRedeem(0);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                    isRedeemingPoints ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                                  }`}
                                >
                                  {isRedeemingPoints ? 'हटाएं' : 'लागू करें'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-neutral-400 italic">इस ग्राहक के पास अभी कोई रिडीम पॉइंट नहीं हैं।</p>
                          )}
                        </div>
                      )}

                      {/* NEW CUSTOMER REGISTRATION FORM */}
                      {showNewCustForm && (
                        <div className="space-y-1.5 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                          <p className="text-[10px] text-amber-600 font-black uppercase">नया ग्राहक! नाम लिखकर [Enter] दबाएँ:</p>
                          <input 
                            ref={newCustNameRef}
                            type="text" 
                            placeholder="Customer Name *" 
                            value={newCustNameInput} 
                            onChange={e => setNewCustNameInput(e.target.value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))}
                            onKeyDown={e => e.key === 'Enter' && newCustAddressRef.current?.focus()}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 text-xs outline-none" 
                          />
                          <input 
                            ref={newCustAddressRef}
                            type="text" 
                            placeholder="Address (Optional)" 
                            value={newCustAddressInput} 
                            onChange={e => setNewCustAddressInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleSaveNewCustomerQuick()}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 text-xs outline-none" 
                          />
                          <button 
                            type="button" 
                            onClick={handleSaveNewCustomerQuick} 
                            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase rounded-lg shadow-sm"
                          >
                            Save Customer
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CART ITEMS LIST */}

                    {/* CART ITEMS LIST */}
                    <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 mb-2">
                      {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-xs text-center py-8">
                          <ShoppingBag size={28} className="mb-2 opacity-40" />
                          <p className="font-bold">Cart is empty. Type code or click item.</p>
                        </div>
                      ) : (
                        cart.map((item) => (
                          <div key={item.cartItemId} className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-2 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs truncate text-neutral-900 dark:text-white">{item.name}</p>
                              {item.note && <p className="text-[9px] text-neutral-600 dark:text-neutral-400 italic truncate">{item.note}</p>}
                              <p className="text-[11px] font-mono text-orange-600 dark:text-orange-400 font-black">₹{item.price * item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => handleUpdateCartQuantity(item.cartItemId, -1)} className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded flex items-center justify-center font-black text-xs">-</button>
                              <span className="w-5 text-center text-xs font-mono font-black text-neutral-900 dark:text-white">{item.quantity}</span>
                              <button onClick={() => handleUpdateCartQuantity(item.cartItemId, 1)} className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded flex items-center justify-center font-black text-xs">+</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

             
{/* FULFILLMENT MODE & 6 TABLE SELECTOR */}
                    <div className="space-y-1.5 mb-2 shrink-0 border-t border-neutral-300 dark:border-neutral-800 pt-1.5">
                      <div className="grid grid-cols-3 gap-1 bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl">
                        {(['pickup', 'table', 'delivery'] as const).map((type) => (
                          <button 
                            key={type} 
                            onClick={() => { 
                              triggerBeep('tap'); 
                              setFulfillmentType(type); 
                              // नया: डिलीवरी सेलेक्ट होते ही चार्ज बॉक्स ऑन हो जाएगा
                              if(type === 'delivery') setApplyDeliveryFee(true);
                            }} 
                            className={`py-1 rounded-lg text-[10px] font-black uppercase transition-all ${fulfillmentType === type ? "bg-orange-600 text-white shadow" : "text-neutral-700 dark:text-neutral-300"}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {fulfillmentType === 'table' && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-1.5 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase text-amber-800 dark:text-amber-300">
                            <span>Table: {tableNumber}</span>
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                          {['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6'].map((tName, idx) => {
                            const isTableOccupied = activeTableOrders.some(o => o.tableNumber === tName);
                            return (
                              <button 
                                key={tName}
                                type="button"
                                onClick={() => { 
                                  triggerBeep('tap'); 
                                  if (isTableOccupied && !activeEditingOrderId) {
                                    toast.error(`${tName} पर पहले से एक बिल चल रहा है! कृपया 'Tables' टैब में जाकर उसमें आइटम जोड़ें। 🪑`, { duration: 4000 });
                                    return; 
                                  }
                                  setTableNumber(tName); 
                                }}
                                className={`py-1 rounded text-[9px] font-black uppercase border ${tableNumber === tName ? 'bg-amber-500 text-black border-amber-600 shadow' : 'bg-white dark:bg-neutral-800'} ${isTableOccupied && !activeEditingOrderId ? 'opacity-50 cursor-not-allowed border-red-500' : ''}`}
                              >
                                T{idx + 1}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      )}

                      {/* नया कोड: डिलीवरी चार्ज इनपुट बॉक्स */}
                      {fulfillmentType === 'delivery' && (
                        <div className="bg-blue-500/10 border border-blue-500/30 p-1.5 rounded-xl">
                          <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="checkbox" 
                                id="deliveryFeeCheck" 
                                checked={applyDeliveryFee} 
                                onChange={e => setApplyDeliveryFee(e.target.checked)} 
                                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" 
                              />
                              <label htmlFor="deliveryFeeCheck" className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-400 cursor-pointer">
                                Delivery Charge
                              </label>
                            </div>
                            {applyDeliveryFee && (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">₹</span>
                                <input 
                                  type="number" 
                                  min={0}
                                  value={customDeliveryFee} 
                                  onChange={e => setCustomDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-14 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-xs font-mono font-bold outline-none text-center" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* COLLAPSIBLE DISCOUNT & ADMIN PROMO CODE SECTION [F8] */}
                    <div className="mb-2 shrink-0">
                      {!isDiscountOpen ? (
                        <button 
                          type="button" 
                          onClick={() => setIsDiscountOpen(true)}
                          className="w-full flex justify-between items-center py-1.5 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-black uppercase text-neutral-700 dark:text-neutral-300 transition-all shadow-sm"
                        >
                          <span className="flex items-center gap-1.5">
                            <Tag size={12} className="text-orange-500" />
                            <span>Add Coupon / Discount (छूट) [F8]</span>
                          </span>
                          {discountValue > 0 ? (
                            <span className="font-mono text-orange-600 dark:text-orange-400 font-black">
                              -₹{getCalculatedDiscountAmount()} {appliedPromoName && `(${appliedPromoName})`}
                            </span>
                          ) : (
                            <ChevronDown size={14} className="text-neutral-400" />
                          )}
                        </button>
                      ) : (
                        <div className="space-y-2 bg-neutral-100 dark:bg-neutral-800/60 p-2.5 rounded-xl border border-orange-500/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                              <Ticket size={11} className="text-orange-500" /> Coupon / Discount (छूट)
                            </span>
                            <button type="button" onClick={() => setIsDiscountOpen(false)} className="text-neutral-400 p-0.5">
                              <ChevronUp size={14} />
                            </button>
                          </div>

                          <div className="flex gap-1.5">
                            <input 
                              type="text" 
                              placeholder="Coupon Code (e.g. CAFE10, BUM50)" 
                              value={promoCouponInput}
                              onChange={e => setPromoCouponInput(e.target.value)}
                              className="flex-1 bg-white dark:bg-neutral-900 border rounded-lg px-2.5 py-1 text-xs font-mono font-bold uppercase text-neutral-900 dark:text-white outline-none" 
                            />
                            <button 
                              type="button" 
                              onClick={handleApplyPromoCoupon} 
                              className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-black uppercase"
                            >
                              Apply
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-300 dark:border-neutral-700">
                            <div className="flex bg-neutral-200 dark:bg-neutral-700 p-0.5 rounded-lg border">
                              <button type="button" onClick={() => setDiscountType('amount')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${discountType === 'amount' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>₹ Flat</button>
                              <button type="button" onClick={() => setDiscountType('percentage')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${discountType === 'percentage' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>% Off</button>
                            </div>
                            <input 
                              type="number" 
                              min={0}
                              placeholder="Value"
                              value={discountValue || ''}
                              onChange={e => { setDiscountValue(Number(e.target.value)); setAppliedPromoName(null); }}
                              className="w-full bg-white dark:bg-neutral-900 border rounded-lg px-2 py-1 text-xs text-neutral-900 dark:text-white outline-none font-mono font-bold" 
                            />
                            {discountValue > 0 && (
                              <button type="button" onClick={() => { setDiscountValue(0); setAppliedPromoName(null); }} className="text-red-500 text-xs font-black px-1.5 py-1 bg-red-500/10 rounded-lg shrink-0">Clear</button>
                            )}
                          </div>

                          {/* 📦 PACKING CHARGE SECTION (डिस्काउंट के अंदर ही) */}
                          <div className="pt-2 border-t border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="checkbox" 
                                id="packingChargeCheck" 
                                checked={applyPackingCharge} 
                                onChange={e => setApplyPackingCharge(e.target.checked)} 
                                className="w-3.5 h-3.5 accent-orange-600 cursor-pointer" 
                              />
                              <label htmlFor="packingChargeCheck" className="text-[10px] font-black uppercase text-neutral-800 dark:text-neutral-200 cursor-pointer flex items-center gap-1">
                                📦 Packing Charge (पैकिंग)
                              </label>
                            </div>

                            {applyPackingCharge && (
                              <div className="flex items-center gap-1">
                                <div className="flex gap-1">
                                  {[10, 20].map(val => (
                                    <button 
                                      key={val} 
                                      type="button" 
                                      onClick={() => setPackingCharge(val)} 
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${packingCharge === val ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-neutral-800'}`}
                                    >
                                      ₹{val}
                                    </button>
                                  ))}
                                </div>
                                <span className="text-[11px] font-bold text-neutral-500">₹</span>
                                <input 
                                  type="number" 
                                  min={0}
                                  value={packingCharge} 
                                  onChange={e => setPackingCharge(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-12 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 text-xs font-mono font-bold outline-none text-center" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CASH CHANGE RETURN CALCULATOR */}
                    <div className="bg-neutral-100 dark:bg-neutral-800/80 p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 mb-2 shrink-0 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-neutral-700 dark:text-neutral-300">कैश दिया (Cash Tendered):</span>
                        <div className="flex items-center gap-1">
                          <input 
                            id="cashTenderedInput"
                            type="number" 
                            placeholder="₹ नोट" 
                            value={cashTendered} 
                            onChange={e => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-20 bg-white dark:bg-neutral-900 border rounded px-2 py-1 text-xs font-mono font-bold outline-none" 
                          />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[100, 200, 500, 1000].map(val => (
                          <button 
                            key={val} 
                            type="button" 
                            onClick={() => setCashTendered(val)} 
                            className="flex-1 py-0.5 bg-white dark:bg-neutral-900 border rounded text-[10px] font-bold text-neutral-700 dark:text-neutral-300"
                          >
                            ₹{val}
                          </button>
                        ))}
                      </div>
                      {cashTendered !== '' && Number(cashTendered) >= getTotalBillPrice() && (
                        <div className="pt-1 border-t flex justify-between items-center text-xs font-black text-green-600">
                          <span>वापस दें (Change Return):</span>
                          <span className="font-mono text-sm">₹{changeReturnAmount}</span>
                        </div>
                      )}
                    </div>

                    {/* BILL TOTALS */}
                    <div className="space-y-1 text-xs border-t border-neutral-300 dark:border-neutral-800 pt-1.5 shrink-0 font-bold">
                      <div className="flex justify-between text-neutral-600 dark:text-neutral-400"><span>Subtotal</span><span className="font-mono">₹{getCartSubtotal()}</span></div>
                      
                      {/* 👉 NEW: GST DISPLAY IN CART */}
                      {gstEnabled && getGstAmountCalculated() > 0 && (
                        <div className="flex justify-between text-neutral-800 dark:text-neutral-200">
                          <span>GST Tax ({gstRate}%)</span>
                          <span className="font-mono text-red-500">+₹{getGstAmountCalculated()}</span>
                        </div>
                      )}

                      {getDeliveryCharge() > 0 && <div className="flex justify-between text-neutral-800 dark:text-neutral-200"><span>Delivery Charge</span><span className="font-mono">+₹{getDeliveryCharge()}</span></div>}
                      {getPackingCharge() > 0 && <div className="flex justify-between text-neutral-800 dark:text-neutral-200"><span>Packing Charge (📦)</span><span className="font-mono text-orange-600 dark:text-orange-400">+₹{getPackingCharge()}</span></div>}
                      {getCalculatedDiscountAmount() > 0 && <div className="flex justify-between text-orange-600 font-bold"><span>Discount {appliedPromoName && `(${appliedPromoName})`}</span><span className="font-mono">-₹{getCalculatedDiscountAmount()}</span></div>}
                      {isRedeemingPoints && <div className="flex justify-between text-amber-600 font-bold"><span>Points Redeemed</span><span className="font-mono">-₹{getRedemptionDiscount()}</span></div>}
                      <div className="flex justify-between text-sm font-black text-green-600 dark:text-green-500 pt-1 border-t border-dashed border-neutral-400">
                        <span>Grand Total</span><span className="font-mono text-base font-black">₹{getTotalBillPrice()}</span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    {fulfillmentType === 'table' ? (
                      <div className="space-y-1.5 pt-2 shrink-0">
                        <button 
                          onClick={handleSaveTableOrderKotOnly} 
                          disabled={cart.length === 0 || isSubmittingOrder} 
                          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 rounded-xl uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow"
                        >
                          <Printer size={15} />
                          <span>{activeEditingOrderId ? `Update ${tableNumber} (केवल नए आइटम की KOT)` : `Save on ${tableNumber} & Print KOT`}</span>
                        </button>
                        <button 
                          onClick={handleFinalCheckoutAndPrintBill} 
                          disabled={cart.length === 0 || isSubmittingOrder} 
                          className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-xl"
                        >
                          <Receipt size={15} />
                          <span>Settle & Print Final Bill (केवल पूरा बिल) [F9]</span>
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 shrink-0">
                        <button 
                          onClick={handleFinalCheckoutAndPrintBill} 
                          disabled={cart.length === 0 || isSubmittingOrder} 
                          className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-xl"
                        >
                          {isSubmittingOrder ? <Loader2 className="animate-spin" size={15} /> : <Receipt size={15} />}
                          <span>Print Bill (₹{getTotalBillPrice()}) [F9]</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DAILY BILLS & SETTLEMENT */}
            {activeTab === 'settlement' && (
              <div className="flex-1 p-6 h-full flex flex-col overflow-hidden space-y-4">
                <div className="flex justify-between items-center border-b pb-3 shrink-0">
                  <div>
                    <h2 className="text-base font-black uppercase text-orange-600 dark:text-orange-500 flex items-center gap-2">
                      <Receipt size={20} /> Daily Bills & Settlement (दैनिक बिल व भुगतान सेटलमेंट)
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      यहाँ से ग्राहक के भुगतान (Cash/UPI/उधार) को सेलेक्ट करके सेटल करें। सेटल होने के बाद ही यह दैनिक बिक्री रिपोर्ट में जुड़ेगा।
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl">
                      <button onClick={() => setSettlementFilter('all')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg ${settlementFilter === 'all' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>All ({todaySettlementOrders.length})</button>
                      <button onClick={() => setSettlementFilter('unsettled')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg ${settlementFilter === 'unsettled' ? 'bg-red-600 text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>Unsettled ({unsettledOrdersCount})</button>
                      <button onClick={() => setSettlementFilter('settled')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg ${settlementFilter === 'settled' ? 'bg-green-600 text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>Settled</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {filteredSettlementOrders.length === 0 ? (
                    <div className="text-center py-24 text-neutral-500 font-bold text-xs">
                      कोई बिल उपलब्ध नहीं है।
                    </div>
                  ) : (
                    filteredSettlementOrders.map((order) => {
                      const isSettled = order.status === 'completed';
                      return (
                        <div 
                          key={order.id} 
                          className={`border rounded-2xl p-4 flex flex-col lg:flex-row justify-between lg:items-center gap-4 transition-all shadow-sm ${
                            isSettled 
                              ? 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800' 
                              : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              {/* 🌐 ऑनलाइन ऑर्डर के लिए WEB- टैग और काउंटर के लिए Bill # */}
                              {order.source !== 'PC_POS' ? (
                                <span className="font-mono font-black text-xs bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                  🌐 WEB-{order.billNumber}
                                </span>
                              ) : (
                                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                                  Bill #{order.billNumber}
                                </span>
                              )}
                              <span className="text-neutral-400">•</span>
                              <span className="font-bold text-xs text-neutral-900 dark:text-white">{order.customerName || 'Walk-in Guest'}</span>
                              {order.customerPhone && <span className="text-[10px] text-neutral-500 font-mono">({order.customerPhone})</span>}
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                isSettled ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse'
                              }`}>
                                {isSettled ? `✅ चुकता (${order.paymentMethod?.toUpperCase()})` : '🟡 भुगतान बाकी (Unsettled)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 font-mono mt-1">
                              {order.items?.map((it: any) => `${it.name} x${it.quantity}`).join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-neutral-500 block uppercase font-bold">Total Amount</span>
                              <span className="font-mono font-black text-base text-green-600 dark:text-green-400">₹{order.total}</span>
                            </div>

                           {!isSettled ? (
                              <div className="flex gap-1.5 flex-wrap justify-end">
                                <button 
                                  onClick={() => handleQuickSettleOrder(order.id, 'cash')} 
                                  className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase shadow"
                                >
                                  💵 Cash
                                </button>
                                <button 
                                  onClick={() => handleQuickSettleOrder(order.id, 'upi')} 
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase shadow"
                                >
                                  📱 UPI
                                </button>
                                <button 
                                  onClick={() => handleQuickSettleOrder(order.id, 'due')} 
                                  className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow"
                                >
                                  📕 उधार (Due)
                                </button>
                                <button 
                                  onClick={() => handleReEditOrder(order)} 
                                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase shadow ml-2 flex items-center gap-1"
                                >
                                  <SafeEdit3 size={14} /> Edit
                                </button>
                                
                                {/* 👉 NEW: ऑनलाइन/पेंडिंग आर्डर के लिए KOT और Bill प्रिंट करने के बटन */}
                                <button 
                                  onClick={() => handlePrintReceiptDirect(order, true)} 
                                  className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase shadow ml-1 flex items-center gap-1"
                                  title="किचन के लिए KOT निकालें"
                                >
                                  <SafePrinter size={14} /> KOT
                                </button>
                                <button 
                                  onClick={() => handlePrintReceiptDirect(order, false)} 
                                  className="px-3 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-xl text-xs font-black uppercase shadow flex items-center gap-1 border border-neutral-300 dark:border-neutral-700"
                                  title="कस्टमर के लिए बिल निकालें"
                                >
                                  <SafePrinter size={14} /> Bill
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleReEditOrder(order)} 
                                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow"
                                >
                                  <SafeEdit3 size={14} /> Re-Edit
                                </button>
                                <button 
                                  onClick={() => handlePrintReceiptDirect(order, false)} 
                                  className="px-3 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1 border"
                                >
                                  <SafePrinter size={14} /> Reprint
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: INVENTORY & STOCK */}
            {activeTab === 'inventory' && (
              <div className="flex-1 p-6 h-full overflow-y-auto space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h2 className="text-sm font-black uppercase text-orange-600 dark:text-orange-500">Menu Items & Stock Manager</h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">Add food items, edit pricing, manage categories and delete old items.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsCatManagerModalOpen(true)} className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700">
                      <ArrowLeftRight size={14} className="text-orange-500" /> Category Manager
                    </button>
                    <button onClick={() => handleOpenItemEditor(null)} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow">
                      <SafePackagePlus size={16} /> + Add Item
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <SafeSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search menu by item name, category or code..." 
                    value={inventorySearchQuery}
                    onChange={e => setInventorySearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {filteredInventoryProducts.map((item) => {
                    const isAvail = item.isAvailable !== false;
                    const variantsCount = item.variants && typeof item.variants === 'object' ? Object.keys(item.variants).length : 0;
                    return (
                      <div key={item.id} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex justify-between items-start mb-1.5">
                            <div>
                              <p className="font-bold text-xs text-neutral-900 dark:text-neutral-100">{item.name}</p>
                              {item.itemCode && <p className="text-[10px] font-mono text-yellow-600 dark:text-yellow-400 font-black">Code: #{item.itemCode}</p>}
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isAvail ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                              {isAvail ? 'In Stock' : 'Out'}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-orange-600 dark:text-orange-400 font-black mb-1">₹{item.price}</p>
                          <p className="text-[10px] text-neutral-600 dark:text-neutral-400">Category: {item.category || 'General'}</p>

                          {variantsCount > 0 && (
                            <div className="mt-2 pt-2 border-t border-dashed border-neutral-300 dark:border-neutral-700">
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Sizes / Variants ({variantsCount}):</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(item.variants).map(([vName, vPrice]: any) => (
                                  <span key={vName} className="text-[9px] bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 font-mono font-bold">
                                    {vName}: ₹{vPrice}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700">
                          <button onClick={() => handleOpenItemEditor(item)} className="flex-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-orange-600 hover:text-white py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1">
                            <SafeEdit3 size={12} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(item.id, item.name)} 
                            className="p-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 rounded-xl transition-all"
                            title="Delete Item Permanently"
                          >
                            <SafeTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: PAST RECEIPTS */}
            {activeTab === 'receipts' && (
              <div className="flex-1 p-6 h-full flex flex-col overflow-hidden space-y-4">
                <div className="flex justify-between items-center border-b pb-3 shrink-0">
                  <div>
                    <h2 className="text-sm font-black uppercase text-orange-600 dark:text-orange-500 flex items-center gap-2">
                      <Printer size={18} /> Past Receipts & Bill Reprints
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">Filter bills by Today or Yesterday, search by Bill Number or Phone, and reprint receipts.</p>
                  </div>
                  <button onClick={fetchPastReceipts} disabled={isReceiptsLoading} className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700">
                    {isReceiptsLoading ? <Loader2 className="animate-spin" size={14} /> : <SafeRefreshCw size={14} />} Refresh
                  </button>
                </div>

                <div className="flex gap-3 shrink-0 items-center">
                  <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
                    <button 
                      onClick={() => setReceiptFilterDay('today')} 
                      className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${receiptFilterDay === 'today' ? 'bg-orange-600 text-white shadow' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      Today (आज)
                    </button>
                    <button 
                      onClick={() => setReceiptFilterDay('yesterday')} 
                      className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${receiptFilterDay === 'yesterday' ? 'bg-orange-600 text-white shadow' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      Yesterday (कल)
                    </button>
                    <button 
                      onClick={() => setReceiptFilterDay('all')} 
                      className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${receiptFilterDay === 'all' ? 'bg-orange-600 text-white shadow' : 'text-neutral-700 dark:text-neutral-300'}`}
                    >
                      All Bills
                    </button>
                  </div>

                  <div className="relative flex-1">
                    <SafeSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Type Bill No (e.g. 201), Customer Name or Phone..." 
                      value={receiptSearchQuery} 
                      onChange={e => setReceiptSearchQuery(e.target.value)} 
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2 pl-10 pr-4 text-xs outline-none font-bold" 
                    />
                  </div>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                  {isReceiptsLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
                  ) : filteredPastReceipts.length === 0 ? (
                    <div className="text-center py-24 text-neutral-500 font-bold text-xs">
                      No bills found for the selected filter.
                    </div>
                  ) : (
                    filteredPastReceipts.map((order) => {
                      const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp || Date.now());
                      return (
                        <div 
                          key={order.id} 
                          onClick={() => { setSelectedReceipt(order); setIsReceiptModalOpen(true); }} 
                          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-orange-500 p-4 rounded-2xl flex justify-between items-center cursor-pointer transition-all shadow-sm" 
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              {order.source !== 'PC_POS' ? (
                                <span className="font-mono font-black text-xs bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  🌐 WEB-{order.billNumber || 'N/A'}
                                </span>
                              ) : (
                                <span className="font-mono font-black text-amber-600 dark:text-yellow-400 text-sm">
                                  Bill #{order.billNumber || 'N/A'}
                                </span>
                              )}
                              <span className="text-neutral-400">•</span>
                              <span className="font-bold text-xs text-neutral-900 dark:text-white">{order.customerName || 'Walk-in Guest'}</span>
                              {order.customerPhone && <span className="text-[10px] text-neutral-500 font-mono">({order.customerPhone})</span>}
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 ml-1">
                                {order.fulfillmentType || 'pickup'}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono block mt-1">
                              {orderDate.toLocaleString()} • {order.items?.length || 0} Items
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${order.paymentMethod === 'upi' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : order.paymentMethod === 'due' ? 'bg-red-500/15 text-red-600 dark:text-red-400' : order.paymentMethod === 'split' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-green-500/15 text-green-600 dark:text-green-400'}`}>
                              {order.paymentMethod || 'cash'}
                            </span>
                            <span className="font-mono font-black text-sm text-green-600 dark:text-green-400">₹{order.total}</span>
                            <div className="flex gap-1.5">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReEditOrder(order);
                                }} 
                                className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-black rounded-xl transition-colors"
                                title="Edit Bill"
                              >
                                <SafeEdit3 size={14} />
                              </button>
                             <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReceipt(order);
                                  setIsReceiptModalOpen(true);
                                }} 
                                className="p-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                                title="View/Print"
                              >
                                <SafeEye size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: REPORTS WITH ITEM-WISE SALES */}
                  
                
            {/* TAB 4: REPORTS WITH ITEM-WISE SALES */}
            {activeTab === 'reports' && (
              <div className="flex-1 p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h2 className="text-lg font-black uppercase text-orange-600 dark:text-orange-500 flex items-center gap-2">
                      <SafeBarChart3 size={20} /> Sales & Item-wise Analytics
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">Total settled sales, cash drawer reconciliation and item-wise sales report.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSendOwnerSummary} className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow">
                      <SafeSend size={14} /> WhatsApp to Owner
                    </button>
                    <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-2xl border">
                      <button onClick={() => setReportFilter('today')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-xl ${reportFilter === 'today' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-400'}`}>Today</button>
                      <button onClick={() => setReportFilter('last7days')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-xl ${reportFilter === 'last7days' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-400'}`}>Last 7 Days</button>
                      <button onClick={() => setReportFilter('custom')} className={`px-3 py-1.5 text-xs font-black uppercase rounded-xl ${reportFilter === 'custom' ? 'bg-orange-600 text-white' : 'text-neutral-700 dark:text-neutral-400'}`}>Date Picker</button>
                    </div>
                    {reportFilter === 'custom' && (
                      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
                        <input 
                          type="date" 
                          value={customStartDate} 
                          onChange={e => setCustomStartDate(e.target.value)}
                          title="Start Date"
                          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                        />
                        <span className="text-[10px] font-black uppercase text-neutral-500">To</span>
                        <input 
                          type="date" 
                          value={customEndDate} 
                          onChange={e => setCustomEndDate(e.target.value)}
                          min={customStartDate}
                          title="End Date"
                          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* SUMMARY TILES */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-neutral-500">Settled Sales</p>
                    <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">₹{reportSummary.totalSale}</p>
                    <p className="text-[9px] text-neutral-500">{reportSummary.totalOrdersCount} Settled Orders</p>
                  </div>
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-neutral-500">Cash Received</p>
                    <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">₹{reportSummary.cashSale}</p>
                  </div>
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-neutral-500">UPI Received</p>
                    <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">₹{reportSummary.upiSale}</p>
                  </div>
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-neutral-500">उधार (Due)</p>
                    <p className="text-xl font-black font-mono text-red-600 dark:text-red-400">₹{reportSummary.dueSale}</p>
                  </div>
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-neutral-500">Net in Drawer</p>
                    <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">₹{reportSummary.netCashInDrawer}</p>
                  </div>
                </div>

                {/* 📊 DAILY SALES GRAPH (दिन-वार बिक्री का ग्राफ़) */}
                {(reportFilter === 'last7days' || reportFilter === 'custom') && dailyTrendData.length > 0 && (
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-6 rounded-3xl shadow-sm mt-6 relative overflow-hidden">
                    {/* ग्राफ़ के पीछे का हल्का संतरी (Orange) ग्लो (चमक) */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-8 relative z-10">
                       <div>
                         <h3 className="text-sm font-black uppercase text-orange-600 dark:text-orange-500 flex items-center gap-2">
                           <SafeBarChart3 size={18} /> Sales Trend (बिक्री ग्राफ)
                         </h3>
                         <p className="text-[10px] text-neutral-500 font-bold mt-1">
                           {reportFilter === 'custom' ? 'चुनी गई तारीखों की बिक्री' : 'पिछले 7 दिनों की बिक्री का ग्राफ'}
                         </p>
                       </div>
                       <div className="text-right">
                         <p className="text-[9px] font-black uppercase text-neutral-500">Highest Sale</p>
                         <span className="text-sm font-mono font-black text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20 shadow-sm">
                           ₹{Math.max(...dailyTrendData.map(d => d.total))}
                         </span>
                       </div>
                    </div>

                    {/* यहाँ overflow-x-auto लगा दिया गया है, ताकि 15-30 दिन होने पर स्क्रॉल हो सके */}
                    <div className="flex items-end gap-2 sm:gap-4 h-56 relative z-10 pt-12 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto scrollbar-hide">
                      {dailyTrendData.map((day, idx) => {
                        const maxVal = Math.max(...dailyTrendData.map(d => d.total));
                        const barHeight = maxVal > 0 && day.total > 0 ? Math.max((day.total / maxVal) * 100, 3) : 0;
                        
                        // असली "आज" की तारीख का पता लगाना
                        const todayDateStr = `${String(new Date().getDate()).padStart(2, '0')} ${new Date().toLocaleString('default', { month: 'short' })}`;
                        const isToday = day.date === todayDateStr; 
                        
                        return (
                          // 👇 फिक्स 1: यहाँ 'relative' जोड़ा गया है ताकि अमाउंट खंभे के ठीक ऊपर रहे
                          <div key={idx} className="flex flex-col items-center gap-2 group h-full justify-end min-w-[32px] sm:min-w-[48px] relative">
                            
                            {/* टूलटिप / अमाउंट (Hover करने पर हवा में दिखेगा) */}
                            {/* 👇 फिक्स 2: z-20 जोड़ा गया है ताकि यह कट न हो */}
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:-translate-y-1 flex flex-col items-center pointer-events-none absolute -top-8 z-20">
                              <span className="bg-neutral-900 dark:bg-white text-white dark:text-black text-[10px] font-mono font-black px-2 py-1 rounded-lg shadow-lg whitespace-nowrap">
                                ₹{day.total}
                              </span>
                              <div className="w-2 h-2 bg-neutral-900 dark:bg-white rotate-45 -mt-1.5"></div>
                            </div>
                            
                            {/* बार (Bar Background & Foreground) */}
                            <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800/60 rounded-t-xl relative flex items-end justify-center overflow-hidden border border-neutral-200 dark:border-neutral-700/50">
                               {day.total > 0 ? (
                                 <div 
                                   className={`w-full rounded-t-lg transition-all duration-1000 ease-out shadow-[inset_0_4px_4px_rgba(255,255,255,0.3)] ${
                                     isToday 
                                       ? 'bg-gradient-to-t from-green-600 to-emerald-400' // आज के लिए हरा रंग 
                                       : 'bg-gradient-to-t from-orange-600 to-yellow-400' // बाकी दिनों के लिए संतरी रंग
                                   }`}
                                   style={{ height: `${barHeight}%` }}
                                 ></div>
                               ) : (
                                 <div className="text-[8px] text-neutral-400 font-bold mb-2">₹0</div>
                               )}
                            </div>
                            
                            {/* तारीख (Date) */}
                            <span className={`text-[10px] font-bold whitespace-nowrap ${isToday ? 'text-green-600 dark:text-green-400 font-black' : 'text-neutral-600 dark:text-neutral-400'}`}>
                              {isToday ? 'Today' : day.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CASH DRAWER AUDIT */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-5 rounded-3xl space-y-4 shadow-sm mt-6">
                  <div className="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-800 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase text-amber-600 dark:text-yellow-400">Cash Drawer Audit (गल्ला मिलान)</h3>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">Expected Net Cash: <span className="font-mono text-green-600 dark:text-green-400 font-bold">₹{reportSummary.netCashInDrawer}</span></p>
                    </div>
                    <button onClick={() => setIsExpenseModalOpen(true)} className="px-3 py-1.5 bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase">
                      + Add Expense [F6]
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      placeholder="Counted Cash in Drawer (₹)" 
                      value={physicalCashInput}
                      onChange={e => setPhysicalCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                      className="flex-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-900 dark:text-white outline-none font-bold" 
                    />
                    {physicalCashInput !== '' && (
                      <div className={`text-xs font-black px-4 py-2.5 rounded-xl border ${Number(physicalCashInput) === reportSummary.netCashInDrawer ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40' : Number(physicalCashInput) > reportSummary.netCashInDrawer ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40' : 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40'}`}>
                        {Number(physicalCashInput) === reportSummary.netCashInDrawer ? '✅ Matched!' : Number(physicalCashInput) > reportSummary.netCashInDrawer ? `⚠️ Excess: +₹${Number(physicalCashInput) - reportSummary.netCashInDrawer}` : `❌ Short: -₹${reportSummary.netCashInDrawer - Number(physicalCashInput)}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* ITEM-WISE SALES TABLE */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-5 rounded-3xl space-y-3 shadow-sm">
                  <div className="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-black uppercase text-orange-600 dark:text-orange-500 flex items-center gap-1.5">
                      <Layers size={14} /> आइटम-वाइज़ बिक्री रिपोर्ट (Item-wise Sales Report)
                    </h3>
                    <span className="text-[10px] text-neutral-500 font-bold">{itemWiseSales.length} items sold</span>
                  </div>

                  {itemWiseSales.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-6 text-center">No settled items in this date range.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase text-[10px]">
                            <th className="py-2">Item Name</th>
                            <th className="py-2 text-center">Qty Sold</th>
                            <th className="py-2 text-right">Total Revenue (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {itemWiseSales.map((row, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                              <td className="py-2 font-bold text-neutral-900 dark:text-neutral-100">{row.name}</td>
                              <td className="py-2 text-center font-mono font-black text-orange-600">{row.quantity}</td>
                              <td className="py-2 text-right font-mono font-bold">₹{row.revenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: TABLES MANAGER */}
            {activeTab === 'tables' && (
              <div className="flex-1 p-6 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-black uppercase text-amber-600 dark:text-amber-500">Active Dine-In Tables ({activeTableOrders.length})</h2>
                  <p className="text-xs text-neutral-500">Click any running table to modify items or settle the bill directly.</p>
                </div>
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                  {['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6'].map((tName) => {
                    const order = activeTableOrders.find(o => o.tableNumber === tName);
                    return (
                      <div key={tName} className={`border rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-all ${order ? 'bg-white dark:bg-neutral-900 border-amber-500 ring-2 ring-amber-400/50' : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 opacity-60'}`}>
                        <div>
                          <div className="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-3">
                            <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">🪑 {tName}</span>
                            {order ? (
                              <span className="bg-amber-500 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded">Bill #{order.billNumber}</span>
                            ) : (
                              <span className="text-[10px] font-bold text-neutral-500 uppercase">Available</span>
                            )}
                          </div>
                          {order ? (
                            <>
                              <p className="text-xs font-bold mb-2">👤 {order.customerName || 'Walk-in Guest'} {order.customerPhone && `(${order.customerPhone})`}</p>
                              <div className="space-y-1.5 py-2 border-t border-dashed border-neutral-300 dark:border-neutral-800 mb-3 max-h-40 overflow-y-auto">
                                {order.items?.map((it: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs font-medium">
                                    <span className="truncate pr-2">{it.name}</span>
                                    <span className="font-bold text-orange-600 dark:text-orange-400 shrink-0">x{it.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-neutral-400 py-6 text-center">Table is empty.</p>
                          )}
                        </div>
                        <div className="space-y-2 pt-2 border-t border-neutral-300 dark:border-neutral-800">
                          {order ? (
                            <>
                              <div className="flex justify-between text-xs font-black text-green-600 dark:text-green-500">
                                <span>Running Bill:</span>
                                <span className="font-mono text-sm font-black">₹{order.total}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  setActiveEditingOrderId(order.id);
                                  setActiveEditingBillNumber(order.billNumber);
                                  setActiveEditingOriginalItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
                                  setTableNumber(order.tableNumber || tName);
                                  setFulfillmentType('table');
                                  setCart(order.items || []);
                                  setCustomerName(order.customerName || '');
                                  setCustomerPhone(order.customerPhone || '');
                                  setActiveTab('billing');
                                  toast.success(`Loaded ${tName} Bill #${order.billNumber}`);
                                  setTimeout(() => searchInputRef.current?.focus(), 80);
                                }} 
                                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1 shadow"
                              >
                                <SafeEdit3 size={14} /> Add Items / Settle
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => {
                                setActiveEditingOrderId(null);
                                setActiveEditingBillNumber(null);
                                setActiveEditingOriginalItems([]);
                                setTableNumber(tName);
                                setFulfillmentType('table');
                                setCart([]);
                                setActiveTab('billing');
                                setTimeout(() => searchInputRef.current?.focus(), 80);
                              }} 
                              className="w-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-white font-black py-2 rounded-xl text-xs uppercase"
                            >
                              + New Order
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 6: LIVE ORDERS */}
            {activeTab === 'orders' && (
              <div className="flex-1 p-6 h-full overflow-y-auto">
                <h2 className="text-sm font-black uppercase text-orange-600 dark:text-orange-500 mb-4">Live Delivery & Pickup Orders ({activeLiveOrders.length})</h2>
                <div className="grid grid-cols-3 gap-4">
                  {activeLiveOrders.length === 0 ? (
                    <div className="col-span-3 text-center py-24 text-neutral-500 font-bold">No active live orders.</div>
                  ) : (
                    activeLiveOrders.map((order) => (
                      <div key={order.id} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-3">
                        <div>
                          <div className="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-2">
                            {order.source !== 'PC_POS' ? (
                              <span className="font-mono font-black text-xs bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                🌐 WEB-{order.billNumber}
                              </span>
                            ) : (
                              <span className="font-mono font-black text-amber-600 dark:text-yellow-400">
                                Bill #{order.billNumber}
                              </span>
                            )}
                            <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase px-2 py-0.5 rounded">{order.fulfillmentType}</span>
                          </div>
                          <p className="text-xs font-bold">👤 {order.customerName} ({order.customerPhone || 'Walk-in'})</p>
                          <div className="space-y-1 py-2 border-t border-dashed border-neutral-300 dark:border-neutral-800 my-2 max-h-36 overflow-y-auto">
                            {order.items?.map((it: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs font-medium">
                                <span>{it.name}</span><span className="font-bold text-orange-600">x{it.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm font-black text-green-600 dark:text-green-400 font-mono">Total: ₹{order.total}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-neutral-300 dark:border-neutral-800">
                          <button onClick={() => handlePrintReceiptDirect(order, false)} className="py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1">
                            <SafePrinter size={13} /> Print
                          </button>
                          <button onClick={async () => {
                            await updateDoc(doc(db, "orders", order.id), { status: 'completed', paymentSettled: true, settledAt: new Date() });
                            toast.success("Order Completed! ✅");
                          }} className="py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1">
                            <Check size={13} /> Done
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm("क्या आप सच में यह ऑनलाइन ऑर्डर रिजेक्ट करना चाहते हैं?")) return;
                            await updateDoc(doc(db, "orders", order.id), { status: 'rejected', rejectedAt: new Date() });
                            setLiveOrders(prev => prev.filter(o => o.id !== order.id));
                            toast.success("ऑर्डर रिजेक्ट कर दिया गया और हटा दिया गया! 🗑️");
                          }} className="py-2 bg-red-500/15 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1">
                            <SafeX size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 8: UDHARI BOOK */}
            {activeTab === 'udhari' && (
              <div className="flex-1 p-6 h-full flex flex-col overflow-hidden space-y-4">
                <div className="flex justify-between items-center border-b pb-3 shrink-0">
                  <div>
                    <h2 className="text-lg font-black uppercase text-red-600 flex items-center gap-2">
                      <SafeFileText size={20} /> Udhari Book (खाता / उधार)
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">सभी ग्राहकों के उधार (Due) बिल यहाँ देखें और भुगतान प्राप्त होने पर जमा (Clear) करें।</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-2xl text-right shadow-sm">
                     <p className="text-[10px] font-black uppercase text-red-600">Total Pending Udhari</p>
                     <p className="text-xl font-black font-mono text-red-600">
                       ₹{dueOrders.reduce((acc, o) => acc + Number(o.total || 0), 0)}
                     </p>
                  </div>
                </div>

                <div className="flex gap-3 shrink-0 items-center">
                   <div className="relative flex-1">
                     <SafeSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                     <input 
                       type="text" 
                       placeholder="Search by Customer Name, Phone or Bill No..." 
                       value={udhariSearchQuery} 
                       onChange={e => setUdhariSearchQuery(e.target.value)} 
                       className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none font-bold" 
                     />
                   </div>
                   <button onClick={fetchDueOrders} disabled={isUdhariLoading} className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700">
                     {isUdhariLoading ? <Loader2 className="animate-spin" size={14} /> : <SafeRefreshCw size={14} />} Refresh
                   </button>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {isUdhariLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={32} /></div>
                  ) : dueOrders.filter(o => !udhariSearchQuery || String(o.customerName).toLowerCase().includes(udhariSearchQuery.toLowerCase()) || String(o.customerPhone).includes(udhariSearchQuery) || String(o.billNumber).includes(udhariSearchQuery)).length === 0 ? (
                    <div className="text-center py-24 text-neutral-500 font-bold text-xs">कोई भी उधार (Due) पेंडिंग नहीं है। 🎉</div>
                  ) : (
                    dueOrders.filter(o => !udhariSearchQuery || String(o.customerName).toLowerCase().includes(udhariSearchQuery.toLowerCase()) || String(o.customerPhone).includes(udhariSearchQuery) || String(o.billNumber).includes(udhariSearchQuery)).map(order => {
                      const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp || Date.now());
                      return (
                        <div key={order.id} className="bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-900/50 hover:border-red-500 p-4 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm transition-all">
                           <div>
                             <div className="flex items-center gap-2">
                               <span className="font-mono font-black text-red-600 dark:text-red-400 text-sm">Bill #{order.billNumber}</span>
                               <span className="text-neutral-400">•</span>
                               <span className="font-bold text-sm text-neutral-900 dark:text-white">{order.customerName || 'Unknown Guest'}</span>
                               {order.customerPhone && <span className="text-[11px] text-neutral-500 font-mono">({order.customerPhone})</span>}
                             </div>
                             <span className="text-[10px] text-neutral-500 block mt-1 font-bold">
                               📅 Date: {orderDate.toLocaleString()}
                             </span>
                           </div>
                           <div className="flex items-center gap-4">
                             <div className="text-right mr-2">
                               <span className="text-[10px] text-neutral-500 block uppercase font-bold">Pending Amount</span>
                               <span className="font-mono font-black text-lg text-red-600 dark:text-red-400">₹{order.total}</span>
                             </div>
                             <div className="flex gap-2">
                               <button onClick={() => {
                                 if(window.confirm(`क्या आप ${order.customerName} का ₹${order.total} का उधार CASH में जमा करना चाहते हैं?`)) {
                                   handleClearUdhari(order.id, 'cash');
                                 }
                               }} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase shadow">
                                 Receive Cash
                               </button>
                               <button onClick={() => {
                                 if(window.confirm(`क्या आप ${order.customerName} का ₹${order.total} का उधार UPI में जमा करना चाहते हैं?`)) {
                                   handleClearUdhari(order.id, 'upi');
                                 }
                               }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase shadow">
                                 Receive UPI
                               </button>
                             </div>
                           </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {/* TAB 9: CUSTOMERS & LOYALTY PROFILE */}
            {activeTab === 'customers' && (
              <div className="flex-1 p-6 h-full flex flex-col overflow-hidden space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-300 dark:border-neutral-800 pb-3 shrink-0">
                  <div>
                    <h2 className="text-lg font-black uppercase text-orange-600 flex items-center gap-2">
                      <SafeUserPlus size={20} /> Customers & Loyalty Directory
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">सभी ग्राहकों की प्रोफाइल देखें, पॉइंट्स मैनेज करें और नए ग्राहक जोड़ें।</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={fetchAllCustomers} disabled={isCustomersLoading} className="bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700">
                       {isCustomersLoading ? <Loader2 className="animate-spin" size={14} /> : <SafeRefreshCw size={14} />} Refresh
                     </button>
                     
                     {/* Import CSV Button */}
                     <label className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow cursor-pointer transition-colors">
                       <SafeFileText size={16} /> Import CSV
                       <input 
                         type="file" 
                         accept=".csv" 
                         className="hidden" 
                         onChange={handleImportCustomersCSV} 
                       />
                     </label>

                     <button onClick={openAddCustomerModal} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow">
                       <SafeUserPlus size={16} /> + Add Customer
                     </button>
                  </div>
                </div>

                {/* Stats & Sorting Header */}
                <div className="flex flex-col lg:flex-row gap-3 justify-between lg:items-center bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/20 p-3 rounded-2xl shrink-0">
                  <div className="flex gap-6 items-center px-2">
                    <div>
                      <p className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">Total Customers</p>
                      <p className="text-xl font-black font-mono text-neutral-900 dark:text-white">{totalCustomersCount}</p>
                    </div>
                    <div className="w-px h-8 bg-orange-500/20"></div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Total Loyalty Points</p>
                      <p className="text-xl font-black font-mono text-neutral-900 dark:text-white">⭐ {totalPointsInSystem}</p>
                    </div>
                  </div>
                  
                  <div className="flex bg-white dark:bg-neutral-900 rounded-xl border border-neutral-300 dark:border-neutral-700 p-1 shadow-sm shrink-0">
                    <button onClick={() => setCustomerSortBy('recent')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${customerSortBy === 'recent' ? 'bg-orange-600 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>Recent</button>
                    <button onClick={() => setCustomerSortBy('spent_high')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${customerSortBy === 'spent_high' ? 'bg-green-600 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>Top Spender (VIP)</button>
                    <button onClick={() => setCustomerSortBy('points_high')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${customerSortBy === 'points_high' ? 'bg-amber-500 text-black' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>High Points</button>
                    <button onClick={() => setCustomerSortBy('points_low')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${customerSortBy === 'points_low' ? 'bg-orange-600 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>Low Points</button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative shrink-0">
                  <SafeSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search customer by Name, Phone Number or Address..." 
                    value={customerTabSearch} 
                    onChange={e => setCustomerTabSearch(e.target.value)} 
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none font-bold shadow-sm focus:border-orange-500 transition-colors" 
                  />
                </div>

                {/* Customer Grid with Pagination */}
                 <div className="flex-1 overflow-y-auto pr-1 pb-10 flex flex-col space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
                    {isCustomersLoading ? (
                       <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
                    ) : paginatedCustomers.length === 0 ? (
                       <div className="col-span-full text-center py-24 text-neutral-500 font-bold text-xs">कोई ग्राहक नहीं मिला।</div>
                    ) : (
                      paginatedCustomers.map(cust => (
                        <div key={cust.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:border-orange-500 transition-colors gap-3">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                             <div>
  <div className="flex items-center gap-2">
    <p className="font-black text-sm text-neutral-900 dark:text-white uppercase">{cust.name || 'Valued Guest'}</p>
    {/* यह लाइन गेम से आये कस्टमर को 🎰 Game का टैग दे देगी */}
    {cust.importSource === 'SpinGame' && (
      <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/30 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase shadow-sm">
        🎰 Game
      </span>
    )}
  </div>
  <p className="text-xs font-mono text-neutral-500 mt-0.5">📞 {cust.phone || cust.id}</p>
</div>
                             <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                               ⭐ {cust.points || 0} Pts
                             </span>
                          </div>
                          
                          {cust.address ? (
                            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">📍 {cust.address}</p>
                          ) : (
                            <p className="text-[11px] text-neutral-400 italic mb-2">No address provided</p>
                          )}
                          
                          <div className="flex gap-4 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                             <div>
                               <p className="text-[9px] font-black uppercase text-neutral-500">Total Spent</p>
                               <p className="text-sm font-mono font-black text-green-600 dark:text-green-500">₹{cust.totalSpent || 0}</p>
                             </div>
                             <div>
                               <p className="text-[9px] font-black uppercase text-neutral-500">Visits</p>
                               <p className="text-sm font-mono font-black text-blue-600 dark:text-blue-500">{cust.totalVisits || 0} times</p>
                             </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1.5 items-center">
                          {/* 🗑️ डिलीट बटन */}
                          <button 
                            type="button"
                            onClick={() => handleDeleteCustomer(cust)} 
                            className="p-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 dark:border-red-800/40 rounded-xl transition-all shrink-0 shadow-sm"
                            title="ग्राहक को डिलीट करें"
                          >
                             <SafeTrash2 size={14} />
                          </button>

                          {/* 1. Edit Button */}
                          <button onClick={() => openEditCustomerModal(cust)} className="flex-1 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 transition-colors">
                             <SafeEdit3 size={13} /> Edit
                          </button>
                          
                          {/* 2. History Button */}
                          <button onClick={() => handleViewCustomerHistory(cust)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-colors">
                             <History size={14} /> History
                          </button>

                          {/* 3. New Order Button (नया बटन जो डायरेक्ट कार्ट में ले जाएगा) */}
                          <button onClick={() => {
                             triggerBeep('tap');
                             setCustomerPhone(cust.phone || cust.id);
                             setCustomerName(cust.name || 'Valued Guest');
                             setCustomerPoints(cust.points || 0);
                             setAddress(cust.address || '');
                             
                             setActiveTab('billing');
                             toast.success(`${cust.name} का आर्डर शुरू किया गया! 🛒`);
                             
                             setTimeout(() => searchInputRef.current?.focus(), 80);
                          }} className="flex-1 py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-colors">
                             <SafeShoppingBag size={14} /> Order
                          </button>
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                  
                  {/* Next / Previous Buttons */}
                  {!isCustomersLoading && totalCustomerPages > 1 && (
                    <div className="flex justify-center items-center gap-4 py-4 mt-auto">
                      <button 
                        onClick={() => setCustomerCurrentPage(prev => Math.max(1, prev - 1))} 
                        disabled={customerCurrentPage === 1}
                        className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-xl text-xs font-black uppercase shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <SafeChevronLeft size={16} className="inline mr-1" /> Previous
                      </button>
                      
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                        Page <span className="text-orange-600 dark:text-orange-400 font-black">{customerCurrentPage}</span> of {totalCustomerPages}
                      </span>
                      
                      <button 
                        onClick={() => setCustomerCurrentPage(prev => Math.min(totalCustomerPages, prev + 1))} 
                        disabled={customerCurrentPage === totalCustomerPages}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next <SafeChevronRight size={16} className="inline ml-1" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
     {/* TAB 7: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="flex-1 p-6 h-full overflow-y-auto flex justify-center">
                <div className="max-w-xl w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-6 rounded-3xl shadow-xl space-y-6">
                  <h3 className="text-sm font-black uppercase text-orange-600 dark:text-orange-500">POS & Hardware Settings</h3>
                  
                  {/* NEXT BILL / INVOICE NUMBER */}
                  <div className="space-y-2 border-b border-neutral-300 dark:border-neutral-800 pb-4">
                    <p className="text-xs font-bold uppercase">Next Bill / Invoice Number:</p>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={manualInvoiceCounterInput} 
                        onChange={e => setManualInvoiceCounterInput(e.target.value)}
                        placeholder="e.g. 200"
                        className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none" 
                      />
                      <button onClick={() => { 
                        const num = parseInt(manualInvoiceCounterInput, 10);
                        if (!isNaN(num) && num >= 1) {
                          localStorage.setItem("bb_pos_local_bill_counter_pc", String(num - 1));
                          toast.success(`Next Invoice will be #${num}! ✅`);
                        }
                      }} className="bg-orange-600 text-white px-4 rounded-xl text-xs font-black uppercase">Set Counter</button>
                    </div>
                  </div>

                  {/* 👉 NEW: GST Settings */}
                  <div className="space-y-2 border-b border-neutral-300 dark:border-neutral-800 pb-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold uppercase">Enable GST (टैक्स):</p>
                      <button 
                        onClick={() => {
                          const newVal = !gstEnabled;
                          setGstEnabled(newVal);
                          localStorage.setItem("bb_pos_gst_enabled_pc", String(newVal));
                          toast.success(newVal ? `GST Enabled (${gstRate}%)!` : "GST Disabled!");
                        }} 
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${gstEnabled ? 'bg-green-500' : 'bg-neutral-400'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${gstEnabled ? 'translate-x-6' : ''}`}></div>
                      </button>
                    </div>
                    {gstEnabled && (
                      <div className="flex gap-2 pt-2">
                        <input 
                          type="number" 
                          value={gstRate} 
                          onChange={e => {
                            const rate = Number(e.target.value);
                            setGstRate(rate);
                            localStorage.setItem("bb_pos_gst_rate_pc", String(rate));
                          }}
                          placeholder="GST % (e.g. 5)"
                          className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none" 
                        />
                        <span className="bg-neutral-200 dark:bg-neutral-700 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center">% Rate (दर)</span>
                      </div>
                    )}
                  </div>

                  {/* UPI ID SETTING */}
                  <div className="space-y-2 border-b border-neutral-300 dark:border-neutral-800 pb-4">
                    <p className="text-xs font-bold uppercase">Dynamic UPI ID (VPA for QR Code):</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={upiIdConfig} 
                        onChange={e => setUpiIdConfig(e.target.value)}
                        placeholder="e.g. Q991347275@ybl"
                        className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-mono outline-none" 
                      />
                      <button onClick={() => { localStorage.setItem("bb_pos_upi_id", upiIdConfig); toast.success("UPI ID Saved!"); }} className="bg-blue-600 text-white px-4 rounded-xl text-xs font-black uppercase">Save</button>
                    </div>
                  </div>

                  {/* OWNER WHATSAPP SETTING */}
                  <div className="space-y-2 border-b border-neutral-300 dark:border-neutral-800 pb-4">
                    <p className="text-xs font-bold uppercase">Owner WhatsApp Number (for EOD Report):</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={ownerPhoneConfig} 
                        onChange={e => setOwnerPhoneConfig(e.target.value)}
                        placeholder="e.g. 919714293759"
                        className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-mono outline-none" 
                      />
                      <button onClick={() => { localStorage.setItem("bb_pos_owner_phone", ownerPhoneConfig); toast.success("Owner Phone Saved!"); }} className="bg-green-600 text-white px-4 rounded-xl text-xs font-black uppercase">Save</button>
                    </div>
                  </div>

                  {/* THEME SETTING */}
                  <div className="space-y-2 border-b border-neutral-300 dark:border-neutral-800 pb-4">
                    <p className="text-xs font-bold uppercase">UI Theme:</p>
                    <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl w-48">
                      <button onClick={() => { setThemeMode('light'); localStorage.setItem("bb_pos_theme_pc", 'light'); document.documentElement.classList.remove('dark'); }} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${themeMode === 'light' ? 'bg-white text-orange-600 shadow' : 'text-neutral-700 dark:text-neutral-400'}`}>Light</button>
                      <button onClick={() => { setThemeMode('dark'); localStorage.setItem("bb_pos_theme_pc", 'dark'); document.documentElement.classList.add('dark'); }} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${themeMode === 'dark' ? 'bg-neutral-950 text-amber-400 shadow' : 'text-neutral-700 dark:text-neutral-400'}`}>Dark</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* POPUP: HELP & SHORTCUTS [F1] */}
      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3 shrink-0">
                <h3 className="font-black text-lg uppercase text-orange-600 flex items-center gap-2">
                  <SafeHelpCircle size={22} /> Keyboard Shortcuts (शॉर्टकट्स)
                </h3>
                <button onClick={() => setIsHelpModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="overflow-y-auto pr-2 space-y-4 text-sm flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <h4 className="font-black text-neutral-500 uppercase text-[10px] border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-2 tracking-wider">⚡ Navigation & Search</h4>
                    <p className="flex justify-between"><strong className="text-orange-600">F1</strong> <span>Help / Shortcuts</span></p>
                    <p className="flex justify-between"><strong className="text-orange-600">F2</strong> <span>Item Search (बिलिंग)</span></p>
                    <p className="flex justify-between"><strong className="text-orange-600">F4</strong> <span>Sales Report (बिक्री)</span></p>
                    <p className="flex justify-between"><strong className="text-orange-600">F5</strong> <span>Search Customer (ग्राहक)</span></p>
                    <p className="flex justify-between"><strong className="text-orange-600">F6</strong> <span>Daily Bills (सेटलमेंट)</span></p>
                    <p className="flex justify-between"><strong className="text-orange-600">F11</strong> <span>Customers Profile</span></p>
                  </div>
                  <div className="space-y-2 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <h4 className="font-black text-neutral-500 uppercase text-[10px] border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-2 tracking-wider">🛒 Billing Actions</h4>
                    <p className="flex justify-between"><strong className="text-green-600">F3</strong> <span>Smart Hold (होल्ड / लिस्ट)</span></p>
                    <p className="flex justify-between"><strong className="text-green-600">F7</strong> <span>Save Table & Print KOT</span></p>
                    <p className="flex justify-between"><strong className="text-green-600">F8</strong> <span>Discount (छूट)</span></p>
                    <p className="flex justify-between"><strong className="text-green-600">F9</strong> <span>Checkout & Print Bill</span></p>
                    <p className="flex justify-between"><strong className="text-green-600">F10</strong> <span>Cash Tendered (कैश वापसी)</span></p>
                    <p className="flex justify-between"><strong className="text-green-600">F12</strong> <span>Order Type (Pickup/Table)</span></p>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 mt-2">
                  <h4 className="font-black text-amber-600 dark:text-amber-400 uppercase text-[10px] mb-2 tracking-wider">💡 Smart Tricks</h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    <li><strong className="text-amber-700 dark:text-amber-300">Qty * Code :</strong> आइटम सर्च में <code>3*101</code> टाइप करके Enter दबाएं, 101 कोड वाले 3 आइटम कार्ट में जुड़ जाएंगे।</li>
                    <li><strong className="text-amber-700 dark:text-amber-300">Delete :</strong> पूरा कार्ट एक झटके में खाली करने के लिए।</li>
                    <li><strong className="text-amber-700 dark:text-amber-300">Esc :</strong> कोई भी पॉपअप बंद करें और वापस बिलिंग पर जाएं।</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* POPUP: KEYBOARD VARIATION MODAL (TAB TO SELECT, ENTER TO ADD) */}
      <AnimatePresence>
        {isVariationModalOpen && selectedProductForVariation && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-black text-sm uppercase text-orange-600">{selectedProductForVariation.name}</h3>
                  <p className="text-[10px] text-neutral-500">[Tab] से साइज़ चुनें व [Enter] दबाएँ</p>
                </div>
                <button onClick={() => setIsVariationModalOpen(false)} className="text-neutral-500"><X size={18} /></button>
              </div>

              {selectedProductForVariation.variants && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-neutral-500">Size / Portion:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedProductForVariation.variants).map(([size, price]: any, idx: number) => {
                      const isSelected = selectedVariantIndex === idx;
                      return (
                        <button 
                          key={size}
                          type="button"
                          onClick={() => { setSelectedVariantIndex(idx); setSelectedSize(size); setSelectedSizePrice(Number(price) || 100); }}
                          className={`py-2 px-3 rounded-xl text-xs font-black uppercase border transition-all ${
                            isSelected ? 'bg-orange-600 text-white border-orange-600 shadow ring-2 ring-orange-400' : 'bg-neutral-100 dark:bg-neutral-800'
                          }`}
                        >
                          <span className="font-mono text-[10px] opacity-70 mr-1">[{idx + 1}]</span>
                          {size} (₹{price})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <input 
                  type="text" 
                  placeholder="Cooking Note (Optional)" 
                  value={itemNoteInput} 
                  onChange={e => setItemNoteInput(e.target.value)} 
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border rounded-xl px-3 py-2 text-xs outline-none font-bold" 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsVariationModalOpen(false)} className="flex-1 py-2.5 bg-neutral-200 dark:bg-neutral-800 font-bold uppercase text-xs rounded-xl">Cancel [Esc]</button>
                <button type="button" onClick={handleAddCustomizedItemToCart} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-2.5 rounded-xl text-xs uppercase shadow">
                  Add [Enter]
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

   {/* POPUP: ITEM EDITOR MODAL */}
      <AnimatePresence>
        {isItemEditorModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-black text-sm uppercase text-orange-600">{editingItemObj ? 'Edit Food Item' : 'Add Food Item'}</h3>
                <button onClick={() => setIsItemEditorModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveItemToFirestore} className="space-y-3 text-xs">
                
                {/* Item Name */}
                <input type="text" required placeholder="Item Name *" value={itemNameInput} onChange={e => setItemNameInput(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none focus:border-orange-500" autoFocus />
                
                {/* Price & Code */}
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" required min={0} placeholder="Default Price (₹) *" value={itemPriceInput} onChange={e => setItemPriceInput(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-mono font-bold outline-none focus:border-orange-500" />
                  <input type="text" required placeholder="Short Code *" value={itemCodeInput} onChange={e => setItemCodeInput(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-mono font-bold outline-none focus:border-orange-500" />
                </div>

                {/* Category Dropdown */}
                <div className="flex gap-2 items-center">
                  {!isAddingNewCatInput ? (
                    <select value={itemCatInput} onChange={e => {
                      if (e.target.value === 'ADD_NEW') setIsAddingNewCatInput(true);
                      else setItemCatInput(e.target.value);
                    }} className="flex-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none focus:border-orange-500">
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="ADD_NEW" className="font-black text-orange-600">+ Add New Category</option>
                    </select>
                  ) : (
                    <div className="flex-1 flex gap-2">
                      <input type="text" placeholder="New Category Name..." value={newCustomCategoryName} onChange={e => setNewCustomCategoryName(e.target.value)} className="flex-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none focus:border-orange-500" autoFocus />
                      <button type="button" onClick={() => { setIsAddingNewCatInput(false); setNewCustomCategoryName(''); }} className="px-3 bg-red-500/10 text-red-600 rounded-xl font-bold hover:bg-red-500/20">Cancel</button>
                    </div>
                  )}
                </div>

                {/* Image URL & Availability */}
                <input type="text" placeholder="Image URL (Optional)" value={itemImageInput} onChange={e => setItemImageInput(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 outline-none focus:border-orange-500" />
                
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" id="availCheckbox" checked={itemIsAvailable} onChange={e => setItemIsAvailable(e.target.checked)} className="w-4 h-4 accent-orange-600 cursor-pointer" />
                  <label htmlFor="availCheckbox" className="font-bold cursor-pointer select-none">Item is Available (In Stock)</label>
                </div>

                {/* Variants / Portions (Forsan) Section */}
                <div className="pt-3 pb-1 border-t border-neutral-300 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-black uppercase text-orange-600">Variants / Portions (साइज़)</label>
                    <button type="button" onClick={() => setHasVariants(!hasVariants)} className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all shadow-sm ${hasVariants ? 'bg-orange-600 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                      {hasVariants ? 'Enabled ✓' : '+ Enable Variants'}
                    </button>
                  </div>

                  {hasVariants && (
                    <div className="space-y-3 bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => handleApplyVariantPreset('half_full')} className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px] font-bold hover:border-orange-500">Half/Full</button>
                        <button type="button" onClick={() => handleApplyVariantPreset('reg_large')} className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px] font-bold hover:border-orange-500">Reg/Large</button>
                        <button type="button" onClick={() => handleApplyVariantPreset('pizza')} className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px] font-bold hover:border-orange-500">Pizza Sizes</button>
                      </div>

                      {/* Current Variants List */}
                      {Object.keys(itemVariantsList).length > 0 && (
                        <div className="space-y-1.5">
                          {Object.entries(itemVariantsList).map(([vName, vPrice]) => (
                            <div key={vName} className="flex justify-between items-center bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
                              <span className="font-bold">{vName}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-orange-600 dark:text-orange-400 font-black">₹{String(vPrice)}</span>
                                <button type="button" onClick={() => handleRemoveVariantRow(vName)} className="text-red-500 hover:text-red-600 bg-red-500/10 p-1 rounded"><SafeTrash2 size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add New Custom Variant */}
                      <div className="flex gap-2 items-center pt-2">
                        <input type="text" placeholder="Name (e.g. Plate)" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 outline-none focus:border-orange-500" />
                        <input type="number" min={0} placeholder="Price (₹)" value={newVariantPrice} onChange={e => setNewVariantPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-20 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 font-mono outline-none focus:border-orange-500" />
                        <button type="button" onClick={handleAddVariantRow} className="bg-neutral-800 dark:bg-neutral-700 text-white px-3 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-neutral-900">Add</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsItemEditorModalOpen(false)} className="flex-1 py-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white font-black uppercase rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-700">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase rounded-xl shadow-lg">Save Item</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* POPUP: ADD / EDIT CUSTOMER PROFILE */}
      <AnimatePresence>
        {isAddEditCustModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="font-black text-sm uppercase text-orange-600 flex items-center gap-2">
                  <SafeUserPlus size={18} /> {editingCustProfile ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button onClick={() => setIsAddEditCustModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveCustomerProfile} className="space-y-3">
                
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-neutral-500">Customer Name *</label>
                   <input type="text" required placeholder="e.g. Rahul Kumar" value={custFormName} onChange={e => setCustFormName(e.target.value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none focus:border-orange-500 text-xs" autoFocus />
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-neutral-500">Phone Number (10 Digits) *</label>
                   <input type="tel" maxLength={10} required disabled={!!editingCustProfile} placeholder="e.g. 9876543210" value={custFormPhone} onChange={e => setCustFormPhone(e.target.value.replace(/\D/g, ''))} className={`w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-mono font-bold outline-none text-xs ${editingCustProfile ? 'opacity-60 cursor-not-allowed' : 'focus:border-orange-500'}`} />
                   {editingCustProfile && <p className="text-[9px] text-red-500 italic">फ़ोन नंबर एडिट नहीं किया जा सकता, क्योंकि यह प्राइमरी ID है।</p>}
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-neutral-500">Loyalty Points (Edit/Add)</label>
                   <input type="number" min={0} placeholder="e.g. 150" value={custFormPoints} onChange={e => setCustFormPoints(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-mono font-bold outline-none focus:border-orange-500 text-xs" />
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-neutral-500">Address (Optional)</label>
                   <textarea rows={2} placeholder="Full Delivery Address..." value={custFormAddress} onChange={e => setCustFormAddress(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none focus:border-orange-500 text-xs resize-none" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddEditCustModalOpen(false)} className="flex-1 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white font-black uppercase text-xs rounded-xl hover:bg-neutral-300 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs rounded-xl shadow-lg">Save Profile</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP: DRAWER EXPENSE [F6] */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-black text-sm uppercase text-red-600 flex items-center gap-2"><Receipt size={16} /> Drawer Expense [F6]</h3>
                <button onClick={() => setIsExpenseModalOpen(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
                <input type="text" required placeholder="Expense Title (e.g. Milk 5L)" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border rounded-xl p-2.5 font-bold outline-none" autoFocus />
                <input type="number" required min={1} placeholder="Amount (₹)" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-neutral-100 dark:bg-neutral-950 border rounded-xl p-2.5 font-mono text-sm outline-none font-bold" />
                <button type="submit" className="w-full py-2.5 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow">Save Expense</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
{/* POPUP: PARKED / HELD CARTS */}
      <AnimatePresence>
        {isHeldCartsModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-black text-sm uppercase text-amber-600 flex items-center gap-2">
                    <SafePauseCircle size={18} /> Parked Carts ({heldCarts.length})
                  </h3>
                  <p className="text-[10px] text-neutral-500">होल्ड किये गए कस्टमर के आर्डर रिस्टोर करें</p>
                </div>
                <button onClick={() => setIsHeldCartsModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                {heldCarts.length === 0 ? (
                  <div className="text-center py-10">
                     <p className="text-xs text-neutral-500 font-bold">कोई भी कार्ट होल्ड (Park) पर नहीं है।</p>
                  </div>
                ) : (
                  heldCarts.map(cartObj => (
                    <div key={cartObj.id} className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:border-amber-500 transition-colors">
                      <div>
                        <p className="font-bold text-sm text-neutral-900 dark:text-white">👤 {cartObj.customerName}</p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-1">
                          ⏰ {cartObj.heldAt} • 🛒 {cartObj.cart.length} Items • 🪑 {cartObj.tableNumber}
                        </p>
                        <p className="text-xs font-black text-green-600 dark:text-green-400 mt-1">
                          Total: ₹{cartObj.total}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRestoreHeldCart(cartObj)} 
                          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-md flex items-center gap-1"
                        >
                          <SafePlayCircle size={14} /> Restore
                        </button>
                        <button 
                          onClick={() => handleDeleteHeldCart(cartObj.id)} 
                          className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors"
                        >
                          <SafeTrash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* POPUP: CUSTOMER ORDER HISTORY */}
      <AnimatePresence>
        {isCustHistoryModalOpen && selectedHistoryCust && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-black text-sm uppercase text-blue-600 flex items-center gap-2">
                    <History size={18} /> Order History: {selectedHistoryCust.name}
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">📞 {selectedHistoryCust.phone || selectedHistoryCust.id} | ⭐ {selectedHistoryCust.points || 0} Points</p>
                </div>
                <button onClick={() => setIsCustHistoryModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                {isCustHistoryLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                ) : custHistoryList.length === 0 ? (
                  <div className="text-center py-10">
                     <p className="text-xs text-neutral-500 font-bold">इस ग्राहक का कोई पुराना बिल नहीं मिला।</p>
                  </div>
                ) : (
                  custHistoryList.map(order => {
                    const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp || Date.now());
                    return (
                      <div key={order.id} className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-3 rounded-2xl flex flex-col gap-2 shadow-sm hover:border-blue-500 transition-colors">
                        <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-2">
                          <div className="flex gap-2 items-center">
                            <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">Bill #{order.billNumber}</span>
                            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded uppercase">{order.fulfillmentType || 'pickup'}</span>
                          </div>
                          <span className="text-[10px] font-bold text-neutral-500">{orderDate.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium space-y-0.5">
                            {order.items?.map((it: any, i: number) => (
                              <p key={i}>• {it.name} <span className="font-bold text-orange-600 dark:text-orange-400">x{it.quantity}</span></p>
                            ))}
                          </div>
                          <div className="text-right">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded block mb-1 ${order.paymentMethod === 'upi' ? 'bg-blue-500/15 text-blue-600' : order.paymentMethod === 'due' ? 'bg-red-500/15 text-red-600' : 'bg-green-500/15 text-green-600'}`}>
                              {order.paymentMethod || 'cash'}
                            </span>
                            <span className="font-mono font-black text-green-600 dark:text-green-400 text-base">₹{order.total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* POPUP: CATEGORY MANAGER MODAL (REORDER CATS) */}
      <AnimatePresence>
        {isCatManagerModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="font-black text-sm uppercase text-orange-600 flex items-center gap-2">
                  <ArrowLeftRight size={18} /> Category Manager
                </h3>
                <button onClick={() => setIsCatManagerModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              {/* Reorder Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-neutral-500">Reorder Categories (Left / Right)</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-neutral-100 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  {categories.filter(c => c !== 'All' && c !== '⭐ Top Items').map((cat, idx, arr) => (
                    <div key={cat} className="flex items-center gap-1 bg-white dark:bg-neutral-800 p-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 shadow-sm">
                      <button onClick={() => handleMoveCategory(cat, 'left')} disabled={idx === 0} className="p-1 text-neutral-500 hover:text-orange-600 disabled:opacity-30"><SafeChevronLeft size={14} /></button>
                      <span className="text-xs font-bold px-1">{cat}</span>
                      <button onClick={() => handleMoveCategory(cat, 'right')} disabled={idx === arr.length - 1} className="p-1 text-neutral-500 hover:text-orange-600 disabled:opacity-30"><SafeChevronRight size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Merge Section */}
              <div className="space-y-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <p className="text-[10px] font-black uppercase text-neutral-500">Merge Categories (Combine Items)</p>
                <div className="flex flex-col gap-2">
                  <select value={mergeSourceCat} onChange={e => setMergeSourceCat(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none text-xs">
                    <option value="">Select Source Category (From)</option>
                    {categories.filter(c => c !== 'All' && c !== '⭐ Top Items').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex justify-center text-neutral-400"><ArrowLeftRight size={16} className="rotate-90" /></div>
                  <select value={mergeTargetCat} onChange={e => setMergeTargetCat(e.target.value)} className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl p-2.5 font-bold outline-none text-xs">
                    <option value="">Select Target Category (To)</option>
                    {categories.filter(c => c !== 'All' && c !== '⭐ Top Items').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={handleMergeCategories} className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs rounded-xl shadow-lg mt-1">
                    Merge Categories
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* CUSTOMER DIRECTORY MODAL [F11] */}
      <CustomerDirectoryModal 
        isCustomerModalOpen={isCustomerModalOpen} 
        setIsCustomerModalOpen={setIsCustomerModalOpen} 
        customerSearchQuery={customerSearchQuery} 
        setCustomerSearchQuery={setCustomerSearchQuery} 
        searchedCustomers={searchedCustomers} 
        isSearchingCustomer={isSearchingCustomer} 
        newCustName="" setNewCustName={() => {}} 
        newCustPhone="" setNewCustPhone={() => {}} 
        newCustAddress="" setNewCustAddress={() => {}} 
        editingCustomer={null} viewingHistoryCustomer={null} 
        customerHistoryList={[]} editCustPoints={0} 
        setEditCustPoints={() => {}} 
        handleSelectCustomer={(cust: any) => {
          setCustomerPhone(cust.phone); 
          setCustomerName(cust.name || ''); 
          setCustomerPoints(cust.points || 0); 
          setAddress(cust.address || '');
          setIsCustomerModalOpen(false);
          setTimeout(() => searchInputRef.current?.focus(), 60);
        }} 
        handleLoadCustomerHistory={() => {}} 
        handleStartEditProfile={() => {}} 
        handleUpdateCustomerProfile={() => {}} 
        handleSaveNewCustomer={() => {}} 
        setViewingHistoryCustomer={() => {}} 
        setCustomerHistoryList={() => {}} 
        setEditingCustomer={() => {}} 
       searchDbCustomers={() => {}} 
        triggerBeep={triggerBeep}
      />

      {/* 🎰 POPUP: GAME REWARD VERIFICATION MODAL */}
      <AnimatePresence>
        {isGameVerifyModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4">
              
              {/* हेडर */}
              <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-purple-500/10 text-purple-600 rounded-xl text-lg">🎰</span>
                  <div>
                    <h3 className="font-black text-sm uppercase text-purple-600 dark:text-purple-400">
                      गेम इनाम वेरिफिकेशन
                    </h3>
                    <p className="text-[10px] text-neutral-500 font-bold">ग्राहक का 10-अंकों का नंबर या BOM-XXXX कोड डालें</p>
                  </div>
                </div>
                <button onClick={() => setIsGameVerifyModalOpen(false)} className="text-neutral-500 hover:text-black dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* सर्च इनपुट */}
              <div className="flex gap-2">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="उदा. 9876543210 या BOM-4821" 
                  value={gameSearchInput}
                  onChange={e => setGameSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyGameCode(gameSearchInput)}
                  className="flex-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono uppercase" 
                />
                <button 
                  type="button" 
                  onClick={() => handleVerifyGameCode(gameSearchInput)}
                  disabled={isGameVerifying}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow"
                >
                  {isGameVerifying ? "..." : "जांचें"}
                </button>
              </div>

              {/* परिणाम कार्ड */}
              {gameVerifyResult && (
                <div className={`p-4 rounded-2xl border space-y-2.5 ${
                  gameVerifyResult.voucherClaimed 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                    : gameVerifyResult.lastPrizeWon === 'Better Luck'
                    ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300'
                    : 'bg-green-50 dark:bg-green-950/20 border-green-400 dark:border-green-700'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-sm text-neutral-900 dark:text-white uppercase flex items-center gap-1.5">
                        👤 {gameVerifyResult.name || 'ग्राहक'}
                        <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[9px] px-1.5 py-0.5 rounded font-black">
                          🎰 Game User
                        </span>
                      </p>
                      <p className="text-xs font-mono text-neutral-500 mt-0.5">📞 {gameVerifyResult.phone || gameVerifyResult.id}</p>
                      {gameVerifyResult.table && (
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">🪑 {gameVerifyResult.table}</p>
                      )}
                    </div>

                    {gameVerifyResult.voucherCode && (
                      <span className="font-mono font-black text-xs bg-white dark:bg-neutral-900 border px-2 py-1 rounded-lg text-blue-600 shadow-sm">
                        {gameVerifyResult.voucherCode}
                      </span>
                    )}
                  </div>

                  {/* जीता हुआ इनाम */}
                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-500">जीता हुआ इनाम:</span>
                    <span className={`text-sm font-black ${
                      gameVerifyResult.lastPrizeWon === 'Better Luck' ? 'text-neutral-500' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {gameVerifyResult.lastPrizeWon || 'कोई इनाम नहीं'}
                    </span>
                  </div>

                  <p className="text-[10px] text-neutral-400 italic">
                    खेला गया: {gameVerifyResult.minutesAgo === 0 ? 'अभी-अभी' : `${gameVerifyResult.minutesAgo} मिनट पहले`}
                  </p>

                  {/* एक्शन बटन */}
                  {gameVerifyResult.lastPrizeWon !== 'Better Luck' && (
                    <div className="pt-2">
                      {gameVerifyResult.voucherClaimed ? (
                        <div className="w-full py-2 bg-red-500/10 text-red-600 border border-red-500/20 text-center rounded-xl text-xs font-black uppercase">
                          🚫 यह इनाम पहले ही दिया जा चुका है!
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={handleClaimGameReward}
                          disabled={isClaimingReward}
                          className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all"
                        >
                          {isClaimingReward ? "अपडेट हो रहा है..." : "✓ इनाम दिया (Mark as Claimed)"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
