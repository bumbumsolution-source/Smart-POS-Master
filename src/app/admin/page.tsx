'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase'; 
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  Power, 
  LogOut, 
  Loader2, 
  Lock, 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  Users, 
  Award, 
  Settings, 
  Menu as MenuIcon, 
  X,
  Download // <-- Download आइकॉन इम्पोर्ट किया गया है
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// यूटिलिटी फ़ंक्शंस
import { sha256, formatBillNumber } from '../../lib/utils';

// चाइल्ड मॉड्यूल कंपोनेंट्स
import DashboardStats from '@/components/admin/DashboardStats';
import OrdersTab from '@/components/admin/OrdersTab';
import MenuTab from '@/components/admin/MenuTab';
import CustomersTab from '@/components/admin/CustomersTab';
import LoyaltyTab from '@/components/admin/LoyaltyTab';
import SettingsTab from '@/components/admin/SettingsTab';

// CSV/Excel डाउनलोड कराने का ग्लोबल हेल्पर फ़ंक्शन
const triggerCsvDownload = (data: any[], filename: string, headers: string[], keys: string[]) => {
  if (data.length === 0) return toast.error("No data available to export!");

  const csvRows = [];
  csvRows.push(headers.join(','));
  
  data.forEach(item => {
    const values = keys.map(key => {
      let value = item[key];
      if (value === undefined || value === null) value = '';
      const escaped = String(value).replace(/"/g, '""'); 
      return `"${escaped}"`; 
    });
    csvRows.push(values.join(','));
  });

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success("Excel Data Exported!");
};

export default function AdminDashboard() {
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // टाइपस्क्रिप्ट टैब एलीआस लिस्ट
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'menu' | 'categories' | 'customers' | 'loyalty' | 'banners' | 'reels' | 'header_video' | 'reviews' | 'coupons' | 'roster' | 'proofs' | 'claims' | 'security' | 'settings'>('dashboard');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [storeOpen, setStoreOpen] = useState(true);

  // ऑर्डर्स फ़िल्टर स्टेट्स
  const [orderPeriodFilter, setOrderPeriodFilter] = useState<'today' | 'yesterday' | 'week'>('today');

  // एक्सटेंडेड कलेक्शन्स स्टेट्स
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [socialProofs, setSocialProofs] = useState<any[]>([]);
  const [pointsClaims, setPointsClaims] = useState<any[]>([]);
  const [loyaltyUsers, setLoyaltyUsers] = useState<any[]>([]);
  const [loyaltyRules, setLoyaltyRules] = useState<any[]>([]);
  const [transferLogs, setTransferLogs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [cafeHelperUsers, setCafeHelperUsers] = useState<any[]>([]);

  // रीयल-टाइम पासकोड्स और रोल
  const [passcodes, setPasscodes] = useState({ adminPin: "", managerPin: "" });
  const [userRole, setUserRole] = useState<'admin' | 'manager' | null>(null);

  // सेल्स डेट रेंज फ़िल्टर्स
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); 
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); 

  const prevOrdersCountRef = useRef<number | null>(null);

  const playNewOrderBeep = () => {
    try {
      const audio = new Audio('/admin.mp3');
      audio.play().catch((err) => console.log("Sound play blocked by browser:", err));
    } catch (e) {}
  };

  const applyQuickSalesFilter = (type: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    if (type === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (type === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(weekAgo.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      setStartDate(monthAgo.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
    toast.success(`Filter Applied: ${type.toUpperCase()}`);
  };

  const handleResetSalesData = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7); 
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    toast.success("Filters reset to last 7 days.");
  };

  const handleSendDailyClosingReport = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => {
      if (!o.timestamp) return false;
      const oDate = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
      return oDate.toISOString().split('T')[0] === todayStr;
    });

    const totalSales = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalOrdersCount = todayOrders.length;
    const deliveredOrders = todayOrders.filter(o => o.status === 'delivered').length;

    const reportText = encodeURIComponent(
`*BUM BUM CAFE - DAILY CLOSING REPORT (${todayStr})*
----------------------------------
*Total Orders Today :* ${totalOrdersCount}
*Delivered Orders   :* ${deliveredOrders}
*Total Revenue Today:* ₹${totalSales}
----------------------------------
Report Generated at: ${new Date().toLocaleTimeString()}`
    );

    window.open(`https://wa.me/919714293759?text=${reportText}`, '_blank');
    toast.success("Closing Report Sent via WhatsApp!");
  };

  const handleExportOrders = () => {
    const filteredOrders = orders.filter(o => {
      if (!o.timestamp) return false;
      const oDate = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
      const oStr = oDate.toISOString().split('T')[0];
      return oStr >= startDate && oStr <= endDate;
    });

    const headers = ["Bill Number", "Token Number", "Customer Name", "Phone", "Total Amount", "Status", "Date"];
    const keys = ["billNumber", "tokenNumber", "customerName", "customerPhone", "total", "status", "timestamp"];

    const dataToExport = filteredOrders.map(o => {
      let dateStr = "";
      if (o.timestamp) {
        const d = o.timestamp.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
        dateStr = d.toLocaleString();
      }
      return {
        ...o,
        billNumber: formatBillNumber(o.billNumber || 0),
        timestamp: dateStr
      };
    });

    triggerCsvDownload(dataToExport, `orders_report_${startDate}_to_${endDate}`, headers, keys);
  };

  // 🔹 यह फंक्शन Customers Tab में पास किया जाएगा (Total Orders & Total Spent के साथ)
  const handleExportCustomers = () => {
    const headers = ["ID/Phone", "Name", "Points", "Tier", "Total Orders", "Total Spent (Rs)"];
    const keys = ["id", "name", "points", "tier", "totalOrders", "totalSpent"];
    
    const dataToExport = loyaltyUsers.map(u => {
      const userOrders = orders.filter(o => o.customerPhone === u.id || o.customerId === u.id);
      const totalOrdersCount = userOrders.length;
      const totalSpentAmount = userOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      return {
        id: u.id || "",
        name: u.name || "Guest",
        points: u.points || 0,
        tier: u.tier || "Bronze",
        totalOrders: totalOrdersCount,
        totalSpent: totalSpentAmount
      };
    });

    triggerCsvDownload(dataToExport, "customers_detailed_report", headers, keys);
  };

  useEffect(() => {
    const adminSession = sessionStorage.getItem('bb_cafe_admin_verified');
    const adminRole = sessionStorage.getItem('bb_cafe_admin_role') as 'admin' | 'manager' | null;
    if (adminSession === 'true' && adminRole) {
      setIsVerified(true);
      setUserRole(adminRole);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubPasscodes = onSnapshot(doc(db, "settings", "passcodes"), async (d) => {
      if (d.exists()) {
        const loaded = {
          adminPin: d.data().adminPin || "",
          managerPin: d.data().managerPin || ""
        };
        if (!loaded.adminPin || !loaded.managerPin) {
          const hashedAdmin = await sha256("971429");
          const hashedManager = await sha256("123456");
          await setDoc(doc(db, "settings", "passcodes"), {
            adminPin: hashedAdmin,
            managerPin: hashedManager
          }, { merge: true });
        } else {
          setPasscodes(loaded);
        }
      } else {
        const hashedAdmin = await sha256("971429");
        const hashedManager = await sha256("123456");
        await setDoc(doc(db, "settings", "passcodes"), {
          adminPin: hashedAdmin,
          managerPin: hashedManager
        });
      }
    });
    return () => unsubPasscodes();
  }, []);

  useEffect(() => {
    if (!isVerified) return;

    const qOrders = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const currentOrdersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (prevOrdersCountRef.current !== null && currentOrdersList.length > prevOrdersCountRef.current) {
        playNewOrderBeep();
        toast.success("🚨 ALERT: Naya Online Order Received!");
      }
      prevOrdersCountRef.current = currentOrdersList.length;
      setOrders(currentOrdersList);
    });

    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCats = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStore = onSnapshot(doc(db, "settings", "store"), (d) => {
      if (d.exists()) {
        setStoreOpen(d.data().isOpen);
      }
    });

    const unsubBanners = onSnapshot(collection(db, "banners"), (snap) => {
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReels = onSnapshot(collection(db, "reels"), (snap) => {
      setReels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCoupons = onSnapshot(collection(db, "coupons"), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReviews = onSnapshot(collection(db, "reviews"), (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLoyalty = onSnapshot(collection(db, "customer_points"), (snap) => {
      setLoyaltyUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRules = onSnapshot(collection(db, "loyalty_rules"), (snap) => {
      setLoyaltyRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubProofs = onSnapshot(collection(db, "social_proofs"), (snap) => {
      setSocialProofs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubClaims = onSnapshot(collection(db, "points_claims"), (snap) => {
      setPointsClaims(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTransfers = onSnapshot(collection(db, "point_transfers"), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => {
        const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return tB - tA;
      });
      setTransferLogs(logs);
    });

    const unsubStaff = onSnapshot(collection(db, "staff_members"), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCafeHelperUsers = onSnapshot(collection(db, "cafe_users"), (snap) => {
      setCafeHelperUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubCats();
      unsubStore();
      unsubBanners();
      unsubReels();
      unsubCoupons();
      unsubReviews();
      unsubLoyalty();
      unsubRules();
      unsubProofs();
      unsubClaims();
      unsubTransfers();
      unsubStaff();
      unsubCafeHelperUsers();
    };
  }, [isVerified]);

  const verifyPasscode = async (entered: string, stored: string) => {
    if (!stored) return false;
    if (stored.length === 64) {
      const hashed = await sha256(entered);
      return hashed === stored;
    }
    return entered === stored;
  };

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = passcode.trim();

    if (entered === "BUM_BUM_RECOVERY_2026") {
      const hashedAdmin = await sha256("971429");
      const hashedManager = await sha256("123456");
      await setDoc(doc(db, "settings", "passcodes"), {
        adminPin: hashedAdmin,
        managerPin: hashedManager
      }, { merge: true });
      toast.success("Master recovery key activated! Default PINs restored.");
      setPasscode("");
      return;
    }

    const isAdminMatched = await verifyPasscode(entered, passcodes.adminPin);
    const isManagerMatched = await verifyPasscode(entered, passcodes.managerPin);

    if (isAdminMatched) {
      sessionStorage.setItem('bb_cafe_admin_verified', 'true');
      sessionStorage.setItem('bb_cafe_admin_role', 'admin');
      setIsVerified(true);
      setUserRole('admin');
      toast.success("Welcome back, Boss!");
    } else if (isManagerMatched) {
      sessionStorage.setItem('bb_cafe_admin_verified', 'true');
      sessionStorage.setItem('bb_cafe_admin_role', 'manager');
      setIsVerified(true);
      setUserRole('manager');
      toast.success("Logged in as Cafe Manager!");
    } else {
      toast.error("Incorrect Security Key!");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('bb_cafe_admin_verified');
    sessionStorage.removeItem('bb_cafe_admin_role');
    setIsVerified(false);
    setUserRole(null);
    window.location.href = "/";
  };

  const handleStatusChange = async (order: any, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", order.id), { status: newStatus });
      toast.success("Status Sync Success!");

      if (newStatus === "delivered") {
        toast.loading("Syncing to Loyverse POS...", { id: "pos-sync" });
        try {
          const response = await fetch('/api/loyverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
          });
          const result = await response.json();
          
          if (result.success) {
            toast.success("Synced with Loyverse POS!", { id: "pos-sync" });
          } else {
            console.error("Loyverse Sync Error:", result.error, result.details);
            toast.error(`POS Sync Failed: ${result.error || "Unknown Error"}`, { id: "pos-sync" });
          }
        } catch (err) {
          console.error("Fetch POS error:", err);
          toast.error("Network error during POS sync.", { id: "pos-sync" });
        }
      }
    } catch (e) {
      toast.error("Failed to Sync Status.");
    }
  };

  const handlePrintReceipt = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      return toast.error("Please allow pop-ups in your browser to print the bill.");
    }

    const formattedBillNo = formatBillNumber(order.billNumber || 0);
    const orderDate = order.timestamp?.toDate ? order.timestamp.toDate().toLocaleString() : new Date(order.timestamp).toLocaleString();

    const itemsRows = order.items?.map((item: any) => `
      <tr>
        <td style="padding: 6px 0; font-size: 13px;">${item.name}</td>
        <td style="padding: 6px 0; font-size: 13px; text-align: center;">x${item.quantity}</td>
        <td style="padding: 6px 0; font-size: 13px; text-align: right;">₹${item.price * item.quantity}</td>
      </tr>
    `).join('') || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Bill_#${formattedBillNo}</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              color: #000; 
              background: #fff; 
              padding: 20px; 
              width: 320px; 
              margin: 0 auto;
            }
            .text-center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            .total-row { font-weight: bold; font-size: 15px; }
            .qr-container { margin-top: 15px; text-align: center; }
            .qr-image { width: 180px; height: auto; display: block; margin: 10px auto; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">BUM BUM CAFE</h2>
            <p style="margin: 3px 0; font-size: 11px;">Mohandra, Panna (M.P.)</p>
            <p style="margin: 3px 0; font-size: 11px;">Mobile: +91 9714293759</p>
          </div>
          <div class="divider"></div>
          <div style="font-size: 12px; line-height: 1.5;">
            <div><b>Bill No  :</b> #${formattedBillNo}</div>
            <div><b>Token No :</b> #${order.tokenNumber || 'N/A'}</div>
            <div><b>Date     :</b> ${orderDate}</div>
            <div><b>Name     :</b> ${order.customerName || 'Guest'}</div>
            <div><b>Phone    :</b> ${order.customerPhone || 'N/A'}</div>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; font-size: 12px; padding-bottom: 5px;">Item</th>
                <th style="text-align: center; font-size: 12px; padding-bottom: 5px;">Qty</th>
                <th style="text-align: right; font-size: 12px; padding-bottom: 5px;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="divider"></div>
          <table style="font-size: 13px;">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">₹${order.subtotal || order.total}</td>
            </tr>
            ${order.discount ? `
            <tr>
              <td>Discount:</td>
              <td style="text-align: right;">-₹${order.discount}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td style="padding-top: 5px; font-size: 16px;">GRAND TOTAL:</td>
              <td style="text-align: right; padding-top: 5px; font-size: 16px;">₹${order.total}</td>
            </tr>
          </table>
          <div class="qr-container">
            <p style="margin: 0; font-size: 11px; font-weight: bold;">Scan with PhonePe / UPI to Pay</p>
            <img class="qr-image" src="/phonepe-qr.png" alt="Payment QR" />
          </div>
          <div class="divider"></div>
          <p class="text-center" style="margin: 5px 0 0 0; font-size: 12px; font-weight: bold;">Thank You! Visit Again!</p>
          <div class="text-center no-print" style="margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #f97316; color: white; border: none; border-radius: 8px; cursor: pointer;">Print / Save as PDF</button>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendWhatsAppBill = (order: any) => {
    const phone = String(order.customerPhone || "").replace("+91", "").trim();
    if (!phone) return toast.error("Customer phone not found!");
    const formattedBillNo = formatBillNumber(order.billNumber || 0);
    const itemsText = order.items?.map((i: any) => `• ${i.name} (x${i.quantity}) - ₹${i.price * i.quantity}`).join('\n') || '';

    const message = encodeURIComponent(
`*BUM BUM CAFE - INVOICE*
--------------------------
*Bill No:* #${formattedBillNo}
*Token :* #${order.tokenNumber || 'N/A'}
--------------------------
${itemsText}
--------------------------
*Subtotal:* ₹${order.subtotal || order.total}
${order.discount ? `*Discount:* -₹${order.discount}\n` : ''}*Grand Total:* *₹${order.total}*

Thank you for your order, *${order.customerName || 'Guest'}*! Visit Again! 😊`
    );
    window.open(`https://wa.me/91${phone}?text=${message}`, '_blank');
  };

  const toggleStore = async () => {
    try {
      await setDoc(doc(db, "settings", "store"), { isOpen: !storeOpen }, { merge: true });
      toast.success(storeOpen ? "Cafe is now OFFLINE 🔴" : "Cafe is now ONLINE 🟢");
    } catch (e) { toast.error("Error toggling store"); }
  };

  if (loading) {
    return (
      <div className="bg-[#050505] min-h-screen text-white flex flex-col items-center justify-center font-sans">
        <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Securing Session...</p>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="bg-[#050505] min-h-screen text-white flex items-center justify-center p-4 font-sans">
        <link rel="manifest" href="/admin-manifest.json" />
        <Toaster />
        <div className="w-full max-w-md bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-2xl text-center relative overflow-hidden">
          <div className="inline-flex p-4 bg-orange-500/10 rounded-full text-orange-500 mb-2">
            <Lock size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-orange-500 italic uppercase">Staff Portal</h2>
            <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Bum Bum Cafe Mohandra</p>
          </div>

          <form onSubmit={handlePasscodeLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Enter Access Key" 
              value={passcode} 
              onChange={(e) => setPasscode(e.target.value)} 
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-center outline-none focus:border-orange-500 text-sm font-bold text-white tracking-widest"
              required 
            />
            <button 
              type="submit" 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.98]"
            >
              Authorize & Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
    { id: 'menu', label: 'Menu List', icon: UtensilsCrossed },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'loyalty', label: 'Loyalty System', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings, highlight: true }
  ];

  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans flex flex-col md:flex-row relative">
      <link rel="manifest" href="/admin-manifest.json" />
      <Toaster />

      <header className="md:hidden w-full p-4 bg-white/[0.03] border-b border-white/5 flex justify-between items-center sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 bg-white/5 rounded-xl hover:bg-white/10"
          >
            {mobileMenuOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
          <div>
            <h1 className="text-sm font-black text-orange-500 italic uppercase">BUM BUM CAFE</h1>
            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Control Center</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleStore} className={`px-3 py-1.5 rounded-full text-[8px] font-black flex items-center gap-1.5 border ${storeOpen ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
            <Power size={10} /> {storeOpen ? "ON" : "OFF"}
          </button>
          <button onClick={handleLogout} className="p-1.5 bg-white/5 rounded-full text-gray-400 active:scale-90"><LogOut size={14}/></button>
        </div>
      </header>

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col justify-between transition-transform duration-300 ease-in-out
        md:sticky md:top-0 md:h-screen md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-orange-500 italic uppercase tracking-wider">Bum Bum Cafe</h2>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{userRole === 'admin' ? 'Owner / Boss' : 'Manager Portal'}</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400 p-1 bg-white/5 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <button 
            onClick={toggleStore} 
            className={`w-full py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all border ${
              storeOpen 
                ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20' 
                : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
            }`}
          >
            <Power size={12} /> STORE STATUS: {storeOpen ? "ONLINE" : "OFFLINE"}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id as any);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : item.highlight 
                      ? 'bg-white/[0.03] text-orange-400 hover:bg-white/[0.06] border border-orange-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                {item.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Authorized As</span>
              <span className="text-xs font-black text-white/80 uppercase">{userRole}</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="p-3 bg-white/5 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all"
              title="Logout from admin panel"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
        />
      )}

      <main className="flex-1 w-full flex flex-col min-h-screen overflow-x-hidden">
        <div className="p-4 md:p-8 max-w-4xl w-full mx-auto">
          
          <div className="hidden md:flex justify-between items-center mb-8 pb-6 border-b border-white/5">
            <div>
              <p className="text-[10px] text-gray-500 font-black tracking-widest uppercase">Bum Bum Cafe Admin</p>
              <h2 className="text-2xl font-black text-white uppercase italic">
                {navItems.find(n => n.id === tab)?.label || tab}
              </h2>
            </div>
            <div className="text-[10px] font-bold text-gray-400 bg-white/5 px-4 py-2 rounded-xl">
              System Sync: Live 🟢
            </div>
          </div>

          {/* 1. डैशबोर्ड टैब */}
          {tab === 'dashboard' && (
            <DashboardStats 
              orders={orders}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              applyQuickSalesFilter={applyQuickSalesFilter}
              handleResetSalesData={handleResetSalesData}
              handleSendDailyClosingReport={handleSendDailyClosingReport}
              handleExportOrders={handleExportOrders}
              handleExportCustomers={handleExportCustomers}
              setSelectedCustomerHistory={() => {}}
            />
          )}

          {/* 2. लाइव ऑर्डर्स टैब */}
          {tab === 'orders' && (
            <OrdersTab 
              orders={orders}
              orderPeriodFilter={orderPeriodFilter}
              setOrderPeriodFilter={setOrderPeriodFilter}
              handlePrintReceipt={handlePrintReceipt}
              handleSendWhatsAppBill={handleSendWhatsAppBill}
              handleStatusChange={handleStatusChange}
              formatBillNumber={formatBillNumber}
            />
          )}

          {/* 3. मेन्यू लिस्ट टैब */}
          {tab === 'menu' && (
            <MenuTab 
              menu={menu}
              categories={categories}
            />
          )}

          {/* 4. कस्टमर्स मैनेजमेंट टैब */}
          {/* 🔹 यहाँ हमने onExportCSV पास किया है */}
          {tab === 'customers' && (
            <CustomersTab 
              loyaltyUsers={loyaltyUsers}
              orders={orders}
              onExportCSV={handleExportCustomers}
            />
          )}

          {/* 5. लॉयल्टी और ट्रांसफर लॉग्स टैब */}
          {tab === 'loyalty' && (
            <LoyaltyTab 
              loyaltyRules={loyaltyRules}
              transferLogs={transferLogs}
            />
          )}

          {/* 6. मास्टर सेटिंग्स टैब */}
          {tab === 'settings' && (
            <SettingsTab 
              banners={banners}
              reels={reels}
              coupons={coupons}
              reviews={reviews}
              socialProofs={socialProofs}
              pointsClaims={pointsClaims}
              staff={staff}
              cafeHelperUsers={cafeHelperUsers}
              passcodes={passcodes}
              userRole={userRole}
              storeOpen={storeOpen}
            />
          )}

        </div>
      </main>
    </div>
  );
}
