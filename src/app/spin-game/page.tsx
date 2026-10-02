"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// 🎡 स्पिन व्हील के इनाम (6 हिस्से) 
const PRIZES = [
  { label: "Better Luck", points: 0, type: "none", color: "#ef4444" }, // 0: Red (70%)
  { label: "10 कूपन", points: 10, type: "points", color: "#eab308" }, // 1: Yellow (20%)
  { label: "Manchurian Half", points: 0, type: "food", color: "#3b82f6" }, // 2: Blue (3%)
  { label: "20 कूपन", points: 20, type: "points", color: "#22c55e" }, // 3: Green (3%)
  { label: "Manchurian Rice", points: 0, type: "food", color: "#f97316" }, // 4: Orange (3%)
  { label: "Sandwich", points: 0, type: "food", color: "#a855f7" }  // 5: Purple (1%)
];

export default function SpinGamePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [birthDay, setBirthDay] = useState(""); 
  const [birthMonth, setBirthMonth] = useState(""); 
  
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // स्पिन व्हील स्टेट्स
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("table");
      setTableNo(t && /^[0-9]{1,2}$/.test(t) ? `टेबल नं: ${t}` : "सामान्य टेबल");
    }
  }, []);

  // ऑटो-फिल
  useEffect(() => {
    if (phone.length === 10) {
      getDoc(doc(db, "customer_points", phone)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setName(data.name); 
            setIsReturningUser(true);
          }
          if (data.specialDates && Array.isArray(data.specialDates)) {
            const bdayEntry = data.specialDates.find((d: any) => d.type === 'Birthday');
            if (bdayEntry && bdayEntry.date) {
              const parts = bdayEntry.date.split("-"); 
              if (parts.length === 3) {
                setBirthMonth(parts[1]);
                setBirthDay(parts[2]);
              }
            }
          }
        } else {
          setIsReturningUser(false); 
          setName("");
          setBirthMonth("");
          setBirthDay("");
        }
      });
    } else {
      setIsReturningUser(false);
    }
  }, [phone]);

  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");
    if (!birthDay || !birthMonth) return toast.error("कृपया अपने जन्मदिन की तारीख और महीना चुनें!");

    setIsLoading(true);
    
    // 👉 40 मिनट की लिमिट
    const FORTY_MINUTES = 40 * 60 * 1000;
    const now = Date.now();

    // 1. डिवाइस लेवल चेक (लोकल स्टोरेज)
    const deviceLastPlayed = localStorage.getItem("spin_game_cooldown");
    if (deviceLastPlayed) {
      const elapsed = now - parseInt(deviceLastPlayed, 10);
      if (elapsed < FORTY_MINUTES) {
        setIsLoading(false);
        const minsLeft = Math.ceil((FORTY_MINUTES - elapsed) / 60000);
        return toast.error(`🚫 आप पहले ही खेल चुके हैं! कृपया ${minsLeft} मिनट प्रतीक्षा करें।`, { duration: 5000 });
      }
    }

    try {
      const userRef = doc(db, "customer_points", cleanPhone);
      const userSnap = await getDoc(userRef);
      let existingSpecialDates: any[] = [];

      if (userSnap.exists()) {
        const data = userSnap.data();
        
        // 2. डेटाबेस लेवल चेक (अगर यूज़र चालाकी से ब्राउज़र डेटा क्लियर कर दे)
        if (data.lastPlayedAt && typeof data.lastPlayedAt.toDate === 'function') {
          const lastPlayedTime = data.lastPlayedAt.toDate().getTime();
          const elapsedDb = now - lastPlayedTime;
          if (elapsedDb < FORTY_MINUTES) {
            setIsLoading(false);
            const minsLeft = Math.ceil((FORTY_MINUTES - elapsedDb) / 60000);
            return toast.error(`🚫 इस नंबर से पहले ही खेला जा चुका है! कृपया ${minsLeft} मिनट प्रतीक्षा करें।`, { duration: 5000 });
          }
        }

        existingSpecialDates = data.specialDates || [];
        const todayStr = new Date().toDateString();
        if (data.lastGameDate === todayStr && data.todayGamePoints >= 50) {
          toast("⚠️ आप आज के कूपन की लिमिट पार कर चुके हैं, लेकिन खाने के इनाम जीत सकते हैं!", { icon: '🎡' });
        }
      }

      const formattedDate = `2000-${birthMonth}-${birthDay}`;
      const bdayIndex = existingSpecialDates.findIndex((d: any) => d.type === 'Birthday' && d.name === cleanName);
      
      if (bdayIndex > -1) {
        existingSpecialDates[bdayIndex].date = formattedDate; 
      } else {
        existingSpecialDates.push({ type: 'Birthday', date: formattedDate, name: cleanName }); 
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        specialDates: existingSpecialDates, 
        lastActive: serverTimestamp(),
        importSource: 'SpinGame'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      setStep("playing");
      toast.success("बेस्ट ऑफ़ लक! अपना इनाम स्पिन करें 🎡");

    } catch (err) {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    
    const randomChance = Math.random() * 100;
    let prizeIndex = 0;

    if (randomChance < 70) prizeIndex = 0; 
    else if (randomChance < 90) prizeIndex = 1; 
    else if (randomChance < 93) prizeIndex = 2; 
    else if (randomChance < 96) prizeIndex = 3; 
    else if (randomChance < 99) prizeIndex = 4; 
    else prizeIndex = 5; 

    const spins = 5; 
    const degreesPerSlice = 360 / PRIZES.length;
    
    const targetDegree = (spins * 360) + 360 - (prizeIndex * degreesPerSlice + (degreesPerSlice / 2));
    setRotation(targetDegree);

    setTimeout(() => {
      savePrizeToDatabase(PRIZES[prizeIndex]);
    }, 4500); 
  };

  const savePrizeToDatabase = async (prize: any) => {
    try {
      const userRef = doc(db, "customer_points", phone);
      const userSnap = await getDoc(userRef);
      
      let prevGamePoints = 0; 
      let todayGamePoints = 0;
      const todayStr = new Date().toDateString(); 

      if (userSnap.exists()) {
        const data = userSnap.data();
        prevGamePoints = Number(data.gamePoints) || 0; 
        todayGamePoints = data.lastGameDate === todayStr ? (Number(data.todayGamePoints) || 0) : 0;
      }

      let finalPointsToAdd = 0;
      let generatedCode = "";
      let finalPrizeLabel = "Better Luck";
      let isWinner = false;

      if (prize.type === "points") {
        const remainingLimit = Math.max(0, 50 - todayGamePoints);
        finalPointsToAdd = Math.min(prize.points, remainingLimit);
        
        if (finalPointsToAdd > 0) {
          generatedCode = `BOM-${Math.floor(1000 + Math.random() * 9000)}`;
          finalPrizeLabel = `${finalPointsToAdd} कूपन`;
          isWinner = true;
        } else {
          finalPrizeLabel = "लिमिट ख़त्म (0 कूपन)";
        }
      } 
      else if (prize.type === "food") {
        generatedCode = `FOOD-${Math.floor(100 + Math.random() * 900)}`;
        finalPrizeLabel = prize.label;
        isWinner = true;
      }

      await setDoc(userRef, {
        gamePoints: prevGamePoints + finalPointsToAdd, 
        todayGamePoints: todayGamePoints + finalPointsToAdd,
        lastGameDate: todayStr,
        lastPrizeWon: finalPrizeLabel,
        voucherCode: generatedCode || null,
        voucherClaimed: false,
        lastPlayedAt: serverTimestamp() // यहाँ टाइम सेव हो रहा है 40 मिनट की लिमिट के लिए
      }, { merge: true });

      setWonPrize({ ...prize, actualLabel: finalPrizeLabel, isWinner: isWinner });
      setVoucherCode(generatedCode);
      
      // लोकल स्टोरेज में भी सेव कर रहे हैं
      localStorage.setItem("spin_game_cooldown", Date.now().toString());

      setStep("gameover");
      setIsSpinning(false);

    } catch (err) {
      toast.error("इनाम सेव करने में समस्या आई।");
      setIsSpinning(false);
    }
  };

  const degreesPerSlice = 360 / PRIZES.length;
  const conicGradientString = PRIZES.map((prize, idx) => {
    return `${prize.color} ${idx * degreesPerSlice}deg ${(idx + 1) * degreesPerSlice}deg`;
  }).join(", ");

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden relative select-none">
      <Toaster position="top-center" />
      
      {/* ---------------- LOGIN SCREEN ---------------- */}
      {step === "login" && (
        <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-black text-purple-500 drop-shadow-md tracking-wider">Spin & Win 🎡</h1>
            <p className="text-sm font-bold text-neutral-400 mt-1">बम बम कैफे, मोहंद्रा</p>
          </div>

          <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
            <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700 text-left">
              व्हील घुमाएं और अपनी किस्मत आजमाएं!<br/>
              <span className="text-purple-400 block mt-2 text-center text-sm font-black">
                कूपन और टेस्टी फूड जीतने का मौका! 🍕🥪
              </span>
            </p>
            
            <form onSubmit={handleStartGame} className="space-y-3 pt-2">
              <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-purple-500 text-center py-3 rounded-xl outline-none text-white focus:border-purple-400 font-mono" />
              <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-purple-500 text-center py-3 rounded-xl outline-none text-white focus:border-purple-400 font-bold" />
              
              <div className="mt-3 pt-3 border-t border-[#334155] space-y-2">
                <p className="text-[11px] font-bold text-pink-400 text-left leading-tight">
                  🎂 अपना या अपने बच्चे का असली जन्मदिन (Birth Date) चुनें <span className="text-white">(अनिवार्य)</span>:
                </p>
                <div className="flex gap-2">
                  <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required className={`w-1/2 bg-[#0f172a] border-2 text-center text-sm py-3 rounded-xl outline-none appearance-none ${birthDay ? "border-green-500 text-green-400 font-bold" : "border-pink-500 text-white"}`}>
                    <option value="" disabled>तारीख *</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                  </select>
                  <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required className={`w-1/2 bg-[#0f172a] border-2 text-center text-sm py-3 rounded-xl outline-none appearance-none ${birthMonth ? "border-green-500 text-green-400 font-bold" : "border-pink-500 text-white"}`}>
                    <option value="" disabled>महीना *</option>
                    {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month:'short'})}</option>)}
                  </select>
                </div>
                <p className="text-[10px] text-yellow-400 font-bold text-left bg-yellow-900/20 p-2 rounded-lg border border-yellow-500/30">
                  ⚠️ कृपया आज की तारीख न चुनें। अपना असली जन्मदिन ही डालें ताकि आपको आपके जन्मदिन पर स्पेशल गिफ्ट मिल सके!
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4">
                {isLoading ? "प्रतीक्षा करें..." : "▶ व्हील के पास जाएँ"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- PLAYING SCREEN (Wheel) ---------------- */}
      {step === "playing" && (
        <div className="w-full flex flex-col items-center justify-center h-[100dvh] px-4">
          <h2 className="text-3xl font-black text-purple-400 mb-8 uppercase tracking-widest text-center">
            Spin To Win
          </h2>

          <div className="relative w-[320px] h-[320px] flex items-center justify-center">
            
            <div 
              className="absolute -top-5 z-40 w-10 h-12 bg-yellow-400 shadow-2xl border-b border-black" 
              style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
            ></div>
            
            <div 
              className="w-full h-full rounded-full border-[10px] border-[#334155] shadow-[0_0_40px_rgba(168,85,247,0.4)] relative"
              style={{ 
                transform: `rotate(${rotation}deg)`, 
                transitionDuration: isSpinning ? "4.5s" : "0s", 
                transitionTimingFunction: "cubic-bezier(0.1, 0.7, 0.1, 1)" 
              }}
            >
              <div 
                className="w-full h-full rounded-full overflow-hidden absolute inset-0"
                style={{ background: `conic-gradient(${conicGradientString})` }}
              >
                {PRIZES.map((prize, idx) => {
                  const sliceCenterAngle = (idx * degreesPerSlice) + (degreesPerSlice / 2);
                  return (
                    <div 
                      key={`text-${idx}`} 
                      className="absolute top-0 left-0 w-full h-full flex justify-center pointer-events-none"
                      style={{ transform: `rotate(${sliceCenterAngle}deg)` }}
                    >
                      <span className="text-white font-black text-[12px] uppercase mt-[15px] px-2 text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] w-24 leading-snug break-words">
                        {prize.label}
                      </span>
                    </div>
                  );
                })}

                {PRIZES.map((_, idx) => (
                  <div 
                    key={`line-${idx}`}
                    className="absolute top-0 left-1/2 w-[3px] h-[50%] bg-white/50 origin-bottom -translate-x-1/2"
                    style={{ transform: `rotate(${idx * degreesPerSlice}deg)` }}
                  ></div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={handleSpin}
              disabled={isSpinning}
              className="absolute z-30 w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center text-purple-700 font-black uppercase shadow-2xl border-[6px] border-[#1e293b] disabled:opacity-90 transform hover:scale-105 transition-all"
            >
              <span className="text-xl">SPIN</span>
            </button>
          </div>

          <p className="mt-14 text-xs text-neutral-400 font-bold uppercase tracking-widest text-center px-6 animate-pulse">
            बीच वाले सफेद बटन पर क्लिक करें!
          </p>
        </div>
      )}

      {/* ---------------- GAME OVER SCREEN ---------------- */}
      {step === "gameover" && wonPrize && (
        <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
          <div className="text-6xl">{wonPrize.isWinner ? (wonPrize.type === "food" ? '🍔' : '🎉') : '💥'}</div>
          <h2 className="text-3xl font-black uppercase text-purple-400 tracking-wider">Result</h2>
          
          <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#334155] space-y-2">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">You Won</p>
            <p className="text-3xl font-black mt-2 leading-tight" style={{ color: wonPrize.color }}>
              {wonPrize.actualLabel}
            </p>
          </div>

          {wonPrize.isWinner ? (
            <div className="bg-green-900/20 border border-green-500/30 p-5 rounded-2xl space-y-3">
              <p className="text-xs text-green-400 font-bold">
                बिल बनवाते समय कैशियर को यह कोड दिखाएं:
              </p>
              <div className="bg-white text-black font-mono font-black text-2xl py-2 rounded-xl border-2 border-green-500 tracking-widest shadow-inner">
                {voucherCode}
              </div>
              <p className="text-[10px] text-neutral-400">
                (यह कोड आपके मोबाइल नंबर {phone} पर भी लिंक हो गया है।)
              </p>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
               <p className="text-sm font-black text-red-400">Better Luck Next Time! 😔</p>
               <p className="text-xs text-neutral-400 mt-2">
                 कोई बात नहीं, 40 मिनट बाद फिर से ट्राई करें!
               </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
