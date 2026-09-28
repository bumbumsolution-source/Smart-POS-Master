

'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase'; 
import { collection, onSnapshot, query, addDoc, doc, setDoc, increment, runTransaction, getDoc, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage'; 
import { ShoppingBag, Plus, Search, X, MapPin, Phone, User, Sparkles, Star, Gift, Loader2, Heart, Clock, ChevronRight, WifiOff, History, LogOut, Lock, Award, Play, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useCartStore } from '../store/useCartStore';

import { useRouter } from 'next/navigation';

// सब-कंपोनेंट्स इम्पोर्ट्स
import CategorySlider from '../components/home/CategorySlider';
import DiyPizzaBuilder from '../components/home/DiyPizzaBuilder';
import CartDrawer from '../components/home/CartDrawer';
import UpiPaymentModal from '../components/home/UpiPaymentModal';
import LiveOrderTracker from '../components/home/LiveOrderTracker';

const FALLBACK_CATEGORIES = ["All", "Special Pizza", "Special Thali", "Paneer Special", "Special Mix veg", "Fast Food", "Super Cool", "Indian Bread", "Special Rice"];

const CATEGORY_IMAGES: { [key: string]: string } = {
  "All": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80",
  "Special Pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80",
  "Special Thali": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=150&q=80",
  "Paneer Special": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=150&q=80",
  "Special Mix veg": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80",
  "Fast Food": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80",
  "Super Cool": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=150&q=80",
  "Indian Bread": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=150&q=80",
  "Special Rice": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=150&q=80"
};

const DELIVERY_AREAS = [
  { name: "Mohandra Town", fee: 20, minFree: 99, range: "0-2 KM" },
  { name: "Within 5 KM (Bum Bum Cafe से 5km के दायरे में)", fee: 50, minFree: 499, range: "2-5 KM" },
  { name: "Within 12 KM (12km के दायरे में)", fee: 99, minFree: 999, range: "5-12 KM" }
];

const HINGLISH_DICT: { [key: string]: string } = {
  "piza": "pizza", "pizaa": "pizza", "panir": "paneer", "tali": "thali", "thaly": "thali",
  "fastfud": "fast food", "rice": "rice", "bread": "bread", "veg": "veg", "chiz": "cheese"
};

const PIZZA_ADDONS: { [size: string]: { [addon: string]: number } } = {
  "small": { "Veg Add-on": 10, "Paneer": 20, "Black Olives": 20, "Jalapeno": 20, "Extra Cheese": 20, "Mushroom": 20 },
  "medium": { "Veg Add-on": 10, "Paneer": 30, "Black Olives": 30, "Jalapeno": 30, "Extra Cheese": 30, "Mushroom": 30 },
  "large": { "Veg Add-on": 20, "Paneer": 40, "Black Olives": 40, "Jalapeno": 40, "Extra Cheese": 40, "Mushroom": 40 },
  "extra large": { "Veg Add-on": 30, "Paneer": 50, "Black Olives": 50, "Jalapeno": 50, "Extra Cheese": 60, "Mushroom": 50 }
};

const DIY_PIZZA_PRICES: Record<string, any> = {
  small: {
    base: 15, sauce: 10, mozzarella: 40,
    veggies: { onion: 10, tomato: 10, capsicum: 10, corn: 10 },
    black_olive: 20, jalapeno: 20, red_peprica: 20, paneer: 30, mushroom: 30
  },
  medium: {
    base: 20, sauce: 15, mozzarella: 60,
    veggies: { onion: 15, tomato: 15, capsicum: 15, corn: 15 },
    black_olive: 30, jalapeno: 30, red_peprica: 30, paneer: 40, mushroom: 40
  },
  large: {
    base: 30, sauce: 30, mozzarella: 100,
    veggies: { onion: 20, tomato: 20, capsicum: 20, corn: 20 },
    black_olive: 50, jalapeno: 50, red_peprica: 40, paneer: 50, mushroom: 50
  }
};

const QUICK_INSTRUCTION_TAGS = ["🌶️ Extra Spicy", "🧅 No Onion-Garlic", "🧀 Extra Cheese", "🔥 Well Baked", "🌱 Make it Mild"];

const SOCIAL_LINKS = [
  { id: 'facebook', label: '🔵 Facebook', icon: '/facebook.png', points: 1, url: 'https://www.facebook.com/bbcafe.in/' },
  { id: 'instagram', label: '📸 Instagram', icon: '/instagram.png', points: 1, url: 'https://www.instagram.com/bbcafe.in/' },
  { id: 'whatsapp_channel', label: '📢 WhatsApp Channel', icon: '/whatsapp.png', points: 1, url: 'https://whatsapp.com/channel/0029VaLhggoGE56natoQI43y' },
  { id: 'snapchat', label: '👻 Snapchat', icon: '/snapchat.png', points: 1, url: 'https://www.snapchat.com/add/bbcafe.in' },
  { id: 'youtube', label: '🔴 YouTube', icon: '/youtube.png', points: 1, url: 'https://www.youtube.com/@bbcafe.i' }
];

export default function BbCafeHome() {
  const store = useCartStore() as any;
  const cart = store?.items || [];
  const addItem = store?.addItem || (() => {});
  const removeItem = store?.removeItem || (() => {});
  const clearCart = store?.clearCart || (() => {});

  const menuRef = useRef<HTMLDivElement | null>(null);
  
  const router = useRouter();

  // --- STATE VARIABLES ---
  const [menu, setMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [isBannerEnabled, setIsBannerEnabled] = useState(true); 
  const [isInlineBannerEnabled, setIsInlineBannerEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // लाइव लोकेलिटी कोऑर्डिनेट्स स्टोर करने के लिए स्टेट
  const [customerCoordinates, setCustomerCoordinates] = useState<{ lat: number, lng: number } | null>(null);

  const [whatsappNumber, setWhatsappNumber] = useState("919714293759");
  
  // कैफ़े की मुख्य UPI ID
  const [upiId, setUpiId] = useState("Q231198993@ybl");
  
  const [storeCoordinates, setStoreCoordinates] = useState({ lat: 24.2863, lng: 80.1245 });

  const [storeTimingHindi, setStoreTimingHindi] = useState("सुबह 10:00 से रात 11:00 बजे");
  const [storeTimingEnglish, setStoreTimingEnglish] = useState("10:00 AM to 11:00 PM");

  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const [liveOrder, setLiveOrder] = useState<any | null>(null);
  const [closingMinutesLeft, setClosingMinutesLeft] = useState<number | null>(null);

  // History Ledger Tracker Collapse States
  const [dismissedHistoryOrders, setDismissedHistoryOrders] = useState<number[]>([]);

  const [customerDetails, setCustomerDetails] = useState<{ name: string, phone: string, refCode?: string, pin?: string } | null>(null);
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempPin, setTempPin] = useState(""); 
  const [tempRefCode, setTempRefCode] = useState(""); 
  const [address, setAddress] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null); 

  // Fulfillment and payment
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup" | "table">("delivery");
  const [tableNumber, setTableNumber] = useState("Table 1"); 
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi">("cod");

  const [isHindi, setIsHindi] = useState(false);
  const [customerPoints, setCustomerPoints] = useState<number>(0);

  const [socialCounts, setSocialCounts] = useState<any>({
    facebook: "500+ Followers",
    instagram: "1.2K+ Followers",
    whatsapp_channel: "1K+ Channel Members",
    snapchat: "200+ Subs",
    youtube: "1.5K+ Subs"
  });
  
  const [loyaltyRules, setLoyaltyRules] = useState<any[]>([]);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftPhone, setGiftPhone] = useState("");
  const [giftPointsAmount, setGiftPointsAmount] = useState<number | "">("");
  const [giftSenderPin, setGiftSenderPin] = useState(""); 
  const [isGiftingLoading, setIsGiftingLoading] = useState(false);

  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerError, setBannerError] = useState(false);
  
  const [enteredCoupon, setEnteredCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  // Normal Pizza Customization Addons
  const [normalPizzaSize, setNormalPizzaSize] = useState("");
  const [normalPizzaPrice, setNormalPizzaPrice] = useState(0);
  const [normalPizzaAddons, setNormalPizzaAddons] = useState<{ [addon: string]: boolean }>({});
  const [chefNote, setChefNote] = useState(""); 

  // DIY PIZZA STATES
  const [diySize, setDiySize] = useState<string>("small"); 
  const [diySauce, setDiySauce] = useState<boolean>(true); 
  const [diyMozzarella, setDiyMozzarella] = useState<boolean>(true); 
  const [diyVegSelection, setDiyVegSelection] = useState<{ [veg: string]: boolean }>({ onion: false, tomato: false, capsicum: false, corn: false });
  const [diyPremiumToppings, setDiyPremiumToppings] = useState<{ [top: string]: boolean }>({ black_olive: false, jalapeno: false, red_peprica: false, paneer: false, mushroom: false });
  const [diyChefNote, setDiyChefNote] = useState<string>("");

  // Reels/Stories States
  const [stories, setStories] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<any | null>(null);

  // Social Proof Alerts States
  const [socialProofs, setSocialProofs] = useState<any[]>([]);
  const [socialAlertIndex, setSocialAlertIndex] = useState(0);
  const [showSocialAlert, setShowSocialAlert] = useState(false);

  // Social Media Point Claims States
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimingPlatform, setClaimingPlatform] = useState<any>(null);
  const [claimUsername, setClaimUsername] = useState("");
  const [isClaimingLoading, setIsClaimingLoading] = useState(false);

  // Cart Specific Add-ons
  const [ketchupAddon, setKetchupAddon] = useState(false);
  const [oreganoAddon, setOreganoAddon] = useState(false);
  const [chiliFlakesAddon, setChiliFlakesAddon] = useState(false);

  const [noCutlery, setNoCutlery] = useState(false);
  const [selectedArea, setSelectedArea] = useState(DELIVERY_AREAS[0]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [, setLastPlacedOrder] = useState<any>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [shareCount, setShareCount] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // UPI Payment states
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUpiPopupOpen, setIsUpiPopupOpen] = useState(false);

  // UI States
  const [showGreeting, setShowGreeting] = useState(true);

  // --- HELPERS, CALCULATIONS & GENERAL UTILS ---

  const triggerHaptic = (ms = 35) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(ms);
    }
  };

  const playSoundEffect = (type: 'add' | 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'add') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);
        osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch (e) {}
  };

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.includes('/video') || cleanUrl.includes('video');
  };

  const formatBillNumber = (num: number) => String(num).padStart(4, '0');

  const calculateDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getCartSubtotal = () => cart.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);

  const getCartAddonsPrice = () => {
    let total = 0;
    if (ketchupAddon) total += 10;
    if (oreganoAddon) total += 10;
    if (chiliFlakesAddon) total += 10;
    return total;
  };

  const getDeliveryCharge = () => {
    if (fulfillmentType === "pickup" || fulfillmentType === "table") return 0;
    const baseSub = getCartSubtotal();
    if (baseSub === 0) return 0;
    return baseSub >= selectedArea.minFree ? 0 : selectedArea.fee;
  };

  const getCouponDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = getCartSubtotal();
    const val = appliedCoupon.discountValue;
    const type = appliedCoupon.type || appliedCoupon.discountType;

    let discountAmount = 0;
    if (typeof val === 'string' && val.includes('%')) {
      const percent = parseFloat(val);
      discountAmount = !isNaN(percent) ? (subtotal * percent) / 100 : 0;
    } else if (type === 'percentage' || type === 'percent') {
      discountAmount = (subtotal * (Number(val) || 0)) / 100;
    } else {
      discountAmount = Number(val) || 0;
    }

    return Math.min(Math.max(0, discountAmount), subtotal);
  };

  const getTotalBillPrice = () => {
    const subtotal = getCartSubtotal();
    const addPrice = getCartAddonsPrice();
    const delivery = getDeliveryCharge();
    const couponDiscount = getCouponDiscountAmount();
    return Math.max(0, subtotal + addPrice - couponDiscount) + delivery;
  };

  const getFreeDeliveryProgressPercent = () => {
    const subtotal = getCartSubtotal();
    const limit = selectedArea.minFree;
    if (subtotal >= limit) return 100;
    return (subtotal / limit) * 100;
  };

  const getCustomerTier = (points: number) => {
    if (points >= 50) return { name: "Platinum Member 👑", color: "text-cyan-705 border-cyan-500/40 bg-cyan-100/50 dark:text-cyan-400 dark:border-cyan-400/30 dark:bg-cyan-400/10" };
    if (points >= 20) return { name: "Gold Member 🌟", color: "text-yellow-800 border-yellow-500/40 bg-yellow-100/50 dark:text-yellow-400 dark:border-yellow-400/30 dark:bg-yellow-400/10" };
    return { name: "Bronze Member 🥉", color: "text-orange-700 border-orange-500/40 bg-orange-100/50 dark:text-orange-400 dark:border-orange-400/30 dark:bg-orange-400/10" };
  };

  const getDisplayPrice = (item: any) => {
    if (item?.variants && typeof item.variants === 'object') {
      const prices = Object.values(item.variants).map(Number).filter(n => !isNaN(n));
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        return minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`;
      }
    }
    return `₹${item?.price || 0}`;
  };

  const getCategoryImage = (catName: string) => {
    const found = dbCategories.find(c => String(c.name).toLowerCase().trim() === String(catName).toLowerCase().trim());
    if (found) {
      return found.image || found.imageUrl || found.coverUrl || found.cover || found.url || CATEGORY_IMAGES[catName] || CATEGORY_IMAGES[found.name] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80";
    }
    return CATEGORY_IMAGES[catName] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80";
  };

  const getReferralCode = () => {
    if (!customerDetails) return "WELCOME";
    const namePart = customerDetails.name.trim().split(" ")[0].substring(0, 4).toUpperCase();
    const phonePart = customerDetails.phone.slice(-4);
    return `${namePart}${phonePart}`;
  };

  // --- CALCULATION MEMOS ---

  const ecoCutlerySaves = useMemo(() => {
    return pastOrders.filter(o => o.noCutlery === true).length;
  }, [pastOrders]);

  const calculatedDiyPizzaPrice = useMemo(() => {
    const config = DIY_PIZZA_PRICES[diySize];
    if (!config) return 0;
    let total = config.base;
    if (diySauce) total += config.sauce;
    if (diyMozzarella) total += config.mozzarella;

    Object.entries(diyVegSelection).forEach(([veg, isSelected]) => {
      if (isSelected) {
        total += config.veggies[veg] || 0;
      }
    });

    Object.entries(diyPremiumToppings).forEach(([top, isSelected]) => {
      if (isSelected) {
        total += config[top] || 0;
      }
    });

    return total;
  }, [diySize, diySauce, diyMozzarella, diyVegSelection, diyPremiumToppings]);

  const greetingText = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    
    let timeGreeting = "Namaste";
    if (hours >= 5 && hours < 12) {
      timeGreeting = "Good Morning ☀️";
    } else if (hours >= 12 && hours < 17) {
      timeGreeting = "Good Afternoon 🌤️";
    } else if (hours >= 17 && hours < 22) {
      timeGreeting = "Good Evening 🌆";
    } else {
      timeGreeting = "Good Night 🌙";
    }

    const customerName = customerDetails?.name ? customerDetails.name : "";
    if (customerName) {
      return `Namaste ${customerName} ji, ${timeGreeting}! What can Bum Bum Cafe make for you today? 😊`;
    } else {
      return `Namaste, ${timeGreeting}! What can Bum Bum Cafe make for you today? 😊`;
    }
  }, [customerDetails]);

  const deduplicatedMenu = useMemo(() => {
    const seen = new Set();
    const hiddenCategoryNames = new Set(dbCategories.filter((c: any) => c.isVisible === false).map((c: any) => String(c.name).toLowerCase().trim()));

    return menu.filter(item => {
      const itemCatClean = item?.category ? String(item.category).toLowerCase().trim() : "";
      if (hiddenCategoryNames.has(itemCatClean)) return false;
      const idKey = String(item.id).trim();
      if (seen.has(idKey)) return false;
      seen.add(idKey);
      return true;
    });
  }, [menu, dbCategories]);

  const filteredMenu = useMemo(() => {
    const searchWords = debouncedSearchQuery.split(/\s+/).filter(Boolean);

    return deduplicatedMenu.filter(item => {
      const itemName = item?.name ? String(item.name).toLowerCase() : "";
      const itemCategory = item?.category ? String(item.category) : "";
      
      const isFavoriteFilter = selectedCategory === "Favorites";
      const itemCatClean = itemCategory.toLowerCase().trim();
      const selectedCatClean = selectedCategory.toLowerCase().trim();
      
      const matchesCategory = isFavoriteFilter 
        ? favorites.includes(item.id) 
        : (selectedCatClean === "all" || itemCatClean === selectedCatClean);
        
      const matchesSearch = searchWords.every(word => itemName.includes(word));
      return matchesCategory && matchesSearch;
    });
  }, [deduplicatedMenu, selectedCategory, favorites, debouncedSearchQuery]);

  const visibleCategories = useMemo(() => {
    const dbCatsMap = new Map();
    dbCategories.forEach(c => {
      if (c && c.name) {
        dbCatsMap.set(String(c.name).toLowerCase().trim(), c);
      }
    });

    const result: string[] = [];

    FALLBACK_CATEGORIES.forEach(catName => {
      const cleanName = catName.toLowerCase().trim();
      if (dbCatsMap.has(cleanName)) {
        const dbCat = dbCatsMap.get(cleanName);
        if (dbCat.isVisible !== false) {
          result.push(catName);
        }
      } else {
        result.push(catName);
      }
    });

    dbCategories.forEach(c => {
      if (c && c.name && c.isVisible !== false) {
        const cleanName = String(c.name).toLowerCase().trim();
        const isFallback = FALLBACK_CATEGORIES.some(f => f.toLowerCase().trim() === cleanName);
        if (!isFallback && cleanName !== "all" && cleanName !== "diy pizza") {
          result.push(c.name);
        }
      }
    });

    const listWithoutSpecial = result.filter(c => c !== "All" && c !== "DIY Pizza");
    const finalized = ["All", "DIY Pizza", ...listWithoutSpecial];

    return Array.from(new Set(finalized));
  }, [dbCategories]);

  const upsellSuggestionItems = useMemo(() => {
    return menu.filter(item => {
      const isShake = item?.category === "Super Cool" || item?.category === "Fast Food";
      const notInCart = !cart.some((c: any) => c.id === item.id);
      return isShake && notInCart;
    }).slice(0, 2);
  }, [menu, cart]);

  const lastDeliveryAddress = useMemo(() => {
    const found = pastOrders.find(o => o.fulfillmentType === "delivery" && o.address);
    return found ? found.address : "";
  }, [pastOrders]);

  // --- Dynamic add-ons display verification based on eligible dishes ---
  const showAddonsSection = useMemo(() => {
    const eligibleKeywords = ['pizza', 'sandwich', 'burger', 'momo', 'fries', 'chips', 'finger'];
    return cart.some((item: any) => {
      const nameLower = (item.name || '').toLowerCase();
      return eligibleKeywords.some(keyword => nameLower.includes(keyword));
    });
  }, [cart]);

  const handleLaunchUpiPay = (platform: string) => {
    triggerHaptic();
    const amount = getTotalBillPrice();
    const merchantName = "Bum Bum Cafe";
    const transactionNote = `BumBumCafe Order`;
    
    try {
      navigator.clipboard.writeText(upiId);
      toast.success(isHindi 
        ? `यूपीआई आईडी (${upiId}) कॉपी हो गई है! पेमेंट ऐप में इसे पेस्ट कर सकते हैं।` 
        : `UPI ID (${upiId}) copied! You can paste it in your payment app if redirection fails.`
      );
    } catch (err) {}
    
    const standardUpi = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    if (platform === 'phonepe') {
      window.location.href = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    } else if (platform === 'paytm') {
      window.location.href = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    } else if (platform === 'gpay') {
      window.location.href = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    } else {
      window.location.href = standardUpi;
    }
  };

  // --- EVENT HANDLERS ---

  const scrollToMenu = () => {
    triggerHaptic();
    menuRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const quickAppendInstruction = (tag: string, type: "diy" | "normal") => {
    triggerHaptic(20);
    if (type === "diy") {
      setDiyChefNote(prev => prev ? `${prev}, ${tag}` : tag);
    } else {
      setChefNote(prev => prev ? `${prev}, ${tag}` : tag);
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('bb_favorites', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (!tempName || !tempPhone || tempPhone.length !== 10 || !tempPin || tempPin.length !== 4) {
      toast.error(isHindi ? "कृपया सभी सही विवरण दर्ज करें!" : "Please enter correct details!");
      return;
    }
    const phoneClean = tempPhone.trim();
    const formattedPhone = `+91${phoneClean}`;
    
    const customerObj = {
      name: tempName.trim(),
      phone: formattedPhone,
      pin: tempPin,
      refCode: tempRefCode.trim() || undefined
    };
    
    const toastId = toast.loading(isHindi ? "प्रोफाइल सहेज रहा है..." : "Saving profile...");
    try {
      const userDocRef = doc(db, "customer_points", phoneClean);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        await setDoc(userDocRef, {
          name: customerObj.name,
          phone: phoneClean,
          pin: customerObj.pin,
          points: tempRefCode ? 5 : 0, 
          lastActive: new Date()
        });
      } else {
        await setDoc(userDocRef, {
          name: customerObj.name,
          pin: customerObj.pin,
          lastActive: new Date()
        }, { merge: true });
      }
      
      localStorage.setItem('bb_cafe_customer', JSON.stringify(customerObj));
      setCustomerDetails(customerObj);
      setIsProfileOpen(false);
      toast.dismiss(toastId);
      toast.success(isHindi ? "प्रोफ़ाइल सफलतापूर्वक सहेजी गई!" : "Profile saved successfully!");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(isHindi ? "प्रोफाइल सहेजने में त्रुटि आई!" : "Error saving profile!");
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (!customerDetails?.phone) {
      toast.error(isHindi ? "कृपया पहले अपनी प्रोफाइल कस्टमाइज़ करें!" : "Please set up your profile first!");
      return;
    }
    if (!claimUsername) {
      toast.error(isHindi ? "यूज़रनेम दर्ज करें!" : "Please enter username!");
      return;
    }
    setIsClaimingLoading(true);
    try {
      await addDoc(collection(db, "point_claims"), {
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        platform: claimingPlatform.id,
        username: claimUsername,
        pointsToEarn: claimingPlatform.points,
        status: 'pending',
        timestamp: new Date()
      });
      toast.success(isHindi ? "दावा सबमिट किया गया! वेरिफिकेशन के बाद पॉइंट्स मिलेंगे।" : "Claim request submitted! Points will be added after verification.");
      setClaimUsername("");
      setIsClaimModalOpen(false);
    } catch (err) {
      toast.error("Claim failed. Try again.");
    } finally {
      setIsClaimingLoading(false);
    }
  };

  const handleDismissInstallBanner = () => {
    triggerHaptic();
    setShowInstallBanner(false);
    localStorage.setItem('bb_app_installed_or_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    triggerHaptic();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('bb_app_installed_or_dismissed', 'true');
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const handleApplyCoupon = async () => {
    triggerHaptic();
    if (!enteredCoupon.trim()) {
      toast.error(isHindi ? "कृपया कूपन कोड दर्ज करें!" : "Please enter a coupon code!");
      return;
    }
    const codeUpper = enteredCoupon.trim().toUpperCase();
    const toastId = toast.loading(isHindi ? "कूपन जाँचा जा रहा है..." : "Validating coupon...");
    try {
      const couponRef = doc(db, "coupons", codeUpper);
      const couponSnap = await getDoc(couponRef);
      if (couponSnap.exists()) {
        const data = couponSnap.data();
        const subtotal = getCartSubtotal();
        if (subtotal < (data.minOrder || 0)) {
          toast.dismiss(toastId);
          toast.error(isHindi ? `न्यूनतम ऑर्डर राशि ₹${data.minOrder} होनी चाहिए!` : `Minimum order must be ₹${data.minOrder}!`);
          return;
        }
        
        setAppliedCoupon({
          code: codeUpper,
          discountValue: data.discount !== undefined ? data.discount : (data.discountValue !== undefined ? data.discountValue : 0),
          type: data.type || data.discountType || 'flat'
        });
        toast.dismiss(toastId);
        toast.success(isHindi ? "कूपन सफलतापूर्वक लागू किया गया!" : "Coupon applied successfully!");
      } else {
        toast.dismiss(toastId);
        toast.error(isHindi ? "अमान्य कूपन कोड! यह कूपन मौजूद नहीं है।" : "Invalid coupon code! This coupon does not exist.");
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(isHindi ? "कूपन जांचने में समस्या आई!" : "Error applying coupon!");
    }
  };

  const handleCheckoutClick = () => {
    triggerHaptic();
    if (!customerDetails) {
      setIsProfileOpen(true);
      toast.error(isHindi ? "कृपया पहले अपनी प्रोफाइल कस्टमाइज़ करें!" : "Please set up your profile first!");
      return;
    }
    if (paymentMethod === "upi") {
      setIsUpiPopupOpen(true);
    } else {
      sendWhatsAppOrder();
    }
  };

  const handleGiftPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    
    if (!customerDetails?.phone) {
      toast.error(isHindi ? "कृपया पहले अपनी प्रोफाइल कस्टमाइज़ करें!" : "Please set up your profile first!");
      return;
    }
    
    const senderPhoneClean = customerDetails.phone.replace("+91", "").trim();
    const receiverPhoneClean = giftPhone.trim();
    const pointsToGift = Number(giftPointsAmount);

    if (!receiverPhoneClean || receiverPhoneClean.length !== 10) {
      toast.error(isHindi ? "गिफ्ट प्राप्तकर्ता का नंबर 10 अंकों का होना चाहिए!" : "Friend's number must be 10 digits!");
      return;
    }
    if (senderPhoneClean === receiverPhoneClean) {
      toast.error(isHindi ? "आप स्वयं को पॉइंट्स गिफ्ट नहीं कर सकते!" : "You cannot gift points to yourself!");
      return;
    }
    if (isNaN(pointsToGift) || pointsToGift <= 0) {
      toast.error(isHindi ? "कृपया सही पॉइंट्स संख्या दर्ज करें!" : "Please enter a valid amount of points!");
      return;
    }
    if (customerPoints < pointsToGift) {
      toast.error(isHindi ? "आपके पास पर्याप्त पॉइंट्स उपलब्ध नहीं हैं!" : "You do not have enough points!");
      return;
    }
    if (giftSenderPin !== customerDetails.pin) {
      toast.error(isHindi ? "सुरक्षा पिन गलत है!" : "Invalid security PIN!");
      return;
    }

    setIsGiftingLoading(true);
    const toastId = toast.loading(isHindi ? "पॉइंट्स ट्रांसफर किए जा रहे हैं..." : "Transferring points...");

    try {
      const receiverDocRef = doc(db, "customer_points", receiverPhoneClean);
      const receiverSnap = await getDoc(receiverDocRef);

      if (!receiverSnap.exists()) {
        toast.dismiss(toastId);
        toast.error(isHindi ? "गिफ्ट पाने वाले का नंबर पंजीकृत नहीं है!" : "The receiver's number is not registered!");
        setIsGiftingLoading(false);
        return;
      }

      const senderDocRef = doc(db, "customer_points", senderPhoneClean);

      await runTransaction(db, async (transaction) => {
        const senderSnap = await transaction.get(senderDocRef);
        if (!senderSnap.exists()) throw new Error("Sender records not found.");
        
        const currentSenderPoints = senderSnap.data().points || 0;
        if (currentSenderPoints < pointsToGift) throw new Error("Insufficient points balance.");

        transaction.update(senderDocRef, { points: increment(-pointsToGift) });
        transaction.update(receiverDocRef, { points: increment(pointsToGift) });
      });

      await addDoc(collection(db, "customer_points", senderPhoneClean, "history"), {
        type: 'redeem',
        points: pointsToGift,
        description: `Gifted points to ${receiverPhoneClean} 🎁`,
        timestamp: new Date()
      });

      await addDoc(collection(db, "customer_points", receiverPhoneClean, "history"), {
        type: 'earn',
        points: pointsToGift,
        description: `Received points from ${senderPhoneClean} 🎁`,
        timestamp: new Date()
      });

      setCustomerPoints(prev => prev - pointsToGift);
      toast.dismiss(toastId);
      toast.success(isHindi ? "पॉइंट्स गिफ्ट कर दिए गए!" : "Points gifted successfully!");
      
      setIsGiftModalOpen(false);
      setGiftPhone("");
      setGiftPointsAmount("");
      setGiftSenderPin("");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(isHindi ? `स्थानांतरण विफल: ${err.message}` : `Transfer failed: ${err.message}`);
    } finally {
      setIsGiftingLoading(false);
    }
  };

  const sendWhatsAppOrder = async () => {
    triggerHaptic();
    
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    try {
      if (!customerDetails) { 
        setIsProfileOpen(true); 
        toast.error("ऑर्डर करने के लिए पहले अपनी प्रोफाइल बनाएं! 👤");
        return; 
      }

      if (fulfillmentType === "delivery" && (!address || address.trim().length < 10)) {
        return toast.error("Please enter full address!");
      }

      if (fulfillmentType === "table" && !tableNumber) {
        return toast.error(isHindi ? "कृपया टेबल चुनें!" : "Please select a table!");
      }

      if (paymentMethod === "upi" && !paymentScreenshot) {
        return toast.error(isHindi ? "कृपया आगे बढ़ने से पहले यूपीआई भुगतान का स्क्रीनशॉट अपलोड करें!" : "Please upload UPI payment screenshot!");
      }

      const tokenNumber = Math.floor(1000 + Math.random() * 9000);
      const deliveryPin = Math.floor(1000 + Math.random() * 9000);

      let billNumber = 1;
      const counterDocRef = doc(db, "settings", "store_bill_counter");

      try {
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterDocRef);
          if (!counterDoc.exists()) {
            transaction.set(counterDocRef, { nextBillNumber: 2 });
            billNumber = 1;
          } else {
            billNumber = counterDoc.data().nextBillNumber || 1;
            transaction.update(counterDocRef, { nextBillNumber: billNumber + 1 });
          }
        });
      } catch (e) { 
        billNumber = Math.floor((Date.now() / 1000) % 100000); 
      }

      const formattedBillStr = formatBillNumber(billNumber);
      const subtotal = getCartSubtotal();
      const addOnsCost = getCartAddonsPrice();
      const deliveryCharge = getDeliveryCharge();
      const couponDiscount = getCouponDiscountAmount();
      const finalTotal = getTotalBillPrice();
      
      const pointsEarned = Math.floor(finalTotal / 100);
      const totalPointsCost = cart.reduce((acc: number, i: any) => acc + (i.pointsCost || 0), 0);

      let screenshotUrl = "";
      if (paymentMethod === "upi" && paymentScreenshot) {
        const toastId = toast.loading(isHindi ? "स्क्रीनशॉट अपलोड हो रहा है..." : "Uploading screenshot...");
        try {
          const storage = getStorage();
          const storageRef = ref(storage, `payment_screenshots/bill_${formattedBillStr}_${Date.now()}.jpg`);
          
          const uploadPromise = uploadString(storageRef, paymentScreenshot, 'data_url').then(async (uploadResult) => {
            return await getDownloadURL(uploadResult.ref);
          });
          
          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 3500)
          );

          screenshotUrl = await Promise.race([uploadPromise, timeoutPromise]);
          toast.dismiss(toastId);
        } catch (err) {
          console.warn("Storage upload bypassed (Proceeding with local base64):", err);
          toast.dismiss(toastId);
        }
      }

      const orderObj = {
        billNumber, 
        tokenNumber, 
        deliveryPin, 
        customerName: customerDetails.name, 
        customerPhone: customerDetails.phone,
        address: fulfillmentType === "delivery" ? address : `Mode: ${fulfillmentType.toUpperCase()} ${fulfillmentType === 'table' ? `Table: ${tableNumber}` : ''}`, 
        
        // --- LATITUDE AND LONGITUDE GPS FIELDS ADDED TO FIRESTORE OBJECT ---
        latitude: customerCoordinates?.lat || null,
        longitude: customerCoordinates?.lng || null,

        items: cart, 
        subtotal, 
        discount: couponDiscount, 
        total: finalTotal, 
        timestamp: new Date(), 
        status: 'pending',
        deliveryArea: fulfillmentType === "delivery" ? selectedArea.name : fulfillmentType.toUpperCase(), 
        noCutlery, 
        ketchupAddon, 
        oreganoAddon, 
        chiliFlakesAddon,
        fulfillmentType, 
        tableNumber: fulfillmentType === "table" ? tableNumber : "", 
        paymentMethod,
        paymentScreenshot: paymentScreenshot || "",
        screenshotUrl: screenshotUrl || ""
      };

      await addDoc(collection(db, "orders"), orderObj);
      const phoneClean = customerDetails.phone.replace("+91", "");
      if (pointsEarned > 0 || totalPointsCost > 0) {
        await setDoc(doc(db, "customer_points", phoneClean), {
          name: customerDetails.name, phone: phoneClean, points: increment(pointsEarned - totalPointsCost), lastActive: new Date()
        }, { merge: true });

        if (pointsEarned > 0) {
          await addDoc(collection(db, "customer_points", phoneClean, "history"), {
            type: 'earn',
            points: pointsEarned,
            description: `Ordered Bill #${formattedBillStr} 🍕`,
            timestamp: new Date()
          });
        }
        if (totalPointsCost > 0) {
          await addDoc(collection(db, "customer_points", phoneClean, "history"), {
            type: 'redeem',
            points: totalPointsCost,
            description: `Redeemed rewards on Bill #${formattedBillStr} 🎁`,
            timestamp: new Date()
          });
        }
      }

      const updatedPastOrders = [orderObj, ...pastOrders];
      setPastOrders(updatedPastOrders);
      localStorage.setItem('bb_past_orders', JSON.stringify(updatedPastOrders));
      setLastPlacedOrder(orderObj);

      let itemsText = "";
      cart.forEach((i: any) => {
        itemsText += `• ${i.name || "Item"} x${i.quantity || 1} - ₹${(i.price || 0) * (i.quantity || 1)}\n`;
        if (i.note) {
          itemsText += `  └─ *Note:* ${i.note}\n`;
        }
      });
      
      if (ketchupAddon) itemsText += `• Extra Tomato Ketchup x1 - ₹10\n`;
      if (oreganoAddon) itemsText += `• Extra Oregano x1 - ₹10\n`;
      if (chiliFlakesAddon) itemsText += `• Extra Chili Flakes x1 - ₹10\n`;
      if (noCutlery) itemsText += `🌱 (Eco-Friendly: No plastic cutlery requested)\n`;

      const refCode = getReferralCode();
      
      const modeLabel = fulfillmentType === "delivery" ? `Delivery (${selectedArea.name})` : fulfillmentType === "pickup" ? "Self-Pickup 🛍️" : `Dine-In (Table: ${tableNumber}) 🍽️`;
      const payModeLabel = paymentMethod === "cod" 
        ? (fulfillmentType === "delivery" ? "Cash on Delivery (COD) 💵" : "Cash at Counter 💵")
        : "UPI Online Payment 📱";

      let msg = `🔥 *BAM BAM CAFE - NEW ORDER*\n\n`;
      msg += `*Bill No:* #${formattedBillStr}\n`;
      msg += `*Token No:* #${tokenNumber}\n`;
      msg += `*Customer:* ${customerDetails.name}\n`;
      msg += `*Phone:* ${customerDetails.phone}\n`;
      msg += `*Fulfillment Mode:* ${modeLabel}\n`;
      
      if (fulfillmentType === 'delivery') {
        msg += `*Address:* ${address}\n`;
      }
      msg += `*Payment Method:* ${payModeLabel}\n\n`;

      msg += `*ITEMS:*\n${itemsText}\n`;
      msg += `*Subtotal:* ₹${subtotal + addOnsCost}\n`;
      msg += `*Coupon Discount:* -₹${couponDiscount}\n`;
      
      if (fulfillmentType === 'delivery') {
        msg += `*Delivery:* ₹${deliveryCharge}\n`;
      }
      msg += `*TOTAL BILL: ₹${finalTotal}*\n\n`;

      if (fulfillmentType === 'delivery') {
        msg += `🔑 *Delivery PIN:* ${deliveryPin} (Rider ko ye confirm karke hi order le)\n`;
      }
      
      msg += `*Invite Code:* ${refCode}\n`;
      msg += `*Points Earned:* +${pointsEarned} Pts\n`;
      if (totalPointsCost > 0) {
        msg += `*Points Redeemed:* -${totalPointsCost} Pts\n`;
      }

      if (paymentMethod === "upi") {
        if (screenshotUrl) {
          msg += `\n📸 *Payment Screenshot Link (JPG):*\n${screenshotUrl}\n`;
        } else {
          msg += `\n📸 *भुगतान स्क्रीनशॉट:* बिल #${formattedBillStr} के साथ डेटाबेस में सफलतापूर्वक सेव कर दिया गया है!\n`;
        }
      }

      msg += `\n_Confirm order by replying 'YES'_`;
      
      playSoundEffect('success');
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 5000);

      try {
        await navigator.clipboard.writeText(msg);
        toast.success(isHindi ? "ऑर्डर विवरण कॉपी कर लिया गया है!" : "Order details copied to clipboard!");
      } catch (err) {}

      setTimeout(() => {
        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
        clearCart(); 
        setKetchupAddon(false);
        setOreganoAddon(false);
        setChiliFlakesAddon(false);
        setNoCutlery(false);
        setAppliedCoupon(null); 
        setEnteredCoupon(""); 
        setIsCartOpen(false);
        setPaymentScreenshot(null);
        setIsUpiPopupOpen(false);
      }, 1500);

    } catch (error) {
      console.error("Critical submission error caught:", error);
      toast.error(isHindi ? "ऑर्डर जमा करने में समस्या आई! दोबारा कोशिश करें।" : "Error submitting order. Please try again.");
    } finally {
      setIsSubmittingOrder(false); 
    }
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerHaptic();
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 800;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPaymentScreenshot(compressedBase64);
          toast.success(isHindi ? "स्क्रीनशॉट लोड और कंप्रेस हो गया!" : "Screenshot compressed & loaded!");
        } else {
          setPaymentScreenshot(event.target?.result as string);
        }
        setIsCompressing(false);
      };
      img.onerror = () => {
        setIsCompressing(false);
        toast.error("Error compression screen");
      };
      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setIsCompressing(false);
      toast.error(isHindi ? "फाइल लोड करने में समस्या आई।" : "Error loading file.");
    };
    reader.readAsDataURL(file);
  };

  // --- RE-MODULARIZED AND BRACKET-BALANCED COMPACT HYBRID GEOLOCATION HANDLER ---
  const handleDetectLocation = () => {
    triggerHaptic();
    if (typeof window === "undefined") return;

    setAddress(isHindi ? "⏳ सटीक लोकेशन खोजी जा रही है (GPS)..." : "⏳ Finding highly accurate location (GPS)...");
    const toastId = toast.loading(isHindi ? "सटीक लोकेशन खोजी जा रही है..." : "Finding accurate location...");

    const fallbackToIP = () => {
      setAddress(isHindi ? "⏳ नेटवर्क लोकेशन खोजी जा रही है (Approx)..." : "⏳ Finding network location...");
      fetch('https://ipapi.co/json/')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("IP Geolocation failed");
        })
        .then((ipData) => {
          const lat = ipData.latitude;
          const lon = ipData.longitude;
          const city = ipData.city || "";
          const region = ipData.region || "";

          setDistanceKm(Number(calculateDistanceInKm(lat, lon, storeCoordinates.lat, storeCoordinates.lng).toFixed(2)));
          setCustomerCoordinates({ lat, lng: lon });

          const mapLink = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
          const finalAddressText = city 
            ? `📍 Approx Area: ${city}, ${region} (IP Location)\n🔗 Maps Link: ${mapLink}`
            : `My GPS Location: ${mapLink}`;

          setAddress(finalAddressText);
          toast.dismiss(toastId);
          toast.success(isHindi ? "लोकेशन डिटेक्ट की गई!" : "Location successfully detected!");
        })
        .catch(() => {
          setAddress("");
          toast.dismiss(toastId);
          toast.error(isHindi ? "लोकेशन खोजने में असमर्थ। कृपया मैन्युअली लिखें।" : "Unable to retrieve location. Please type manually.");
        });
    };

    if (!navigator.geolocation) {
      fallbackToIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistanceInKm(latitude, longitude, storeCoordinates.lat, storeCoordinates.lng);
        setDistanceKm(Number(distance.toFixed(2)));
        setCustomerCoordinates({ lat: latitude, lng: longitude });

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`, {
          headers: { 'User-Agent': 'BumBumCafeApp/1.0' }
        })
          .then((res) => {
            if (res.ok) return res.json();
            return null;
          })
          .then((data) => {
            const textAddress = data?.display_name || "";
            const mapLink = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
            const finalAddressText = textAddress 
              ? `📍 Accurate Address: ${textAddress}\n🔗 Maps Link: ${mapLink}`
              : `My GPS Location: ${mapLink}`;

            setAddress(finalAddressText);
            toast.dismiss(toastId);
            toast.success(isHindi ? "लोकेशन सफलतापूर्वक मिल गई!" : "Location successfully found!");
          })
          .catch(() => {
            const mapLink = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
            setAddress(`My GPS Location: ${mapLink}`);
            toast.dismiss(toastId);
            toast.success(isHindi ? "लोकेशन सफलतापूर्वक मिल गई!" : "Location successfully found!");
          });
      },
      () => {
        setAddress(isHindi ? "⏳ वैकल्पिक लोकेशन खोजी जा रही है (Network)..." : "⏳ Finding alternative location...");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const distance = calculateDistanceInKm(latitude, longitude, storeCoordinates.lat, storeCoordinates.lng);
            setDistanceKm(Number(distance.toFixed(2)));
            setCustomerCoordinates({ lat: latitude, lng: longitude });

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`, {
              headers: { 'User-Agent': 'BumBumCafeApp/1.0' }
            })
              .then((res) => {
                if (res.ok) return res.json();
                return null;
              })
              .then((data) => {
                const textAddress = data?.display_name || "";
                const mapLink = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
                const finalAddressText = textAddress 
                  ? `📍 Address (approx): ${textAddress}\n🔗 Maps Link: ${mapLink}`
                  : `My GPS Location: ${mapLink}`;

                setAddress(finalAddressText);
                toast.dismiss(toastId);
                toast.success(isHindi ? "लोकेशन सफलतापूर्वक मिल गई!" : "Location successfully found!");
              })
              .catch(() => {
                const mapLink = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
                setAddress(`My GPS Location: ${mapLink}`);
                toast.dismiss(toastId);
                toast.success(isHindi ? "लोकेशन सफलतापूर्वक मिल गई!" : "Location successfully found!");
              });
          },
          () => {
            setAddress(isHindi ? "⏳ नेटवर्क लोकेशन खोजी जा रही है (Approx)..." : "⏳ Finding network location...");
            fetch('https://ipapi.co/json/')
              .then((res) => {
                if (res.ok) return res.json();
                throw new Error("IP Geolocation failed");
              })
              .then((ipData) => {
                const lat = ipData.latitude;
                const lon = ipData.longitude;
                const city = ipData.city || "";
                const region = ipData.region || "";

                setDistanceKm(Number(calculateDistanceInKm(lat, lon, storeCoordinates.lat, storeCoordinates.lng).toFixed(2)));
                setCustomerCoordinates({ lat, lng: lon });

                const mapLink = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
                const finalAddressText = city 
                  ? `📍 Approx Area: ${city}, ${region} (IP Location)\n🔗 Maps Link: ${mapLink}`
                  : `My GPS Location: ${mapLink}`;

                setAddress(finalAddressText);
                toast.dismiss(toastId);
                toast.success(isHindi ? "लोकेशन डिटेक्ट की गई!" : "Location successfully detected!");
              })
              .catch(() => {
                setAddress("");
                toast.dismiss(toastId);
                toast.error(isHindi ? "लोकेशन खोजने में असमर्थ। कृपया मैन्युअली लिखें।" : "Unable to retrieve location. Please type manually.");
              });
          },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleShareApp = async () => {
    triggerHaptic();
    const shareText = isHindi 
      ? `बम बम कैफ़े से स्वादिष्ट भोजन आर्डर करें! मेरा इनवाइट कोड इस्तेमाल करें: ${getReferralCode()} 🍕` 
      : `Order delicious food from Bum Bum Cafe! Use my invite code: ${getReferralCode()} 🍕`;
    
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://bbcafe.in';

    const performClipboardCopy = () => {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast.success(isHindi ? "शेयर लिंक क्लिपबोर्ड पर कॉपी हो गया!" : "Share link copied to clipboard!");
      updateShareCount();
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bum Bum Cafe',
          text: shareText,
          url: shareUrl,
        });
        updateShareCount();
      } catch (err) {
        performClipboardCopy();
      }
    } else {
      performClipboardCopy();
    }
  };

  const updateShareCount = async () => {
    const nextCount = shareCount + 1;
    setShareCount(nextCount);
    if (nextCount % 5 === 0 && customerDetails?.phone) {
      const phoneClean = customerDetails.phone.replace("+91", "").trim();
      const userDocRef = doc(db, "customer_points", phoneClean);
      try {
        await setDoc(userDocRef, {
          points: increment(1)
        }, { merge: true });
        
        await addDoc(collection(db, "customer_points", phoneClean, "history"), {
          type: 'earn',
          points: 1,
          description: `Shared app 5 times! 🎁`,
          timestamp: new Date()
        });
        setCustomerPoints(p => p + 1);
        toast.success(isHindi ? "मुफ़्त +1 पॉइंट आपके अकाउंट में जोड़ा गया!" : "Free +1 point added to your account!");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCustomerRedeem = (ruleId: string, rewardName: string, pointsCost: number) => {
    triggerHaptic();
    if (!customerDetails?.phone) {
      toast.error(isHindi ? "कृपया पहले प्रोफाइल बनाएं!" : "Please create profile first!");
      return;
    }
    
    addItem({
      id: ruleId,
      name: rewardName,
      price: 0,
      quantity: 1,
      isReward: true,
      pointsCost: pointsCost,
      category: "Special"
    });
    
    toast.success(isHindi ? `${rewardName} आपके कार्ट में मुफ़्त जोड़ा गया!` : `${rewardName} added to your cart for free!`);
  };

  const handleAddDiyPizzaToCart = () => {
    triggerHaptic();
    if (calculatedDiyPizzaPrice <= 0) {
      toast.error(isHindi ? "कृपया कोई आकार और सामग्री चुनें!" : "Please choose a size and toppings!");
      return;
    }

    const toppingsList: string[] = [];
    Object.entries(diyVegSelection).forEach(([v, selected]) => { if (selected) toppingsList.push(v); });
    Object.entries(diyPremiumToppings).forEach(([t, selected]) => { if (selected) toppingsList.push(t); });
    
    const description = `${diySize.toUpperCase()} Base, Sauce: ${diySauce ? 'Yes' : 'No'}, Cheese: ${diyMozzarella ? 'Yes' : 'No'}, Toppings: ${toppingsList.join(', ') || 'None'}`;

    addItem({
      id: `diy-pizza-${Date.now()}`,
      name: isHindi ? `डीआईवाई पिज्जा (${diySize})` : `DIY Pizza (${diySize})`,
      price: calculatedDiyPizzaPrice,
      quantity: 1,
      note: diyChefNote || description,
      category: "DIY Pizza"
    });

    setDiySize("small");
    setDiySauce(true);
    setDiyMozzarella(true);
    setDiyVegSelection({ onion: false, tomato: false, capsicum: false, corn: false });
    setDiyPremiumToppings({ black_olive: false, jalapeno: false, red_peprica: false, paneer: false, mushroom: false });
    setDiyChefNote("");

    toast.success(isHindi ? "कास्ट पिज्जा कार्ट में जोड़ा गया!" : "Your custom Pizza has been added to cart!");
  };

  const handleNormalPizzaAdd = () => {
    triggerHaptic();
    if (!normalPizzaSize) {
      toast.error(isHindi ? "कृपया साइज चुनें!" : "Please select size!");
      return;
    }

    let finalPrice = normalPizzaPrice;
    const selectedAddons: string[] = [];
    
    Object.entries(normalPizzaAddons).forEach(([addon, isSelected]) => {
      if (isSelected) {
        const cost = PIZZA_ADDONS[normalPizzaSize.toLowerCase()]?.[addon] || 0;
        finalPrice += cost;
        selectedAddons.push(addon);
      }
    });

    const noteParts = [];
    if (selectedAddons.length > 0) noteParts.push(`Add-ons: ${selectedAddons.join(', ')}`);
    if (chefNote) noteParts.push(`Note: ${chefNote}`);

    addItem({
      id: `${selectedProduct.id}-${normalPizzaSize.toLowerCase()}`,
      name: `${selectedProduct.name} (${normalPizzaSize.toUpperCase()})`,
      price: finalPrice,
      quantity: 1,
      note: noteParts.join(' | '),
      category: selectedProduct.category
    });

    setSelectedProduct(null);
    setNormalPizzaSize("");
    setNormalPizzaPrice(0);
    setNormalPizzaAddons({});
    setChefNote("");

    toast.success(isHindi ? "कस्टमाइज्ड पिज्जा कार्ट में जोड़ा गया!" : "Customized Pizza added to cart!");
  };

  const handleReelEnded = () => {
    triggerHaptic();
    setActiveStory(null);
  };

  const handleQuickAddFromStory = (title: string, price: number) => {
    triggerHaptic();
    const matchedItem = menu.find(item => item.name?.toLowerCase() === title?.toLowerCase());
    if (matchedItem) {
      addItem(matchedItem);
    } else {
      addItem({
        id: `story-${title.replace(/\s+/g, '-').toLowerCase()}`,
        name: title,
        price: price,
        quantity: 1,
        category: "Fast Food"
      });
    }
    setActiveStory(null);
    toast.success(isHindi ? "आइटम कार्ट में जोड़ा गया!" : "Item added to cart!");
  };

  // --- Real-time Watchers ---
  useEffect(() => {
    if (!customerDetails?.phone) {
      setCustomerPoints(0);
      setPointsHistory([]);
      setLiveOrder(null);
      return;
    }
    
    const phoneClean = customerDetails.phone.replace("+91", "").trim();
    
    const unsubPoints = onSnapshot(doc(db, "customer_points", phoneClean), (snap) => {
      if (snap.exists()) {
        setCustomerPoints(snap.data().points || 0);
      }
    }, (error) => console.warn("Points live check subscription bypassed:", error));

    const unsubHistory = onSnapshot(
      query(collection(db, "customer_points", phoneClean, "history"), orderBy("timestamp", "desc")),
      (snap) => {
        setPointsHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => console.warn("Points history subscription bypassed:", error)
    );

    const unsubLive = onSnapshot(
      query(
        collection(db, "orders"),
        where("customerPhone", "==", customerDetails.phone)
      ),
      (snap) => {
        if (!snap.empty) {
          // Client-side sorting latest order to bypass missing index issue
          const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          orders.sort((a, b) => {
            const timeA = a.timestamp?.seconds || (a.timestamp?.toDate ? a.timestamp.toDate().getTime() / 1000 : 0);
            const timeB = b.timestamp?.seconds || (b.timestamp?.toDate ? b.timestamp.toDate().getTime() / 1000 : 0);
            return timeB - timeA;
          });

          const latestOrder = orders[0];
          const dismissedRejected = JSON.parse(localStorage.getItem('bb_dismissed_rejected_orders') || '[]');
          if (latestOrder.status !== 'completed' && !dismissedRejected.includes(latestOrder.id)) {
            setLiveOrder(latestOrder);
          } else {
            setLiveOrder(null);
          }
        } else {
          setLiveOrder(null);
        }
      },
      (error) => console.warn("Live order subscription bypassed (index may be building):", error)
    );

    return () => {
      unsubPoints();
      unsubHistory();
      unsubLive();
    };
  }, [customerDetails?.phone]);

  // --- AUTO-DISMISS PROCESSED ORDERS AND GREETING TIMER ---
  useEffect(() => {
    if (liveOrder && (liveOrder.status === 'delivered' || liveOrder.status === 'completed' || liveOrder.status === 'rejected')) {
      const timer = setTimeout(() => {
        try {
          const dismissed = JSON.parse(localStorage.getItem('bb_dismissed_rejected_orders') || '[]');
          if (!dismissed.includes(liveOrder.id)) {
            dismissed.push(liveOrder.id);
            localStorage.setItem('bb_dismissed_rejected_orders', JSON.stringify(dismissed));
          }
        } catch (e) {}
        setLiveOrder(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [liveOrder?.id, liveOrder?.status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGreeting(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // --- Search Debouncing & Hinglish Optimizer ---
  useEffect(() => {
    const timer = setTimeout(() => {
      const cleanQuery = searchQuery.toLowerCase().trim();
      const translatedWords = cleanQuery.split(/\s+/).map(word => HINGLISH_DICT[word] || word);
      setDebouncedSearchQuery(translatedWords.join(" "));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Banner Cycle Auto-Carousel Timer ---
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    const fakeProofs = [
      { text: "Ramesh from Mohandra recently ordered Special Thali! 🍛" },
      { text: "Pooja just added Paneer Special Pizza to her cart! 🍕" },
      { text: "5 people are looking at DIY Pizza right now! 🔥" },
      { text: "Amit rated Bum Bum Cafe 5 stars! ⭐⭐⭐⭐⭐" },
      { text: "Sanjay from Mohandra Town just placed an order! 🛵" },
      { text: "Anjali is customizing her DIY Pizza! 🍕" }
    ];
    setSocialProofs(fakeProofs);
    
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * fakeProofs.length);
      setSocialAlertIndex(randomIndex);
      setShowSocialAlert(true);
      setTimeout(() => setShowSocialAlert(false), 5000);
    }, 24000);

    return () => clearInterval(interval);
  }, []);

  // --- INITIAL MOUNT & SWR BACKGROUND DATABASE SYNCHRONIZER ---
  useEffect(() => {
    setMounted(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('bb_app_installed_or_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    }

    try {
      const cachedMenu = localStorage.getItem('bb_cached_menu');
      if (cachedMenu) setMenu(JSON.parse(cachedMenu));

      const cachedSocial = localStorage.getItem('bb_cached_social_counts');
      if (cachedSocial) setSocialCounts(JSON.parse(cachedSocial));

      const cachedRules = localStorage.getItem('bb_cached_loyalty_rules');
      if (cachedRules) setLoyaltyRules(JSON.parse(cachedRules));

      const cachedCats = localStorage.getItem('bb_cached_categories');
      if (cachedCats) setDbCategories(JSON.parse(cachedCats));

      const cachedBanners = localStorage.getItem('bb_cached_banners');
      if (cachedBanners) setBanners(JSON.parse(cachedBanners));

      const cachedReels = localStorage.getItem('bb_cached_reels');
      if (cachedReels) setStories(JSON.parse(cachedReels));

      const savedDetails = localStorage.getItem('bb_cafe_customer');
      if (savedDetails) {
        const parsed = JSON.parse(savedDetails);
        if (parsed && parsed.name && parsed.phone) {
          setCustomerDetails(parsed);
          setTempName(parsed.name);
          setTempPhone(parsed.phone.replace("+91", ""));
          if (parsed.pin) setTempPin(parsed.pin);
        }
      }

      const cachedPast = localStorage.getItem('bb_past_orders');
      if (cachedPast) setPastOrders(JSON.parse(cachedPast));

      const cachedFavs = localStorage.getItem('bb_favorites');
      if (cachedFavs) setFavorites(JSON.parse(cachedFavs));
    } catch (e) {
      console.warn("Local storage cache load bypassed:", e);
    }

    const fetchFreshDbData = async () => {
      setMenuLoading(true);
      try {
        const storeSnap = await getDoc(doc(db, "settings", "store"));
        if (storeSnap.exists()) {
          const storeData = storeSnap.data();
          setStoreOpen(storeData.isOpen);
          setIsBannerEnabled(storeData.isBannerEnabled ?? storeData.showPromoBanner ?? true);
          setIsInlineBannerEnabled(storeData.isInlineBannerEnabled ?? storeData.showInlinePromo ?? true);
          if (storeData.whatsappNumber) setWhatsappNumber(storeData.whatsappNumber);
          if (storeData.upiId) setUpiId(storeData.upiId);
          if (storeData.latitude && storeData.longitude) {
            setStoreCoordinates({ lat: Number(storeData.latitude), lng: Number(storeData.longitude) });
          }
          if (storeData.timingHindi) setStoreTimingHindi(storeData.timingHindi);
          if (storeData.timingEnglish) setStoreTimingEnglish(storeData.timingEnglish);
          if (storeData.closingMinutesLeft !== undefined) setClosingMinutesLeft(storeData.closingMinutesLeft);
        }

        const productsSnap = await getDocs(collection(db, "products"));
        const items = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((i: any) => i.isVisible !== false);
        setMenu(shuffleArray(items));
        localStorage.setItem('bb_cached_menu', JSON.stringify(items));

        const catsSnap = await getDocs(collection(db, "categories"));
        const cats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDbCategories(cats);
        localStorage.setItem('bb_cached_categories', JSON.stringify(cats));

        const bannersSnap = await getDocs(collection(db, "banners"));
        const banData = bannersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBanners(banData);
        localStorage.setItem('bb_cached_banners', JSON.stringify(banData));

        const reelsSnap = await getDocs(collection(db, "reels"));
        const reelData = reelsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStories(reelData);
        localStorage.setItem('bb_cached_reels', JSON.stringify(reelData));

        const rulesSnap = await getDocs(collection(db, "loyalty_rules"));
        const ruleData = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLoyaltyRules(ruleData);
        localStorage.setItem('bb_cached_loyalty_rules', JSON.stringify(ruleData));

        const socialSnap = await getDoc(doc(db, "settings", "social_counts"));
        if (socialSnap.exists()) {
          const data = socialSnap.data();
          setSocialCounts(data);
          localStorage.setItem('bb_cached_social_counts', JSON.stringify(data));
        }

      } catch (err) {
        console.warn("Background fetch warning (Offline Mode Active):", err);
      } finally {
        setMenuLoading(false);
      }
    };

    fetchFreshDbData();

    return () => { 
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      }
    };
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
        <span className="text-xs font-bold uppercase tracking-wider">Bum Bum Cafe Loading...</span>
      </div>
    );
  }

  return (
    <div className="dark:bg-[#050505] bg-neutral-50 min-h-screen dark:text-white text-neutral-800 pb-32 font-sans relative overflow-x-clip transition-colors duration-200">
      
      <link rel="manifest" href="/manifest.json" />

      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#222',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '12px'
          }
        }} 
      />

      {/* Network Status Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white font-black py-2 px-4 text-center text-xs flex items-center justify-center gap-2 shadow-lg sticky top-0 z-[150]">
          <WifiOff size={14} className="animate-pulse" />
          <span>आप ऑफ़लाइन हैं। कैश्ड मेनू दिखाया जा रहा है।</span>
        </div>
      )}

      {/* Closing Warning Timer Ribbon */}
      {closingMinutesLeft !== null && storeOpen && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold py-2 px-4 text-center text-[10px] flex items-center justify-center gap-1.5 shadow-md">
          <span>⏰</span>
          <span>आर्डर चेतावनी:  बम बम कैफ़े अगले {closingMinutesLeft} minute में बंद होने वाला है!  आर्डर जल्दी पूरा करें।</span>
        </div>
      )}

      {/* Social Proof Toast Alert */}
      <AnimatePresence>
        {showSocialAlert && socialProofs.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-black/90 backdrop-blur-md border border-orange-500/30 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 max-w-[90%] text-center"
          >
            <span className="text-sm">🔥</span>
            <span className="text-[10px] font-black tracking-wide truncate text-white">{socialProofs[socialAlertIndex]?.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {confettiActive && (
        <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
          {Array.from({ length: 105 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ["#facc15", "#f97316", "#ef4444", "#3b82f6", "#10b981"][i % 5],
                left: `${Math.random() * 100}%`,
                top: `-10px`
              }}
              animate={{
                y: [0, window.innerHeight],
                x: [0, (Math.random() - 0.5) * 200],
                rotate: [0, 360]
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                ease: "easeOut",
                repeat: Infinity
              }}
            />
          ))}
        </div>
      )}

      {/* PREMIUM HERO HEADER */}
      <header className="relative pt-6 pb-4 px-4 overflow-hidden shadow-md flex flex-col justify-end min-h-[120px] bg-neutral-950 border-b dark:border-white/5 border-neutral-200">
        <div className="relative z-20 max-w-[85%] mt-auto bg-black/40 backdrop-blur-sm p-2.5 rounded-xl border border-white/10 shadow-md">
          <motion.div
            initial={{ x: -25, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-0.5"
          >
            <h1 className="text-base font-black tracking-wide text-yellow-300 font-sans block leading-none mb-1">
              {isHindi ? "बम बम कैफ़े" : "Bum Bum Cafe"}
            </h1>
            <p className="text-[9px] text-gray-300 font-bold">
              {isHindi ? "पिज्जा, स्पेशल सैंडविच और पनीर डिलाइट्स तुरंत आदेश करें!" : "Order Pizza, Special Sandwich & Paneer Delights instantly!"}
            </p>
          </motion.div>
          <button 
            onClick={scrollToMenu}
            className="mt-1 bg-orange-600 hover:bg-orange-700 text-white font-black text-[7px] px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-md transition-all active:scale-95"
          >
            {isHindi ? "ऑर्डर करें" : "Order Now"}
          </button>
        </div>
      </header>

      {/* FIXED STICKY SEARCH BAR */}
      <div className="sticky top-0 z-40 dark:bg-[#050505]/95 bg-white/95 backdrop-blur-md py-3 px-4 border-b dark:border-white/5 border-neutral-300 transition-colors duration-200 shadow-sm">
        <div className="relative max-w-sm mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={isHindi ? "पिज़्ज़ा, सैंडविच, पनीर स्पेशल खोजें..." : "Search pizza, sandwich, paneer special..."} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full dark:bg-neutral-800 bg-neutral-100 dark:text-white text-neutral-900 py-2.5 px-11 rounded-xl outline-none text-xs font-semibold dark:placeholder-gray-400 placeholder-neutral-500 border dark:border-neutral-700 border-neutral-300 transition-colors duration-200 shadow-sm" 
            />
          </div>

          {/* HINDI / ENGLISH LANGUAGE TOGGLE */}
          <button 
            onClick={() => { triggerHaptic(); setIsHindi(!isHindi); }}
            className="px-3 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black tracking-wider flex-shrink-0 transition-all active:scale-95 shadow flex items-center gap-1 min-w-[65px]"
          >
            <Globe size={12} />
            <span>{isHindi ? "English" : "हिंदी"}</span>
          </button>
          
          <a 
            href="tel:+919714293759"
            className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl border border-transparent shadow flex items-center justify-center transition-colors flex-shrink-0"
            title="Direct call to cafe"
          >
            <Phone size={18} />
          </a>

          <button 
            onClick={() => { triggerHaptic(); setIsProfileOpen(true); }}
            className="p-2.5 dark:bg-neutral-800 bg-neutral-100 dark:text-white text-neutral-900 rounded-xl border dark:border-neutral-700 border-neutral-300 hover:border-orange-500 hover:text-orange-500 transition-colors shadow flex-shrink-0"
            title="My Profile & Loyalty Rewards"
          >
            <User size={18} />
          </button>
        </div>
      </div>

      {!storeOpen && (
        <div className="bg-red-600 text-white font-black py-3 px-4 text-center text-xs flex items-center justify-center gap-2 shadow-lg border-b border-red-500">
          <span className="animate-pulse">⚠️</span>
          <span>{isHindi ? "बम बम कैफ़े अभी बंद है।  आप केवल हमारा मेनू देख सकते हैं।" : "Bum Bum Cafe is closed now. You can only view our menu."}</span>
        </div>
      )}

      {/* MAIN LAYOUT WRAPPER */}
      <main ref={menuRef} className="pt-3 px-3 max-w-lg mx-auto space-y-4 font-sans font-bold">

        <AnimatePresence>
          {showGreeting && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-1.5 py-1 overflow-hidden"
            >
              <h3 className="text-xs font-black dark:text-gray-200 text-neutral-900 leading-normal">{greetingText}</h3>
            </motion.div>
          )}
        </AnimatePresence>

        {showInstallBanner && (
          <div className="bg-gradient-to-r from-[#ff5e00] to-amber-500 p-3.5 rounded-2xl flex items-center justify-between shadow-lg border border-white/10 mx-1 relative">
            <button 
              onClick={handleDismissInstallBanner}
              className="absolute top-2 right-2 text-white/70 hover:text-white"
              title="Dismiss"
            >
              <X size={14} />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📲</span>
              <div className="pr-4">
                <h4 className="text-xs font-black text-white font-sans">Bum Bum Cafe App</h4>
                <p className="text-[9px] text-orange-100 font-bold">{isHindi ? "बिना प्ले स्टोर के सीधे अपने phone में इंस्टॉल करें!" : "Install directly on your phone without Play Store!"}</p>
              </div>
            </div>
            <button 
              onClick={handleInstallClick}
              className="bg-white text-black font-black text-[10px] px-3 py-2 rounded-xl uppercase shadow active:scale-95 transition-all flex-shrink-0"
            >
              Install ➔
            </button>
          </div>
        )}

        {/* Dynamic Video Stories */}
        {stories.length > 0 && (
          <div className="space-y-1 px-1">
            <p className="text-[8px] font-black uppercase tracking-wider text-orange-500">{isHindi ? "खूबसूरत  फ़ूड रील्स" : "Daily Food Reels"}</p>
            <div className="flex gap-4 overflow-x-auto py-1.5 scrollbar-none [&::-webkit-scrollbar]:hidden font-sans">
              {stories.map((story: any) => (
                <button 
                  key={story.id} 
                  onClick={() => { triggerHaptic(); setActiveStory(story); }}
                  className="flex flex-col items-center flex-shrink-0 focus:outline-none"
                >
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-600 relative">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-neutral-900 bg-neutral-800 flex items-center justify-center relative">
                      <img src={story.coverUrl || story.url} className="w-full h-full object-cover" alt={story.title} loading="lazy" />
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <Play size={14} className="text-white fill-white" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[8px] font-bold dark:text-gray-300 text-neutral-800 mt-1 max-w-[70px] truncate">{story.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Promo Banner */}
        {isBannerEnabled && banners.length > 0 && !bannerError && (
          <div className="w-full h-36 rounded-2xl overflow-hidden relative border border-white/5 bg-white/[0.02]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={bannerIndex}
                initial={{ opacity: 0, x: 70, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -70, scale: 0.95 }}
                transition={{ duration: 0.55, ease: "easeInOut" }}
                className="w-full h-full absolute inset-0"
              >
                {isVideoUrl(banners[bannerIndex]?.url) ? (
                  <video 
                    src={banners[bannerIndex]?.url} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover"
                    onError={() => setBannerError(true)}
                  />
                ) : (
                  <img 
                    src={banners[bannerIndex]?.url} 
                    className="w-full h-full object-cover" 
                    onError={() => setBannerError(true)} 
                    alt="BAM BAM CAFE Promo"
                    loading="lazy"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* MODULAR CATEGORY SLIDER */}
        <CategorySlider 
          isHindi={isHindi}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          visibleCategories={visibleCategories}
          favorites={favorites}
          getCategoryImage={getCategoryImage}
          triggerHaptic={triggerHaptic}
        />

        {distanceKm !== null && (
          <div className="bg-orange-500/10 border border-orange-500/20 p-3.5 rounded-2xl flex items-center gap-3 font-bold">
            <span className="text-xl font-bold">📍</span>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-orange-500 dark:text-orange-400 uppercase font-sans font-bold">{isHindi ? "अनुमानित दूरी" : "Estimated Distance"}</p>
              <p className="text-[9px] text-neutral-700 dark:text-gray-400 font-sans font-bold">{isHindi ? `आप बम बम कैफे से लगभग ${distanceKm} KM की दूरी पर हैं।` : `You are approximately ${distanceKm} KM away from Bum Bum Cafe.`}</p>
            </div>
          </div>
        )}

        {/* MODULAR DIY PIZZA BUILDER WORKSPACE / STANDARD PRODUCTS */}
        {selectedCategory === "DIY Pizza" ? (
          <DiyPizzaBuilder 
            isHindi={isHindi}
            diySize={diySize}
            setDiySize={setDiySize}
            diySauce={diySauce}
            setDiySauce={setDiySauce}
            diyMozzarella={diyMozzarella}
            setDiyMozzarella={setDiyMozzarella}
            diyVegSelection={diyVegSelection}
            setDiyVegSelection={setDiyVegSelection}
            diyPremiumToppings={diyPremiumToppings}
            setDiyPremiumToppings={setDiyPremiumToppings}
            diyChefNote={diyChefNote}
            setDiyChefNote={setDiyChefNote}
            calculatedDiyPizzaPrice={calculatedDiyPizzaPrice}
            DIY_PIZZA_PRICES={DIY_PIZZA_PRICES}
            QUICK_INSTRUCTION_TAGS={QUICK_INSTRUCTION_TAGS}
            quickAppendInstruction={quickAppendInstruction}
            handleAddDiyPizzaToCart={handleAddDiyPizzaToCart}
            triggerHaptic={triggerHaptic}
            storeOpen={storeOpen}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 pt-1 font-bold">
            {menuLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="dark:bg-white/[0.02] bg-white rounded-2xl border dark:border-white/5 border-neutral-200 p-4 space-y-4 animate-pulse font-sans">
                  <div className="h-44 bg-neutral-300 dark:bg-neutral-800 rounded-xl w-full" />
                  <div className="space-y-2">
                    <div className="h-4 bg-neutral-300 dark:bg-neutral-800 rounded w-1/2" />
                    <div className="h-3 bg-neutral-300 dark:bg-neutral-800 rounded w-1/4" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-neutral-300 dark:bg-neutral-800 rounded w-1/6" />
                    <div className="h-8 bg-neutral-300 dark:bg-neutral-800 rounded w-1/5" />
                  </div>
                </div>
              ))
            ) : filteredMenu.length === 0 ? (
              <p className="text-center text-neutral-600 dark:text-gray-400 py-8 text-xs font-bold uppercase font-sans">No items found...</p>
            ) : (
              filteredMenu.map((item: any, index: number) => {
                const isItemAvailable = item.isAvailable !== false;

                return (
                  <React.Fragment key={item.id}>
                    <motion.div 
                      layout 
                      className={`group dark:bg-white/[0.02] bg-white rounded-2xl border dark:border-white/5 border-neutral-200 overflow-hidden flex flex-col relative shadow-md shadow-neutral-100 dark:shadow-none transition-all duration-300 hover:shadow-lg ${!isItemAvailable ? 'opacity-70' : ''}`}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                      <div className="relative h-44 w-full overflow-hidden font-sans">
                        <img 
                          src={item.image || item.imageUrl || item.url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80"} 
                          className="w-full h-full object-cover origin-center transition-transform duration-700 ease-out group-hover:scale-110" 
                          alt={item.name} 
                          loading="lazy"
                        />
                        
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1 text-[8px] font-black uppercase text-green-400 font-bold">
                          <span className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />VEG
                        </div>

                        <div className="absolute bottom-0 left-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black text-[9px] px-3 py-1 rounded-tr-xl flex items-center gap-1 shadow-md uppercase tracking-wider">
                          <span>🛵</span> <span>{isHindi ? "फ्री डिलीवरी" : "FREE delivery"}</span>
                        </div>

                        {!isItemAvailable && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="bg-red-600 text-white font-black text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-md">
                              {isHindi ? "आज उपलब्ध नहीं है" : "Out of Stock"}
                            </span>
                          </div>
                        )}

                        <button onClick={(e) => handleToggleFavorite(item.id, e)} className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10 text-white hover:text-red-500 transition-colors">
                          <Heart size={14} className={favorites.includes(item.id) ? "fill-red-500 text-red-500" : "text-white"} />
                        </button>
                      </div>
                      <div className="p-4 flex flex-col justify-between flex-1 font-sans font-bold">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="font-black text-sm dark:text-gray-100 text-neutral-900 line-clamp-1">{item.name}</h4>
                          <div className="bg-green-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded flex items-center gap-0.5">
                            <span>4.9</span><Star size={8} style={{ color: '#ffffff', fill: '#ffffff' }} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-neutral-500 dark:text-gray-400 font-bold mt-0.5 font-sans">
                          <p className="uppercase text-[8px] text-neutral-500 dark:text-gray-400">{item.category}</p><p>• 15-25 min</p>
                        </div>
                        <div className="h-px dark:bg-white/5 bg-neutral-200 my-2.5" />
                        <div className="flex justify-between items-end mt-0.5">
                          <div>
                            <p className="text-neutral-500 dark:text-neutral-400 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Price</p>
                            <p className="text-orange-700 dark:text-orange-500 font-black text-base leading-none font-mono">{getDisplayPrice(item)}</p>
                            {item.variants && <span className="text-[8px] font-bold text-neutral-600 dark:text-gray-400 mt-1 block">{isHindi ? "विकल्प उपलब्ध हैं" : "Options available"}</span>}
                          </div>
                          
                          {storeOpen && isItemAvailable && (
                            <button 
                              onClick={() => { 
                                triggerHaptic();
                                item.variants ? setSelectedProduct(item) : addItem(item); 
                              }} 
                              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all uppercase flex items-center gap-1.5 shadow-md shadow-orange-500/30 border border-orange-600"
                            >
                              <Plus size={14} /> {isHindi ? "जोड़ें" : "ADD"}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Promo pass card positioned after 4th item */}
                    {index === 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        onClick={() => {
                          triggerHaptic();
                          setIsProfileOpen(true);
                        }}
                        className="cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white p-5 rounded-2xl shadow-lg border border-white/10 my-2 relative overflow-hidden group font-sans font-bold"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
                        <div className="relative z-10 flex justify-between items-center gap-4 font-sans font-bold">
                          <div className="space-y-1.5 font-sans font-bold">
                            <span className="bg-black/30 border border-white/20 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-yellow-300">
                              🎁 LOYALTY CLUB PROMO PASS
                            </span>
                            <h4 className="text-sm font-black italic tracking-tight font-serif">
                              {isHindi ? "फ्री पिज्जा, सैंडविच और शेक अनलॉक करें!" : "Unlock Free Pizza, Sandwich & Shakes!"}
                            </h4>
                            <p className="text-[10px] text-orange-100 font-bold leading-normal font-sans">
                              {customerDetails ? (
                                isHindi ? "आपका प्रोमो पास एक्टिवेटेड है! ✅ हर ₹100 पर 1 पॉइंट कमाएं।  यहाँ क्लिक करके अपने  रिवॉर्ड्स देखें ➔" : "Your promo pass is active! ✅ Earn 1 point per ₹100. Click here to view rewards ➔"
                              ) : (
                                isHindi ? "अपना Name & Number दर्ज करके इस पास को एक्टिवेट करें! 🎁 हर ₹100 पर 1 पॉइंट कमाएं।  टच करें ➔" : "Enter your Name & Number to activate this pass! 🎁 Earn 1 point per ₹100. Tap to activate ➔"
                              )}
                            </p>
                          </div>
                          <div className="bg-white/15 backdrop-blur-md p-3 rounded-full border border-white/20 text-yellow-300 group-hover:rotate-12 transition-transform duration-300">
                            <Gift size={24} />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Secondary Promo Banner positioned after the 7th item */}
                    {index === 6 && isInlineBannerEnabled && (
                      <div className="w-full h-36 rounded-2xl overflow-hidden relative border border-white/5 bg-white/[0.02] my-2 font-sans font-bold">
                        {(banners.length === 0 || bannerError) ? (
                          <div className="w-full h-full bg-gradient-to-r from-yellow-600/35 to-orange-900/30 flex flex-col justify-center p-5 space-y-1 font-sans">
                            <span className="text-[8px] font-black uppercase text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full w-max">
                              {isHindi ? "ताज़ा स्वाद" : "Fresh Taste"}
                            </span>
                            <h3 className="text-sm font-black text-yellow-300">
                              {isHindi ? "शुद्ध और हाइजीनिक Fast Food" : "PURE & HYGIENIC FAST FOOD"}
                            </h3>
                            <p className="text-[9px] text-neutral-600 dark:text-gray-400 font-bold">
                              {isHindi ? "मोहांद्रा में हमारा स्पेशल पनीर पिज्जा चखें!" : "Try our special Paneer Pizza in Mohandra Town!"}
                            </p>
                          </div>
                        ) : (
                          <div className="w-full h-full relative">
                            {isVideoUrl(banners[(bannerIndex + 1) % banners.length]?.url) ? (
                              <video 
                                src={banners[(bannerIndex + 1) % banners.length]?.url} 
                                autoPlay 
                                loop 
                                muted 
                                playsInline 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img 
                                src={banners[(bannerIndex + 1) % banners.length]?.url} 
                                className="w-full h-full object-cover" 
                                alt="BAM BAM CAFE Secondary Promo"
                                loading="lazy"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}

        {/* FOOTER */}
        <footer className="pt-8 border-t border-neutral-200 dark:border-white/5 space-y-6">
          <div className="bg-gradient-to-br dark:from-green-950/20 dark:to-emerald-900/10 from-green-50 to-emerald-50 p-6 rounded-[2rem] border dark:border-green-500/10 border-green-200 relative overflow-hidden transition-colors duration-200 font-sans">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
            
            <div className="text-center space-y-3 relative z-10 flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                {isHindi ? "हमारे बारे में" : "About Us"}
              </span>
              <h4 className="text-xl font-black italic text-yellow-500 font-serif">BUM BUM CAFE</h4>
              <p className="text-[11px] font-bold text-green-600 dark:text-green-300">{isHindi ? "जहाँ स्वाद और सुकून मिलते हैं! ✨" : "Where Taste Meets Serenity! ✨"}</p>
              
              <p className="text-[11.5px] text-neutral-800 dark:text-gray-300 leading-relaxed max-w-sm mx-auto font-medium">
                {isHindi ? 
                  "हमने BAM BAM CAFE की शुरुआत एक छोटे से सपने के साथ की थी—लोगों को घर जैसा स्वाद और कैफे वाला माहौल देने के लिए।  यहाँ हर कप कॉफी और हर स्लाइस पिज्जा प्यार और शुद्धता के साथ बनाया जाता है।  हमारी कोशिश है कि आप जब भी यहाँ आएँ, एक प्यारी मुस्कान के साथ वापस जाएँ।  ❤️" :
                  "We started BAM BAM CAFE with a simple dream - to serve hygienic, delicious, home-style fast food in Mohandra town. Every slice of pizza and plate of thali here is crafted with ultimate love, purity and hygiene. Feel free to dine-in or order online! ❤️"
                }
              </p>
            </div>
          </div>

          {/* Social Icons */}
          <div className="social-icons flex flex-wrap justify-center gap-6 py-5 dark:bg-white/[0.02] bg-white border dark:border-white/5 border-neutral-200 rounded-2xl shadow-sm">
            {SOCIAL_LINKS.map((link: any) => (
              <a 
                key={link.id}
                href={link.url} 
                target="_blank" 
                rel="noreferrer" 
                title={link.label} 
                className="flex flex-col items-center gap-1 hover:scale-105 transition-transform"
              >
                <img src={link.icon} alt="" className="w-8 h-8 object-contain" loading="lazy" />
                <span className="text-[8px] font-bold text-neutral-500 dark:text-gray-400 mt-0.5">
                  {socialCounts[link.id] || "Follow"}
                </span>
              </a>
            ))}
          </div>

          {/* Time & Location Grid */}
          <div className="grid grid-cols-2 gap-3 text-center text-[10px] font-black uppercase font-sans font-bold">
            <div className="dark:bg-white/[0.02] bg-white border dark:border-white/5 border-neutral-200 p-4 rounded-2xl flex flex-col items-center justify-center space-y-1 shadow-md shadow-neutral-200/30 dark:shadow-none transition-colors duration-200">
              <Clock className="text-orange-500" size={16} />
              <p className="text-neutral-600 dark:text-gray-400 text-[8px]">{isHindi ? "खुलने का समय" : "Open Timing"}</p>
              <p className="dark:text-white text-neutral-800 text-[9px] font-mono">
                {isHindi ? storeTimingHindi : storeTimingEnglish}
              </p>
            </div>
            
            <a href="https://maps.app.goo.gl/8pj1Xby3bbMn5qxu5" target="_blank" rel="noreferrer" className="dark:bg-white/[0.02] bg-white border dark:border-white/5 border-neutral-200 p-4 rounded-2xl flex flex-col items-center justify-center space-y-1 hover:border-orange-500/30 shadow-md shadow-neutral-200/30 dark:shadow-none transition-all duration-200">
              <MapPin className="text-green-500 animate-bounce" size={16} />
              <p className="text-neutral-600 dark:text-gray-400 text-[8px]">{isHindi ? "हमारा पता" : "Our Location"}</p>
              <p className="text-yellow-600 dark:text-yellow-400 text-[9px] underline">Google Map 🗺️</p>
            </a>
          </div>

          <div className="text-center text-[9px] text-neutral-500 dark:text-gray-400 font-bold tracking-widest pt-2 font-mono">
            © 2026 BUM BUM CAFE - MOHANDRA. ALL RIGHTS RESERVED.
          </div>
        </footer>
      </main>

      {/* STICKY FLOATING CART BUTTON */}
      <div className="fixed bottom-6 inset-x-0 z-[80] flex justify-center pointer-events-none font-sans font-bold">
        <div className="flex gap-4 pointer-events-auto">
          {cart.length > 0 && (
            <motion.button
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: 50 }}
              onClick={() => { triggerHaptic(); setIsCartOpen(true); }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-black px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-orange-500/30"
            >
              <div className="relative">
                <ShoppingBag size={18} />
                <span className="absolute -top-2.5 -right-2.5 bg-yellow-400 text-black text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-orange-600 font-mono">
                  {cart.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="text-left leading-none">
                <p className="text-[8px] uppercase tracking-wider text-orange-200">{isHindi ? "कर्ट देखें" : "View Cart"}</p>
                <p className="text-xs font-black font-mono">₹{getTotalBillPrice()}</p>
              </div>
              <ChevronRight size={16} />
            </motion.button>
          )}
        </div>
      </div>

      {/* LIVE ORDER REAL-TIME TRACKING FLOATING PANEL */}
      <AnimatePresence>
        {liveOrder && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 inset-x-4 z-50 max-w-sm mx-auto shadow-2xl"
          >
            <LiveOrderTracker 
              isHindi={isHindi}
              liveOrder={liveOrder}
              setLiveOrder={setLiveOrder}
              formatBillNumber={formatBillNumber}
              whatsappNumber={whatsappNumber}
              triggerHaptic={triggerHaptic}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL SCREEN REELS VIEWER */}
      <AnimatePresence>
        {activeStory && (
          <div className="fixed inset-0 bg-black z-[250] flex flex-col justify-between font-sans">
            <div className="absolute top-4 inset-x-0 px-4 z-[260] flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pb-10">
              <span className="text-white text-xs font-black tracking-wider uppercase">{activeStory.title}</span>
              <button 
                onClick={() => { triggerHaptic(); setActiveStory(null); }} 
                className="p-2 bg-white/10 rounded-full text-white"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <video 
                src={activeStory.url} 
                autoPlay 
                playsInline 
                onEnded={handleReelEnded}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>

            <div className="p-6 bg-gradient-to-t from-black via-black/80 to-transparent text-center space-y-4 z-[260]">
              <p className="text-xs text-gray-300 font-semibold">{activeStory.description}</p>
              <button 
                onClick={() => handleQuickAddFromStory(activeStory.title, activeStory.price)}
                className="w-full max-w-sm mx-auto bg-orange-500 hover:bg-orange-600 text-black py-4 rounded-2xl font-black text-xs uppercase shadow"
              >
                ADD TO CART • ₹{activeStory.price}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* STANDARD CUSTOMIZATION MODAL FOR REGULAR PIZZAS */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-end font-sans">
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="dark:bg-[#111] bg-white w-full p-6 rounded-t-3xl border-t dark:border-white/10 border-neutral-200 max-w-lg mx-auto overflow-y-auto max-h-[95vh] shadow-2xl transition-colors duration-200">
              <div className="w-12 h-1 bg-neutral-200 dark:bg-white/15 rounded-full mx-auto mb-4" />
              <h3 className="text-xl font-black text-center text-neutral-900 dark:text-white font-bold">{selectedProduct?.name}</h3>
              <p className="text-orange-500 font-black mb-4 uppercase text-[8px] text-center">{isHindi ? "ऑर्डर कस्टमाइज़ करें" : "Customize Your Order"}</p>
              
              <div className="space-y-3 mb-4 font-sans">
                <p className="text-[10px] font-bold text-neutral-600 dark:text-gray-400 uppercase">{isHindi ? "1. साइज चुनें:" : "1. Select Portion Size:"}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedProduct?.variants || {}).map(([size, price]: any) => (
                    <button 
                      type="button" 
                      key={size} 
                      onClick={() => { setNormalPizzaSize(size); setNormalPizzaPrice(Number(price)); }} 
                      className={`p-3 rounded-xl flex flex-col items-center border transition-all ${normalPizzaSize.toLowerCase() === size.toLowerCase() ? 'bg-orange-500/10 border-orange-500 text-orange-600 font-black shadow-sm' : 'dark:bg-white/[0.03] bg-neutral-50 dark:border-white/5 border-neutral-300 dark:text-gray-400 text-neutral-800'}`}
                    >
                      <span className="capitalize text-xs font-black">{size}</span>
                      <span className="font-extrabold text-[10px] mt-1 dark:text-white text-neutral-900 font-mono">₹{price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {normalPizzaSize && (selectedProduct?.category === "Special Pizza" || selectedProduct?.name?.toLowerCase().includes("pizza")) && (
                <div className="space-y-3 mb-4 border-t border-neutral-200 dark:border-white/5 pt-3">
                  <p className="text-[10px] font-bold text-neutral-600 dark:text-gray-400 uppercase">{isHindi ? "2. एक्स्ट्रा मसाला/टॉपिंग चुनें:" : "2. Select Add-ons:"}</p>
                  <div className="grid grid-cols-2 gap-2 font-sans">
                    {Object.entries(PIZZA_ADDONS[normalPizzaSize.toLowerCase()] || {}).map(([addon, cost]: any) => {
                      const isSelected = !!normalPizzaAddons[addon];
                      return (
                        <button
                          type="button"
                          key={addon}
                          onClick={() => setNormalPizzaAddons(prev => ({ ...prev, [addon]: !prev[addon] }))}
                          className={`p-2.5 rounded-xl border flex justify-between items-center text-[9px] font-bold ${isSelected ? 'border-orange-500 bg-orange-500/5 text-orange-600' : 'dark:border-white/5 border-neutral-300 dark:bg-white/[0.02] bg-neutral-50 dark:text-gray-300'}`}
                        >
                          <span>{addon}</span>
                          <span className="text-orange-500 dark:text-orange-400 font-black font-mono">+₹{cost}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-6 border-t border-neutral-200 dark:border-white/5 pt-3">
                <p className="text-[10px] font-bold text-neutral-600 dark:text-gray-400 uppercase">{isHindi ? "शेफ के लिए विशेष निर्देश:" : "Special Note for Chef / Instructions:"}</p>
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {QUICK_INSTRUCTION_TAGS.map((tag: any) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => quickAppendInstruction(tag, "normal")}
                      className="text-[9px] font-bold py-1 px-2 rounded-full border dark:border-white/5 border-neutral-300 bg-neutral-100 dark:bg-neutral-800 dark:text-gray-300 text-neutral-800 hover:border-orange-500 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <textarea 
                  placeholder="e.g. Make it extra spicy, No onions, soft crust etc..." 
                  value={chefNote} 
                  onChange={(e) => setChefNote(e.target.value)} 
                  className="w-full text-xs p-3 rounded-xl dark:bg-white/[0.03] bg-neutral-50 border dark:border-white/5 border-neutral-300 text-neutral-900 outline-none focus:border-orange-500 h-16 resize-none"
                />
              </div>

              <button type="button" onClick={handleNormalPizzaAdd} className="w-full bg-orange-500 text-black p-4 rounded-xl font-black text-xs uppercase">
                {isHindi ? "कर्ट में जोड़ने की पुष्टि करें" : "Confirm Add To Cart"}
              </button>
              <button type="button" onClick={() => { setSelectedProduct(null); setNormalPizzaSize(""); setNormalPizzaPrice(0); setChefNote(""); }} className="w-full mt-3 text-neutral-500 dark:text-gray-400 font-black text-[10px] text-center uppercase">
                {isHindi ? "बंद करें" : "Close"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPACT PROFILE, LOYALTY LEDGER, & ORDER HISTORY DRAWER */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[115] flex items-end">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              className="dark:bg-[#0b0c10] bg-white w-full h-[90vh] rounded-t-3xl border-t dark:border-white/10 border-neutral-200 overflow-y-auto pb-32 p-5 max-w-lg mx-auto relative shadow-2xl transition-colors duration-200 font-sans"
            >
              <div className="w-12 h-1 bg-neutral-200 dark:bg-white/15 rounded-full mx-auto mb-4" />
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black dark:text-white text-neutral-900 font-mono">{isHindi ? "मेरा खाता और लॉयल्टी" : "My Account & Loyalty"}</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => { triggerHaptic(); setIsProfileOpen(false); }} className="p-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white text-neutral-800 rounded-full transition-all"><X size={20} /></button>
                </div>
              </div>

              {!customerDetails ? (
                <form onSubmit={handleSaveDetails} className="space-y-4">
                  <div className="text-center space-y-1.5 pb-2">
                    <User className="mx-auto text-orange-500" size={32} />
                    <h3 className="text-sm font-black dark:text-white text-neutral-900">{isHindi ? "प्रोफाइल सेटअप करें" : "Set Up Profile"}</h3>
                    <p className="text-[10px] text-neutral-600 dark:text-gray-400 font-semibold leading-normal">{isHindi ? "लॉयल्टी पॉइंट्स कमाने, सुरक्षित पिन सेटअप करने और आसान चेकआउट करने के लिए प्रोफाइल बनाएं!" : "Build your profile to unlock free loyalty codes, safety PIN checkout and fast orders!"}</p>
                  </div>
                  
                  <div className="space-y-3 text-left">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">{isHindi ? "आपका नाम" : "Your Name"}</label>
                      <input autoComplete="name" type="text" placeholder="Enter your name..." value={tempName} onChange={(e) => setTempName(e.target.value)} className="w-full dark:bg-neutral-800 bg-neutral-50 border dark:border-neutral-700 border-neutral-300 p-3 rounded-xl font-bold dark:text-white text-neutral-900 outline-none focus:border-orange-500 text-xs" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">{isHindi ? "मोबाइल नंबर" : "Mobile Number"}</label>
                      <input autoComplete="tel" type="tel" maxLength={10} placeholder="10-digit Phone Number" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)} className="w-full dark:bg-neutral-800 bg-neutral-50 border dark:border-neutral-700 border-neutral-300 p-3 rounded-xl font-bold dark:text-white text-neutral-900 outline-none focus:border-orange-500 text-xs" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase flex items-center gap-1"><Lock size={10}/> <span>{isHindi ? "सुरक्षा पिन बनाएँ (4-अंक)" : "Create 4-Digit Security PIN"}</span></label>
                      <input type="password" maxLength={4} placeholder="e.g. 1234" value={tempPin} onChange={(e) => setTempPin(e.target.value)} className="w-full dark:bg-neutral-800 bg-neutral-50 border dark:border-neutral-700 border-neutral-300 p-3 rounded-xl font-bold dark:text-white text-neutral-900 outline-none focus:border-orange-500 text-xs text-center tracking-widest font-mono" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">{isHindi ? "इनवाइट कोड (वैकल्पिक)" : "Referral Code (Optional)"}</label>
                      <input type="text" placeholder="Enter invite code..." value={tempRefCode} onChange={(e) => setTempRefCode(e.target.value)} className="w-full dark:bg-neutral-800 bg-neutral-50 border dark:border-neutral-700 border-neutral-300 p-3 rounded-xl font-bold dark:text-white text-neutral-900 outline-none focus:border-orange-500 text-xs" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-orange-500 text-black p-3.5 rounded-xl font-black text-xs uppercase shadow transition-all active:scale-95 mt-4">{isHindi ? "खाता बनाएं ➔" : "Create Account ➔"}</button>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* USER ACCOUNT VIEW */}
                  <div className="dark:bg-white/[0.02] bg-neutral-50 p-4 rounded-2xl border dark:border-white/5 border-neutral-200 flex justify-between items-center transition-colors duration-200">
                    <div>
                      <p className="text-[8px] dark:text-gray-400 text-neutral-600 font-black uppercase">Customer Profile</p>
                      <h4 className="font-black text-base text-orange-500">{customerDetails.name}</h4>
                      <p className="text-xs dark:text-gray-400 text-neutral-700 font-semibold font-mono">{customerDetails.phone}</p>
                      <p className="text-[9px] text-yellow-600 dark:text-yellow-400 font-bold mt-1 uppercase font-mono">{isHindi ? "इन्वाइट कोड:" : "Invite Code:"} {getReferralCode()}</p>
                    </div>
                    <button 
                      onClick={() => { 
                        triggerHaptic();
                        localStorage.removeItem('bb_cafe_customer'); 
                        setCustomerDetails(null); 
                        setTempName(""); 
                        setTempPhone(""); 
                        setTempPin(""); 
                      }} 
                      className="text-[9px] bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 px-3 py-2 rounded-lg font-black uppercase flex items-center gap-1 transition-all"
                    >
                      <LogOut size={12}/> {isHindi ? "लॉगआउट" : "Logout"}
                    </button>
                  </div>

                  {/* Eco-Hero Badge */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <p className="text-[8px] uppercase tracking-wider text-emerald-500 font-black">पर्यावरण संरक्षण ट्रैकर (Eco Impact)</p>
                      <h4 className="text-xs font-black dark:text-white text-neutral-900">
                        {isHindi ? `आपने बचाए: ` : "You Saved: "}<span className="text-emerald-500 text-sm font-black">{ecoCutlerySaves} {isHindi ? "प्लास्टिक चम्मच 🌳" : "Plastic Cutlery 🌳"}</span>
                      </h4>
                      <p className="text-[9px] text-neutral-500 dark:text-gray-400 font-medium">{isHindi ? "चम्मच/टिश्यू न चुनकर आपने पर्यावरण की मदद की है।" : "By skipping plastic utensils, you actively protected nature!"}</p>
                    </div>
                    {ecoCutlerySaves >= 3 && (
                      <div className="bg-emerald-500 text-black px-3 py-1.5 rounded-full border border-emerald-400/30 font-black text-[9px] flex items-center gap-1 shadow animate-pulse">
                        <Award size={12}/>
                        <span>Eco-Hero 🍃</span>
                      </div>
                    )}
                  </div>

                  <div className="dark:bg-yellow-400/5 bg-yellow-100 border border-yellow-300 dark:border-yellow-400/20 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex justify-between items-center border-b dark:border-white/10 border-yellow-200 pb-2">
                      <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 font-black text-xs uppercase"><Gift size={12}/> <span>{isHindi ? "बम बम लॉयल्टी क्लब" : "Bum Bum Loyalty Club"}</span></div>
                      <span className="text-[8px] font-black border px-2 py-0.5 rounded-full border-yellow-500/30 bg-yellow-100/30 dark:text-yellow-400 dark:border-yellow-400/30 dark:bg-yellow-400/10">
                        {getCustomerTier(customerPoints).name}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-2xl font-black dark:text-white text-neutral-900 leading-none font-mono">{customerPoints} <span className="text-[9px] dark:text-gray-400 text-neutral-700 font-black uppercase font-mono">Points</span></h4>
                        <p className="text-[8px] dark:text-gray-400 text-neutral-700 font-bold mt-1">{isHindi ? "₹100 खर्च करें = 1 पॉइंट पाएं!" : "Spend ₹100 = Get 1 Loyalty Point!"}</p>
                      </div>
                      <div className="text-right text-[8px] dark:text-yellow-400 text-amber-900 font-black space-y-0.5 uppercase max-h-20 overflow-y-auto no-scrollbar font-mono">
                        {loyaltyRules.map((rule: any) => (<p key={rule.id}>🎁 {rule.pointsCost} Pts = {rule.rewardName}</p>))}
                      </div>
                    </div>

                    {pointsHistory.length > 0 && (
                      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3 font-sans">
                        <p className="text-xs font-black uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                          <span>📜</span> {isHindi ? "पॉइंट्स पासबुक (लेन-देन विवरण):" : "Points Passbook & Ledger:"}
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {pointsHistory.map((h: any) => (
                            <div key={h.id} className="flex justify-between items-center bg-white dark:bg-neutral-900 p-3 rounded-xl border dark:border-neutral-800 border-neutral-200 shadow-sm transition-colors duration-200">
                              <div className="space-y-1">
                                <span className="text-xs font-black text-neutral-800 dark:text-gray-200 block">{h.description}</span>
                                <span className="text-[9px] text-neutral-500 dark:text-gray-400 font-bold block font-mono">
                                  {h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : new Date(h.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-0.5 font-mono ${h.type === 'earn' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {h.type === 'earn' ? '+' : '-'}{h.points} Pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-1.5 flex flex-col gap-2 font-sans">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="dark:text-gray-400 text-neutral-700 font-black uppercase">{isHindi ? "शेयर प्रोग्रेस:" : "Share Progress:"}</span>
                        <span className="text-yellow-600 dark:text-yellow-400 font-black bg-yellow-100 dark:bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-400/20 font-mono">{shareCount}/5 Shared</span>
                      </div>
                      <button type="button" onClick={handleShareApp} className="w-full bg-green-600 text-white font-black py-2.5 rounded-xl text-[10px] uppercase flex items-center justify-center gap-1 shadow-md transition-all">{isHindi ? "5 बार शेयर करके मुफ्त +1 पॉइंट कमाएं! 🎁" : "Share 5 times to earn +1 free point! 🎁"}</button>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center font-sans">
                      <span className="text-[9px] dark:text-gray-400 text-neutral-700 font-bold uppercase">{isHindi ? "दोस्त को गिफ्ट करें:" : "Gift points to a friend:"}</span>
                      <button type="button" onClick={() => { triggerHaptic(); setIsGiftModalOpen(true); }} className="bg-yellow-500/10 text-yellow-600 border border-yellow-400/20 px-2.5 py-1 rounded text-[8px] font-black uppercase">🎁 Gift Points</button>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <p className="text-[9px] dark:text-gray-400 text-neutral-700 font-black uppercase mb-1.5">{isHindi ? "सोशल मीडिया पर फॉलो करके  पॉइंट्स कमाएं:" : "Earn Points by Following Us:"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SOCIAL_LINKS.map((link: any) => (
                          <button
                            key={link.id}
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              setClaimingPlatform(link);
                              setIsClaimModalOpen(true);
                              window.open(link.url, '_blank');
                            }}
                            className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 border dark:border-white/10 border-neutral-200 px-2.5 py-1 rounded-full text-[9px] font-bold dark:text-gray-300 text-neutral-800 hover:border-yellow-400 transition-all"
                          >
                            <img src={link.icon} className="w-3.5 h-3.5 object-contain flex-shrink-0" alt="" loading="lazy" />
                            <span>{link.label.split(' ')[1]} (+{link.points} P)</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800 font-sans">
                      <p className="text-[9px] dark:text-gray-400 text-neutral-700 font-black uppercase mb-1.5">{isHindi ? "पॉइंट्स रिडीम करें (सीधे कार्ट में):" : "Redeem Points (Instantly adds to cart):"}</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto no-scrollbar font-mono">
                        {loyaltyRules.map((rule: any) => {
                          const inCartCost = cart.reduce((acc: number, i: any) => acc + (i.pointsCost || 0), 0);
                          const isAffordable = (customerPoints - inCartCost) >= rule.pointsCost;
                          return (
                            <button key={rule.id} type="button" onClick={() => handleCustomerRedeem(`reward-${rule.id}`, `🎁 FREE ${rule.rewardName}`, rule.pointsCost)} disabled={!isAffordable} className={`py-2 px-2 rounded text-[9px] font-black uppercase border truncate transition-all ${isAffordable ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500 font-bold' : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-gray-400 border-neutral-200 dark:border-white/5 cursor-not-allowed'}`}>🎁 {rule.rewardName} ({rule.pointsCost} P)</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 font-sans">
                    <h3 className="text-sm font-black dark:text-gray-200 text-neutral-900 uppercase flex items-center gap-1.5">
                      <History size={16} className="text-orange-500" />
                      <span>{isHindi ? "मेरा आर्डर इतिहास (विवरण):" : "My Order History Ledger:"}</span>
                    </h3>
                    {pastOrders.length > 0 ? (
                      <div className="space-y-4 pr-1">
                        {pastOrders.map((ord: any, index: number) => {
                          const formattedDate = ord.timestamp?.toDate ? ord.timestamp.toDate().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : new Date(ord.timestamp).toLocaleString();
                          const isHistoryTrackingDismissed = dismissedHistoryOrders.includes(ord.billNumber);

                          return (
                            <div key={index} className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 border-neutral-200 rounded-2xl p-4 space-y-3 shadow-md transition-colors duration-200 font-sans">
                              <div className="flex justify-between items-center border-b dark:border-neutral-800 border-neutral-200 pb-2 font-mono">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-black text-orange-500 font-bold">Bill: #{formatBillNumber(ord.billNumber || 0)}</span>
                                  <span className="text-[9px] text-neutral-500 dark:text-gray-400 font-bold">{formattedDate}</span>
                                </div>
                                <span className="bg-green-600/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black font-mono">
                                  Token: #{ord.tokenNumber || "N/A"}
                                </span>
                              </div>
                              
                              <div className="space-y-1.5">
                                {ord.items.map((it: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs text-neutral-800 dark:text-gray-300">
                                    <span>{it.name} <span className="text-orange-500 text-[10px]">x{it.quantity}</span></span>
                                    <span>₹{it.price * it.quantity}</span>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="border-t border-dashed dark:border-neutral-800 border-neutral-200 pt-2.5 flex justify-between items-center text-xs font-black">
                                <span className="text-neutral-500">{isHindi ? "कुल भुगतान राशि:" : "To Pay Amount:"}</span>
                                <span className="text-sm text-green-600 dark:text-green-400 font-mono">₹{ord.total}</span>
                              </div>

                              {/* Real-time Map Tracker Inside Profile History */}
                              {!isHistoryTrackingDismissed ? (
                                <div className="w-full mt-2 rounded-2xl overflow-hidden shadow">
                                  <LiveOrderTracker 
                                    isHindi={isHindi}
                                    liveOrder={ord}
                                    setLiveOrder={(val) => {
                                      if (val === null) {
                                        setDismissedHistoryOrders(prev => [...prev, ord.billNumber]);
                                      } else {
                                        setPastOrders(prev => prev.map(o => o.billNumber === ord.billNumber ? val : o));
                                      }
                                    }}
                                    formatBillNumber={formatBillNumber}
                                    whatsappNumber={whatsappNumber}
                                    triggerHaptic={triggerHaptic}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic();
                                    setDismissedHistoryOrders(prev => prev.filter(id => id !== ord.billNumber));
                                  }}
                                  className="w-full mt-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-white/5 hover:dark:bg-white/10 text-center text-[10px] font-black py-2.5 rounded-xl block border dark:border-neutral-800 border-orange-500/20 transition-all uppercase tracking-wider"
                                >
                                  {isHindi ? "लाइव ट्रैकर दिखाएं 🛵" : "Show Live Tracker 🛵"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-neutral-500 py-6 text-[10px] font-bold uppercase tracking-wider">
                        {isHindi ? "अभी तक कोई आर्डर नहीं मिला।  स्वादिष्ट आर्डर शुरू करें! 🍕" : "No orders found yet. Grab some food! 🍕"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODULAR CART DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <CartDrawer 
            isHindi={isHindi}
            isCartOpen={isCartOpen}
            setIsCartOpen={setIsCartOpen}
            cart={cart}
            addItem={addItem}
            removeItem={removeItem}
            upsellSuggestionItems={upsellSuggestionItems}
            fulfillmentType={fulfillmentType}
            setFulfillmentType={setFulfillmentType}
            ketchupAddon={ketchupAddon}
            setKetchupAddon={setKetchupAddon}
            oreganoAddon={oreganoAddon}
            setOreganoAddon={setOreganoAddon}
            chiliFlakesAddon={chiliFlakesAddon}
            setChiliFlakesAddon={setChiliFlakesAddon}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            DELIVERY_AREAS={DELIVERY_AREAS}
            lastDeliveryAddress={lastDeliveryAddress}
            address={address}
            setAddress={setAddress}
            handleDetectLocation={handleDetectLocation}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            noCutlery={noCutlery}
            setNoCutlery={setNoCutlery}
            enteredCoupon={enteredCoupon}
            setEnteredCoupon={setEnteredCoupon}
            appliedCoupon={appliedCoupon}
            handleApplyCoupon={handleApplyCoupon}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            setIsUpiPopupOpen={setIsUpiPopupOpen}
            handleCheckoutClick={handleCheckoutClick}
            isSubmittingOrder={isSubmittingOrder}
            getCartSubtotal={getCartSubtotal}
            getCartAddonsPrice={getCartAddonsPrice}
            getDeliveryCharge={getDeliveryCharge}
            getFreeDeliveryProgressPercent={getFreeDeliveryProgressPercent}
            getTotalBillPrice={getTotalBillPrice}
            getDisplayPrice={getDisplayPrice}
            triggerHaptic={triggerHaptic}
            showAddonsSection={showAddonsSection}
          />
        )}
      </AnimatePresence>

      {/* MODULAR UPI POPUP MODAL */}
      <AnimatePresence>
        {isUpiPopupOpen && (
          <UpiPaymentModal 
            isHindi={isHindi}
            isUpiPopupOpen={isUpiPopupOpen}
            setIsUpiPopupOpen={setIsUpiPopupOpen}
            getTotalBillPrice={getTotalBillPrice}
            handleLaunchUpiPay={handleLaunchUpiPay}
            handleScreenshotChange={handleScreenshotChange}
            isCompressing={isCompressing}
            paymentScreenshot={paymentScreenshot}
            setPaymentScreenshot={setPaymentScreenshot}
            sendWhatsAppOrder={sendWhatsAppOrder}
            isSubmittingOrder={isSubmittingOrder}
            triggerHaptic={triggerHaptic}
            upiId={upiId} 
          />
        )}
      </AnimatePresence>

      {/* COMPACT INSTALL BANNER GUIDE MODAL */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[270] flex items-center justify-center p-6 font-sans">
            <div className="dark:bg-[#111] bg-white w-full max-sm p-6 rounded-3xl border dark:border-white/10 border-neutral-200 text-center space-y-4 shadow-2xl transition-colors duration-200">
              <Sparkles className="mx-auto text-yellow-400 animate-bounce" size={32} />
              
              <div className="space-y-1">
                <h3 className="text-base font-black dark:text-white text-neutral-900">📲 आसान इंस्टॉलेशन गाइड</h3>
                <p className="text-[10px] text-neutral-600 dark:text-gray-400 font-bold leading-normal">
                  यदि व्यक्तिगत इंस्टॉल काम नहीं कर रहा है, तो आप नीचे दिए गए आसान चरणों से इसे होम स्क्रीन पर जोड़ सकते हैं:
                </p>
              </div>

              <div className="text-left text-xs space-y-3 text-neutral-800 dark:text-gray-300 font-medium border-y dark:border-white/5 border-neutral-200 py-4 font-sans font-bold">
                <p className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black flex-shrink-0">1</span>
                  <span>गूगल क्रोम (Chrome) में ऊपर दाईं ओर दिख रहे **तीन डॉट्स (⋮)** आइकॉन पर क्लिक करें।</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black flex-shrink-0">2</span>
                  <span>मेन्यू लिस्ट में नीचे जाकर **'Install app'** या **'Add to Home screen'** का विकल्प चुनें।</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black flex-shrink-0">3</span>
                  <span>अब **'Install'** बटन दबाएं।  बम बम कैफ़े ऐप आपके phone की होम स्क्रीन पर असली ऐप की तरह जुड़ जाएगा!</span>
                </p>
              </div>

              <button 
                onClick={() => { triggerHaptic(); setIsInstallModalOpen(false); }} 
                className="w-full bg-orange-500 text-white p-3.5 rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow"
              >
                समझ गया, बंद करें
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SECURED GIFT POINTS MODAL */}
      <AnimatePresence>
        {isGiftModalOpen && (
          <div className="fixed inset-0 bg-black/95 z-[260] flex items-center justify-center p-6 font-sans">
            <motion.form onSubmit={handleGiftPoints} className="dark:bg-[#111] bg-white w-full max-w-md p-6 rounded-3xl border dark:border-white/10 border-neutral-200 text-center space-y-4 shadow-xl transition-colors duration-200">
              <Gift className="mx-auto text-yellow-400" size={32} />
              <div>
                <h3 className="text-lg font-black text-yellow-400 uppercase italic font-mono">Gift Loyalty Points</h3>
                <p className="text-[9px] text-neutral-600 font-semibold mt-0.5">अपने पॉइंट्स किसी दोस्त को गिफ्ट करें</p>
              </div>
              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-700 dark:text-neutral-400">Friend's Phone Number</label>
                  <input type="tel" maxLength={10} placeholder="e.g. 9876543210" value={giftPhone} onChange={(e) => setGiftPhone(e.target.value)} required className="w-full dark:bg-white/10 bg-neutral-50 border dark:border-white/10 border-neutral-300 p-3 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none text-center font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-700 dark:text-neutral-400">Points to Gift (Your Pts: {customerPoints})</label>
                  <input type="number" placeholder="e.g. 10" value={giftPointsAmount} onChange={(e) => setGiftPointsAmount(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full dark:bg-white/10 bg-neutral-50 border dark:border-white/10 border-neutral-300 p-3 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none text-center font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-neutral-700 dark:text-neutral-400 flex items-center gap-1"><Lock size={10}/> <span>Your 4-Digit Security PIN (सुरक्षा पिन)</span></label>
                  <input type="password" maxLength={4} placeholder="🔒 enter your pin" value={giftSenderPin} onChange={(e) => setGiftSenderPin(e.target.value)} required className="w-full dark:bg-white/10 bg-neutral-50 border dark:border-white/10 border-neutral-300 p-3 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none text-center tracking-widest font-mono" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={isGiftingLoading} className="flex-1 bg-yellow-400 text-black font-black p-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1">
                  {isGiftingLoading ? <Loader2 className="animate-spin" size={14} /> : <span>Gift Points 🎁</span>}
                </button>
                <button type="button" onClick={() => { triggerHaptic(); setIsGiftModalOpen(false); setGiftPhone(""); setGiftPointsAmount(""); setGiftSenderPin(""); }} className="bg-neutral-100 text-neutral-800 dark:bg-white/5 dark:text-gray-400 font-bold p-3 rounded-xl text-xs">CANCEL</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* VERIFIED SOCIAL POINTS CLAIM MODAL */}
      <AnimatePresence>
        {isClaimModalOpen && claimingPlatform && (
          <div className="fixed inset-0 bg-black/95 z-[260] flex items-center justify-center p-6 font-sans">
            <motion.form 
              onSubmit={handleClaimSubmit}
              className="dark:bg-[#111] bg-white w-full max-sm p-6 rounded-3xl border dark:border-white/10 border-neutral-200 text-center space-y-4 shadow-xl"
            >
              <img src={claimingPlatform.icon} className="w-10 h-10 object-contain mx-auto" alt="" loading="lazy" />
              <div className="space-y-1">
                <h3 className="text-base font-black text-orange-600 dark:text-orange-500 uppercase">वेरिफिकेशन दावा सबमिट करें</h3>
                <p className="text-[10px] text-neutral-600 leading-normal font-semibold">
                  {claimingPlatform.label} पर फॉलो/सब्सक्राइब करने के बाद, नीचे अपना यूज़रनेम दर्ज करें। हमारे एडमिन इसकी जांच करके आपका {claimingPlatform.points} पॉइंट क्रेडिट करेंगे!
                </p>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black uppercase text-neutral-700 dark:text-neutral-400">Your Profile Handle / Username</label>
                <input 
                  type="text" 
                  placeholder="e.g. @yourname" 
                  value={claimUsername} 
                  onChange={(e) => setClaimUsername(e.target.value)} 
                  required 
                  className="w-full dark:bg-white/10 bg-neutral-50 border dark:border-white/10 border-neutral-300 p-3 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none text-center font-mono" 
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={isClaimingLoading} className="flex-1 bg-yellow-400 text-black font-black p-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1">
                  {isClaimingLoading ? <Loader2 className="animate-spin" size={14} /> : <span>Claim Reward Request ➔</span>}
                </button>
                <button 
                  type="button" 
                  onClick={() => { triggerHaptic(); setIsClaimModalOpen(false); setClaimUsername(""); }} 
                  className="bg-neutral-100 text-neutral-800 dark:bg-white/5 dark:text-gray-400 p-3 rounded-xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}


