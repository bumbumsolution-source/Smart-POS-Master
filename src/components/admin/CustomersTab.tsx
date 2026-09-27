'use client';
import React, { useState, useMemo } from 'react';
import { db } from '../../lib/firebase'; // अपनी लोकेशन के अनुसार पाथ सेट करें
import { doc, setDoc, collection, addDoc, doc as firestoreDoc } from 'firebase/firestore';
import { User, Search, Share2, Edit, Trash, X, Phone, MapPin, Calendar, Check, MessageSquare, Filter, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBillNumber } from '../../lib/utils'; // अपनी लोकेशन के अनुसार पाथ सेट करें

// यहाँ हमने onExportCSV प्रॉप जोड़ा है ताकि डैशबोर्ड से फंक्शन यहाँ आ सके
interface CustomersTabProps {
  loyaltyUsers: any[];
  orders: any[];
  onExportCSV?: () => void; 
}

export default function CustomersTab({ loyaltyUsers, orders, onExportCSV }: CustomersTabProps) {
  // सर्च और एडिटिंग स्टेट्स
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPoints, setEditCustomerPoints] = useState(0);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<any>(null);

  // ब्रॉडकास्ट और फिल्टर्स स्टेट्स
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("Special Offer from Bum Bum Cafe! Get 10% OFF on all Special Pizzas today! 🍕🔥");
  const [broadcastTierFilter, setBroadcastTierFilter] = useState<string>('all');
  const [broadcastMinPoints, setBroadcastMinPoints] = useState<number>(0);
  const [broadcastMinSpend, setBroadcastMinSpend] = useState<number>(0);
  const [sentBroadcastPhones, setSentBroadcastPhones] = useState<string[]>([]);

  // डेटाबेस से कंबाइंड कस्टमर्स की लिस्ट तैयार करना (रजिस्टर + नॉन-रजिस्टर)
  const combinedCustomers = useMemo(() => {
    const customersMap = new Map();
    loyaltyUsers.forEach(user => {
      const cleanPhone = String(user.id || user.phone || "").replace("+91", "").trim();
      customersMap.set(cleanPhone, {
        id: cleanPhone,
        phone: cleanPhone,
        name: user.name || "Customer",
        points: user.points || 0,
        isRegistered: true
      });
    });

    orders.forEach(order => {
      if (!order.customerPhone) return;
      const cleanPhone = String(order.customerPhone).replace("+91", "").trim();
      if (!customersMap.has(cleanPhone)) {
        customersMap.set(cleanPhone, {
          id: cleanPhone,
          phone: cleanPhone,
          name: order.customerName || "Customer",
          points: 0,
          isRegistered: false
        });
      }
    });

    return Array.from(customersMap.values());
  }, [loyaltyUsers, orders]);

  // सर्च फ़िल्टर
  const searchedCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return combinedCustomers;
    const q = customerSearchQuery.toLowerCase().trim();
    return combinedCustomers.filter(c => 
      String(c.name).toLowerCase().includes(q) || 
      String(c.phone).includes(q)
    );
  }, [combinedCustomers, customerSearchQuery]);

  // कस्टमर का कुल खर्च, आर्डर हिस्ट्री और VIP टियर निकालना
  const getCustomerLoyaltyMetrics = (phone: string) => {
    const targetPhone = String(phone).replace("+91", "").trim();
    const customerOrders = orders.filter(o => {
      const oPhone = o.customerPhone ? String(o.customerPhone).replace("+91", "").trim() : "";
      return oPhone === targetPhone;
    });

    const totalSpend = customerOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const orderCount = customerOrders.length;
    
    let tier = "Bronze Member 🥉";
    let tierColor = "text-gray-400 border-gray-500/20 bg-gray-500/5";
    if (totalSpend >= 5000 || orderCount >= 25) {
      tier = "Platinum VIP 👑";
      tierColor = "text-indigo-400 border-indigo-500/20 bg-indigo-500/10 font-black";
    } else if (totalSpend >= 2000 || orderCount >= 10) {
      tier = "Gold VIP 🥇";
      tierColor = "text-yellow-400 border-yellow-500/20 bg-yellow-500/10 font-extrabold";
    } else if (totalSpend >= 800 || orderCount >= 3) {
      tier = "Silver Member 🥈";
      tierColor = "text-gray-300 border-gray-400/20 bg-gray-400/10 font-bold";
    }

    return {
      orderCount,
      totalSpend,
      tier,
      tierColor,
      customerOrders
    };
  };

  // ब्रॉडकास्ट के लिए टार्गेटेड ऑडियंस लिस्ट निकालना
  const broadcastTargetedCustomers = useMemo(() => {
    return searchedCustomers.map(user => {
      const metrics = getCustomerLoyaltyMetrics(user.phone);
      return { ...user, metrics };
    }).filter(user => {
      if (broadcastTierFilter !== 'all') {
        const tLower = user.metrics.tier.toLowerCase();
        if (broadcastTierFilter === 'platinum' && !tLower.includes('platinum')) return false;
        if (broadcastTierFilter === 'gold' && !tLower.includes('gold')) return false;
        if (broadcastTierFilter === 'silver' && !tLower.includes('silver')) return false;
        if (broadcastTierFilter === 'bronze' && !tLower.includes('bronze')) return false;
      }

      if (Number(user.points || 0) < broadcastMinPoints) return false;
      if (Number(user.metrics.totalSpend || 0) < broadcastMinSpend) return false;

      return true;
    });
  }, [searchedCustomers, broadcastTierFilter, broadcastMinPoints, broadcastMinSpend]);

  // कस्टमर डिटेल्स एडिट करना
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerName) return toast.error("Name is required!");
    try {
      await setDoc(doc(db, "customer_points", editingCustomer.phone), {
        name: editCustomerName,
        phone: editingCustomer.phone,
        points: Number(editCustomerPoints),
        lastActive: new Date()
      }, { merge: true });
      setEditingCustomer(null);
      toast.success("Customer profile updated!");
    } catch (err) {
      toast.error("Failed to update profile.");
    }
  };

  // CSV फाइल से कस्टमर्स इम्पोर्ट करना
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.loading("Processing Excel/CSV Import...", { id: "csv-import" });
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        
        if (lines.length <= 1) {
          toast.error("File is empty or invalid!", { id: "csv-import" });
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const columns = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());
          
          let name = columns[0] || "Customer";
          let phone = columns[1] || "";
          let points = Number(columns[2]) || 0;

          if (!phone && name && /^\d+$/.test(name)) {
            phone = name;
            name = "Customer";
          }

          const cleanPhone = phone.replace("+91", "").replace(/\s+/g, "").trim();

          if (!cleanPhone || cleanPhone.length < 10) {
            failCount++;
            continue;
          }

          await setDoc(doc(db, "customer_points", cleanPhone), {
            name: name,
            phone: cleanPhone,
            points: points,
            lastActive: new Date()
          }, { merge: true });

          successCount++;
        }

        toast.success(`Successfully imported ${successCount} customers!`, { 
          id: "csv-import", 
          duration: 5000 
        });
      } catch (err) {
        console.error("CSV Parsing Error:", err);
        toast.error("Failed to parse and import file.", { id: "csv-import" });
      }
    };

    reader.readAsText(file);
    e.target.value = ""; 
  };

  // व्हाट्सएप ब्रॉडकास्ट ट्रिगर करना
  const triggerWhatsAppBroadcast = (phone: string) => {
    const cleanPhone = String(phone).replace("+91", "").trim();
    const encodedMsg = encodeURIComponent(broadcastMessage);
    window.open(`https://wa.me/91${cleanPhone}?text=${encodedMsg}`, '_blank');

    if (!sentBroadcastPhones.includes(cleanPhone)) {
      setSentBroadcastPhones(prev => [...prev, cleanPhone]);
    }
  };

  const handleSendNextUnsentBroadcast = () => {
    const unsentList = broadcastTargetedCustomers.filter(u => !sentBroadcastPhones.includes(u.phone));
    if (unsentList.length === 0) {
      return toast.error("All targeted customers have been messaged in this session!");
    }
    const nextTarget = unsentList[0];
    triggerWhatsAppBroadcast(nextTarget.phone);
    toast.success(`Opening WhatsApp for ${nextTarget.name}...`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-xl font-black text-orange-500 uppercase tracking-wider flex items-center gap-2">
          <User size={20}/> Customer Management
        </h3>
        
        {/* === यहाँ हमने Export CSV का बटन जोड़ा है === */}
        <div className="flex gap-2">
          {onExportCSV && (
            <button 
              onClick={onExportCSV} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-4 py-2.5 rounded-full flex items-center gap-1.5 uppercase shadow-md transition-all"
            >
              <Download size={13}/> Export CSV
            </button>
          )}

          <label className="bg-[#facc15] hover:bg-yellow-600 text-black font-black text-[10px] px-4 py-2.5 rounded-full flex items-center gap-1.5 uppercase cursor-pointer transition-all">
            Import CSV
            <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>

          <button onClick={() => setShowBroadcastModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-black text-[10px] px-4 py-2.5 rounded-full flex items-center gap-1.5 uppercase shadow-md transition-all">
            <Share2 size={13}/> Broadcast Blast
          </button>
        </div>
      </div>

      {/* सर्च बार */}
      <div className="sticky top-[73px] z-30 bg-[#050505]/95 backdrop-blur-md py-4 border-b border-white/5 rounded-b-3xl shadow-lg">
        <div className="relative group max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search customer by name or mobile number..." 
            value={customerSearchQuery} 
            onChange={(e) => setCustomerSearchQuery(e.target.value)}
            className="w-full bg-white text-black py-3 px-11 rounded-xl outline-none text-xs font-semibold"
          />
        </div>
      </div>
      
      {/* कस्टमर डिटेल्स एडिट करने का फॉर्म */}
      {editingCustomer && (
        <form onSubmit={handleUpdateCustomer} className="bg-[#151515] border-2 border-orange-500 p-6 rounded-[2.5rem] space-y-4">
          <h4 className="text-sm font-black text-orange-500 uppercase">Edit Customer Profile</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Customer Name</label>
              <input type="text" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none text-xs font-black text-white" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Adjust Points</label>
              <input type="number" value={editCustomerPoints} onChange={(e) => setEditCustomerPoints(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none text-xs font-black text-white" required />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 text-white p-3 rounded-xl font-black text-xs uppercase">Save Changes</button>
            <button type="button" onClick={() => setEditingCustomer(null)} className="bg-white/5 text-gray-400 p-3 rounded-xl font-black text-xs uppercase">Cancel</button>
          </div>
        </form>
      )}

      {/* कस्टमर्स की लिस्ट */}
      <div className="space-y-4">
        {searchedCustomers.length === 0 ? (
          <p className="text-center text-xs font-bold text-gray-500 py-10 uppercase">No matching customers found...</p>
        ) : (
          searchedCustomers
            .map(user => ({ ...user, metrics: getCustomerLoyaltyMetrics(user.phone) }))
            .sort((a, b) => b.metrics.totalSpend - a.metrics.totalSpend)
            .map(user => (
              <div key={user.id} className="bg-[#111] border border-white/5 p-5 rounded-3xl flex justify-between items-center hover:border-white/10">
                <div className="space-y-1 cursor-pointer flex-1" onClick={() => setSelectedCustomerHistory(user)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-sm text-white hover:text-orange-500">{user.name} ➡️</h4>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${user.metrics.tierColor}`}>
                      {user.metrics.tier}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-orange-500">+{user.phone}</p>
                  
                  <div className="flex gap-3 text-[10px] text-gray-400 font-bold pt-1.5 border-t border-white/5 mt-2">
                    <p>Orders: <span className="text-white font-black">{user.metrics.orderCount}</span></p>
                    <p>Total Spend: <span className="text-green-400 font-black">₹{user.metrics.totalSpend}</span></p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-4 flex-shrink-0">
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase">Available Points</p>
                    <h4 className="text-lg font-black text-yellow-400">{user.points || 0} Pts</h4>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingCustomer(user);
                      setEditCustomerName(user.name);
                      setEditCustomerPoints(user.points || 0);
                    }}
                    className="p-3 bg-orange-500/10 text-orange-500 rounded-xl"
                  >
                    <Edit size={16}/>
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      {/* --- CUSTOMER ORDER HISTORY MODAL --- */}
      {selectedCustomerHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/5 p-6 rounded-[2.5rem] w-full max-w-lg relative max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
            <button 
              onClick={() => setSelectedCustomerHistory(null)} 
              className="absolute top-4 right-4 p-2 bg-white/5 text-gray-400 hover:text-white rounded-full transition-all"
            >
              <X size={18}/>
            </button>
            <div className="text-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-black text-orange-500 uppercase">{selectedCustomerHistory.name} - Order History</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Mobile: +{selectedCustomerHistory.phone}</p>
            </div>

            <div className="space-y-3">
              {selectedCustomerHistory.metrics?.customerOrders.length === 0 ? (
                <p className="text-center text-xs font-bold text-gray-500 py-8">No historical transactions logged.</p>
              ) : (
                selectedCustomerHistory.metrics?.customerOrders.map((o: any) => (
                  <div key={o.id} className={`p-4 rounded-2xl flex justify-between items-center text-xs border ${o.status === 'rejected' ? 'bg-red-500/[0.02] border-red-500/20' : 'bg-white/[0.01] border-white/5'}`}>
                    <div>
                      {o.status === 'rejected' && (
                        <div className="mb-2 bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-max">
                          🚫 Rejected / Fake
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-[9px] font-black uppercase text-gray-500">Bill: #{formatBillNumber(o.billNumber || 0)}</span>
                        <span className="text-[9px] font-black uppercase text-yellow-500">Token: #{o.tokenNumber || "N/A"}</span>
                      </div>
                      <div className="space-y-0.5 mt-1.5">
                        {o.items?.map((item: any, idx: number) => (
                          <p key={idx} className="text-xs text-gray-400 font-medium">
                            <span className="text-orange-500">×{item.quantity}</span> {item.name}
                          </p>
                        ))}
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-2">
                        {o.timestamp?.toDate ? o.timestamp.toDate().toLocaleString() : 'Just now'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-sm ${o.status === 'rejected' ? 'line-through text-red-500' : 'text-green-400'}`}>₹{o.total}</p>
                      <span className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold mt-1 inline-block ${o.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-400'}`}>
                        {o.status === 'rejected' ? 'REJECTED' : (o.status || 'Completed')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SMART BROADCAST MODAL --- */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/5 p-6 rounded-[2.5rem] w-full max-w-lg relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowBroadcastModal(false)} 
              className="absolute top-4 right-4 p-2 bg-white/5 text-gray-400 hover:text-white rounded-full transition-all"
            >
              <X size={18}/>
            </button>
            <div className="text-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-black text-orange-500 uppercase">Smart Marketing Blast</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-0.5">Target the Right Loyal Customers</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
              <p className="text-[10px] font-black uppercase text-orange-400 flex items-center gap-1">
                <Filter size={12}/> Target Segment Filters
              </p>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase font-sans">VIP Tier</label>
                  <select 
                    value={broadcastTierFilter} 
                    onChange={(e) => setBroadcastTierFilter(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 text-[10px] font-bold rounded-lg p-2 text-white outline-none cursor-pointer"
                  >
                    <option value="all">All Tiers</option>
                    <option value="platinum">👑 Platinum</option>
                    <option value="gold">🥇 Gold VIP</option>
                    <option value="silver">🥈 Silver VIP</option>
                    <option value="bronze">🥉 Regular</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Min Points</label>
                  <input 
                    type="number" 
                    placeholder="Min Points"
                    value={broadcastMinPoints || ""}
                    onChange={(e) => setBroadcastMinPoints(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/10 text-[10px] font-bold rounded-lg p-2 text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Min Spend (₹)</label>
                  <input 
                    type="number" 
                    placeholder="Min Spend"
                    value={broadcastMinSpend || ""}
                    onChange={(e) => setBroadcastMinSpend(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/10 text-[10px] font-bold rounded-lg p-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold border-t border-white/5 pt-2.5">
                <span>Targets Found: <strong className="text-orange-500">{broadcastTargetedCustomers.length}</strong></span>
                <span>Sent: <strong className="text-green-500">{broadcastTargetedCustomers.filter(c => sentBroadcastPhones.includes(c.phone)).length}</strong></span>
                <span>Remaining: <strong className="text-yellow-500">{broadcastTargetedCustomers.filter(c => !sentBroadcastPhones.includes(c.phone)).length}</strong></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Write Promotional Message</label>
              <textarea 
                value={broadcastMessage} 
                onChange={(e) => setBroadcastMessage(e.target.value)} 
                placeholder="Type your special discount offer or festive wishes here..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 outline-none focus:border-orange-500 text-xs font-bold text-white h-24 resize-none leading-relaxed animate-none"
              />
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl space-y-3 text-center">
              <p className="text-[10px] text-orange-400 font-extrabold uppercase tracking-wide">⚡ One-Click Queue Sender Assistant</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleSendNextUnsentBroadcast}
                  type="button"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md animate-none"
                >
                  💬 Send Next (Unsent Queue)
                </button>
                <button 
                  onClick={() => { setSentBroadcastPhones([]); toast.success("Sent history reset successfully!"); }}
                  title="Reset session"
                  type="button"
                  className="bg-white/5 text-gray-400 transition-all active:scale-95"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            {/* कस्टमर ब्रॉडकास्ट स्टेटस लिस्ट */}
            <div className="border-t border-white/5 pt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-gray-400 font-extrabold uppercase">Target Audience List ({broadcastTargetedCustomers.length})</p>
              </div>
              
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {broadcastTargetedCustomers.length === 0 ? (
                  <p className="text-center text-[10px] text-gray-500 py-6 uppercase font-bold">No customers match...</p>
                ) : (
                  broadcastTargetedCustomers.map((user) => {
                    const isAlreadySent = sentBroadcastPhones.includes(user.phone);
                    return (
                      <div key={user.phone} className={`flex justify-between items-center p-2 rounded-xl text-xs font-bold border transition-colors ${isAlreadySent ? 'bg-green-500/[0.02] border-green-500/10' : 'bg-white/[0.01] border-white/5'}`}>
                        <div className="flex flex-col">
                          <span className={`${isAlreadySent ? 'text-gray-500' : 'text-gray-300'}`}>{user.name} (+{user.phone})</span>
                          <span className="text-[8px] text-gray-500 uppercase tracking-widest">{user.metrics.tier} • {user.points || 0} Pts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAlreadySent ? (
                            <span className="text-[9px] text-green-500 font-extrabold uppercase flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-md">
                              <Check size={10}/> Sent
                            </span>
                          ) : (
                            <span className="text-[9px] text-yellow-500 font-extrabold uppercase flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-md">
                              Unsent
                            </span>
                          )}
                          <button 
                            onClick={() => triggerWhatsAppBroadcast(user.phone)}
                            className={`font-black text-[9px] px-3 py-1.5 rounded-lg flex items-center gap-1 uppercase transition-all ${isAlreadySent ? 'bg-white/5 text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                          >
                            <MessageSquare size={10}/> Send
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button type="button" onClick={() => setShowBroadcastModal(false)} className="w-full bg-white/5 text-gray-400 p-3.5 rounded-xl font-black text-xs uppercase">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
