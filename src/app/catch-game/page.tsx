"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// नाम को सही फॉर्मेट (Title Case) में करने के लिए
const formatNameTitleCase = (text: string) => {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// गेम के आइटम
const FOOD_ITEMS = ["🍔", "☕", "🍕", "🍟", "🍩", "🍦"];
const BOMB_ITEM = "💣";

export default function CatchGamePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState(""); 
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // गेम स्टेट्स
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [basketX, setBasketX] = useState(50); // बास्केट की पोजीशन (0 से 100%)
  const [items, setItems] = useState<any[]>([]);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0); // 👉 Anti-Cheat Timer

  // गेम लूप के लिए Refs
  const requestRef = useRef<number>();
  const lastItemTime = useRef<number>(0);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // URL से टेबल नंबर लेना
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("table");
      if (t && /^[0-9]{1,2}$/.test(t)) {
        setTableNo(`टेबल नं: ${t}`);
      } else {
        setTableNo("सामान्य टेबल");
      }
    }
  }, []);

  // स्मार्ट ऑटो-फिल
  useEffect(() => {
    if (phone.length === 10) {
      getDoc(doc(db, "customer_points", phone)).then((snap) => {
        if (snap.exists() && snap.data().name) {
          setName(snap.data().name); 
          setIsReturningUser(true);
        } else {
          setIsReturningUser(false); 
        }
      });
    } else {
      setIsReturningUser(false);
    }
  }, [phone]);

  // 🚀 1. लॉगिन हैंडलर 
  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    // 🛑 DEVICE LOCK CHECK (एक मोबाइल = एक नंबर)
    const deviceLastPlayed = localStorage.getItem("catch_game_cooldown");
    const lockedPhone = localStorage.getItem("catch_game_locked_phone");

    if (deviceLastPlayed && lockedPhone) {
      const elapsedDevice = now - parseInt(deviceLastPlayed, 10);
      if (elapsedDevice < ONE_HOUR && lockedPhone !== cleanPhone) {
        setIsLoading(false);
        return toast.error("🚫 इस फोन से पहले ही खेला जा चुका है! कृपया अपना वही नंबर डालें या 1 घंटे प्रतीक्षा करें।", {
          duration: 5000,
          style: { background: "#ef4444", color: "#fff", fontWeight: "bold" }
        });
      }
    }

    try {
      // 2. DATABASE CHECK & UPDATE
      const userRef = doc(db, "customer_points", cleanPhone);
      const userSnap = await getDoc(userRef);
      
      let existingSpecialDates: any[] = [];

      if (userSnap.exists()) {
        const data = userSnap.data();
        existingSpecialDates = data.specialDates || [];
        
        const todayStr = new Date().toDateString();
        if (data.lastGameDate === todayStr && data.todayGamePoints >= 20) {
          toast("⚠️ आप आज की 20 पॉइंट्स की लिमिट पार कर चुके हैं, लेकिन आप मजे के लिए खेल सकते हैं!", { icon: '🎮' });
        }
      }

      // बर्थडे सेव करें
      if (birthday) {
        const hasBirthday = existingSpecialDates.some((d: any) => d.type === 'Birthday' && d.name === cleanName);
        if (!hasBirthday) {
          existingSpecialDates.push({ type: 'Birthday', date: birthday, name: cleanName });
        }
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        specialDates: existingSpecialDates, 
        lastActive: serverTimestamp(),
        importSource: 'CatchGame'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      // स्टार्ट गेम
      setScore(0);
      setLives(3);
      setItems([]);
      setGameStartTime(Date.now()); // 👉 Timer On (For Anti-Cheat)
      setStep("playing");
      toast.success(`गेम में आपका स्वागत है 🎮`);

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. बास्केट को मूव करना
  const handleMove = (clientX: number) => {
    if (!gameContainerRef.current) return;
    const rect = gameContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setBasketX(Math.max(5, Math.min(95, x))); 
  };

  // 3. मेन गेम लूप (गिरते हुए आइटम्स) - 🔥 EXTREME HARD MODE 🔥
  useEffect(() => {
    if (step !== "playing") return;

    const gameLoop = (time: number) => {
      // 1. स्पॉन स्पीड: आइटम्स बहुत जल्दी-जल्दी गिरेंगे (Max 150ms)
      const dropSpeed = Math.max(200, 700 - (score * 2.5));
      
      if (time - lastItemTime.current > dropSpeed) {
        // 2. बमों की बारिश: बम 30% से शुरू होंगे और 60% तक जाएँगे
        const bombChance = 0.30 + Math.min(0.30, score / 4000);
        const isBomb = Math.random() < bombChance; 
        
        const newItem = {
          id: Date.now(),
          type: isBomb ? "bomb" : "food",
          emoji: isBomb ? BOMB_ITEM : FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)],
          x: Math.random() * 90 + 5, 
          y: -10, 
          // 3. तूफानी स्पीड: गिरने की स्पीड (Gravity) बहुत ज्यादा बढ़ा दी गई है
          speed: Math.random() * 1.2 + 1.5 + (score / 400)
        setItems(prev => [...prev, newItem]);
        lastItemTime.current = time;
      }

      setItems(prev => {
        let activeItems = [...prev];
        let currentScore = 0;
        let lostLife = false;

        activeItems = activeItems.map(item => ({ ...item, y: item.y + item.speed })).filter(item => {
          if (item.y > 100) return false; 
          
          // 4. टाइट हिटबॉक्स: कैच एरिया 8 कर दिया है (अब बिल्कुल सटीक पकड़ना होगा)
          if (item.y > 85 && item.y < 95 && Math.abs(item.x - basketX) < 8) {
            if (item.type === "bomb") {
              lostLife = true;
            } else {
              currentScore += 10; 
            }
            return false; 
          }
          return true; 
        });

        if (currentScore > 0) setScore(s => s + currentScore);
        if (lostLife) {
            setLives(l => {
                const newLives = l - 1;
                if (newLives <= 0) setStep("gameover");
                return newLives;
            });
        }

        return activeItems;
      });

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [step, basketX, score]);

  // 4. गेम खत्म होने पर पॉइंट्स सेव करना (Advanced Anti-Cheat + NEW REWARD RULES)
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // 👉 Advanced Anti-Cheat System (Time + Score Check)
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    if (score > 0 && ((score / playTimeSeconds > 65) || score > 8000)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई! (Speed/Score Hack Detected)", {
        style: { background: "#ef4444", color: "#fff" }
      });
    }

    // 👉 NEW LOGIC: 2000 स्कोर = 10 Points, 4000 स्कोर = 20 Points (Max 20)
    let pointsWon = 0;
    if (score >= 4000) pointsWon = 20;
    else if (score >= 2000) pointsWon = 10;
    else pointsWon = 0;

    try {
      const userRef = doc(db, "customer_points", phone);
      const userSnap = await getDoc(userRef);
      
      let prevGamePoints = 0; 
      let todayGamePoints = 0;
      let lastGameDate = "";
      const todayStr = new Date().toDateString(); 

      if (userSnap.exists()) {
        const data = userSnap.data();
        prevGamePoints = Number(data.gamePoints) || 0; 
        todayGamePoints = Number(data.todayGamePoints) || 0;
        lastGameDate = data.lastGameDate || "";
      }

      // Time Spoofing (तारीख बदलने) से बचने के लिए चेक
      if (lastGameDate !== todayStr) {
        if (new Date(lastGameDate) > new Date(todayStr)) {
           todayGamePoints = 20; // यूज़र ने फ़ोन का टाइम पीछे किया है
        } else {
           todayGamePoints = 0; 
        }
      }

      const remainingLimit = Math.max(0, 20 - todayGamePoints);
      const finalPointsToAdd = Math.min(pointsWon, remainingLimit);

      // अगर लिमिट खत्म हो गई है
      if (pointsWon > 0 && finalPointsToAdd === 0) {
        toast("आप आज की लिमिट (20 पॉइंट्स) पार कर चुके हैं।", { icon: "⚠️" });
        setIsSaving(false);
        return;
      }

      // 👉 डेटाबेस अपडेट (Game Points Wallet + POS Score)
      await setDoc(userRef, {
        gamePoints: prevGamePoints + finalPointsToAdd, 
        todayGamePoints: todayGamePoints + finalPointsToAdd,
        lastGameDate: todayStr,
        lastCatchGameScore: score // POS में दिखाने के लिए
      }, { merge: true });

      setEarnedPoints(finalPointsToAdd);
      
      // 🛑 DEVICE LOCKING 
      localStorage.setItem("catch_game_cooldown", Date.now().toString());
      localStorage.setItem("catch_game_locked_phone", phone);

      // 👉 Smart Messages
      if (finalPointsToAdd > 0) {
        if (pointsWon > finalPointsToAdd) {
           toast.success(`🎉 आपको बचे हुए ${finalPointsToAdd} पॉइंट्स मिले! (आपकी आज की 20 पॉइंट्स की लिमिट पूरी हो गई है)`);
        } else {
           toast.success(`बधाई हो! आपको ${finalPointsToAdd} पॉइंट्स मिले! 🎉`);
        }
      } else if (score < 2000) {
        toast.error("टारगेट पूरा नहीं हुआ (कम से कम 2000 स्कोर चाहिए)!");
      }

    } catch (err) {
      toast.error("स्कोर सेव करने में समस्या आई।");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (step === "gameover") {
      savePointsToDatabase();
    }
  }, [step]);

  // UI (डिज़ाइन)
  return (
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden touch-none relative select-none">
      <Toaster position="top-center" />
      
      {/* ---------------- LOGIN SCREEN ---------------- */}
      {step === "login" && (
        <div className="w-full max-w-sm px-4">
          <div className="mb-6 text-center">
            <div className="inline-block bg-yellow-500/15 text-yellow-500 px-4 py-1 rounded-full text-xs font-bold mb-2 border border-yellow-500/30">
              {tableNo}
            </div>
            <h1 className="text-2xl font-black text-yellow-400">बम बम कैफे, मोहंद्रा</h1>
          </div>

          <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-5 relative z-10">
            <div className="text-5xl animate-bounce">🍔☕</div>
            <h2 className="text-xl font-black uppercase text-blue-400 tracking-wider">Catch & Win Game</h2>
            
            {/* 👉 NEW: UI Rule Update */}
            <p className="text-xs text-neutral-400 font-bold leading-relaxed">
              बर्गर और कॉफ़ी पकडें, बम (💣) से बचें।<br/>
              <span className="text-green-400 inline-block mt-1 bg-green-900/30 px-2 py-1 rounded-lg border border-green-500/20">
                2000 Score = 10 Points (₹10)<br/>
                4000 Score = 20 Points (₹20)
              </span>
            </p>
            
            <form onSubmit={handleStartGame} className="space-y-3 pt-2">
              <input 
                type="tel" 
                maxLength={10}
                placeholder="10-अंकों का मोबाइल नंबर" 
                value={phone} 
                onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full bg-[#0f172a] border-2 border-yellow-500 text-center text-base py-3 rounded-xl outline-none text-white focus:border-yellow-400" 
              />
              <input 
                type="text" 
                placeholder="आपका नाम" 
                value={name} 
                onChange={(e) => setName(formatNameTitleCase(e.target.value))} 
                required 
                className="w-full bg-[#0f172a] border-2 border-blue-500 text-center text-base py-3 rounded-xl outline-none text-white focus:border-blue-400" 
              />
              
              {!isReturningUser && (
                <div className="relative mt-2">
                  <span className="absolute -top-2 left-4 bg-[#1e293b] px-1 text-[10px] text-pink-400 font-bold">जन्मदिन (Optional) 🎂</span>
                  <input 
                    type="date" 
                    value={birthday} 
                    onChange={(e) => setBirthday(e.target.value)} 
                    className="w-full bg-[#0f172a] border-2 border-pink-500 text-center text-base py-3 rounded-xl outline-none text-white focus:border-pink-400" 
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-white font-black text-base rounded-full tracking-wider transition-all shadow-lg shadow-green-500/20 mt-2 disabled:opacity-50"
              >
                {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- PLAYING SCREEN ---------------- */}
      {step === "playing" && (
        <div 
          ref={gameContainerRef}
          className="relative w-full max-w-md h-[100dvh] bg-[#1a1a1a] overflow-hidden"
          onMouseMove={e => handleMove(e.clientX)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
        >
          {/* Top Stats Bar */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 bg-black/50 px-5 py-3 rounded-2xl backdrop-blur-md border border-neutral-700">
            <div className="text-yellow-400 font-black font-mono text-2xl drop-shadow-md">Score: {score}</div>
            <div className="flex gap-1 text-2xl drop-shadow-md">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={i < lives ? "opacity-100" : "opacity-20 grayscale"}>❤️</span>
              ))}
            </div>
          </div>

          {/* Falling Items */}
          {items.map(item => (
            <div 
              key={item.id} 
              className="absolute text-5xl transform -translate-x-1/2 -translate-y-1/2 transition-none drop-shadow-lg"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {item.emoji}
            </div>
          ))}

          {/* Player Basket (Finger Controller) */}
          <div 
            className="absolute bottom-[8%] text-7xl transform -translate-x-1/2 drop-shadow-[0_0_20px_rgba(249,115,22,0.6)] z-20"
            style={{ left: `${basketX}%` }}
          >
            🧺
          </div>
          <div className="absolute bottom-[2%] w-full text-center text-neutral-500 text-[10px] uppercase font-bold tracking-widest pointer-events-none">
            Slide Finger to Move Basket
          </div>
        </div>
      )}

      {/* ---------------- GAME OVER SCREEN ---------------- */}
      {step === "gameover" && (
        <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
          <div className="text-6xl animate-pulse">💥</div>
          <h2 className="text-3xl font-black uppercase text-red-500 tracking-wider">Game Over</h2>
          
          <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#334155] space-y-2">
            <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Your Final Score</p>
            <p className="text-6xl font-mono font-black text-yellow-400 drop-shadow-md">{score}</p>
          </div>

          {isSaving ? (
             <p className="text-sm text-neutral-400 animate-pulse font-bold">स्कोर चेक हो रहा है...</p>
          ) : earnedPoints > 0 ? (
            <div className="bg-green-900/20 border border-green-500/30 p-5 rounded-2xl space-y-2">
              <p className="text-[11px] font-black uppercase text-green-500 tracking-wider">डिस्काउंट पॉइंट्स जीते</p>
              <p className="text-4xl font-black text-green-400 drop-shadow-md">⭐ {earnedPoints}</p>
              <p className="text-xs text-neutral-300 mt-3 font-bold leading-snug">
                यह पॉइंट्स आपके मोबाइल नंबर <span className="text-white bg-black/30 px-1 rounded">({phone})</span> पर जोड़ दिए गए हैं।
                <br/><br/><span className="text-yellow-400 bg-yellow-400/10 p-1.5 rounded block">बिल बनवाते समय कैशियर को अपना नंबर बताएं और छूट पाएं!</span>
              </p>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl space-y-2">
               <p className="text-lg font-black uppercase text-red-500 drop-shadow-md">Better Luck Next Time! 😔</p>
               <p className="text-xs text-neutral-300 mt-2 font-bold leading-snug">कम से कम 10 रुपये (10 Points) जीतने के लिए 2000 स्कोर बनाना ज़रूरी है!</p>
            </div>
          )}

          <div className="pt-4">
            <button onClick={() => { setScore(0); setLives(3); setItems([]); setGameStartTime(Date.now()); setStep("playing"); }} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase rounded-xl tracking-wider transition-all shadow-lg shadow-blue-600/30">
               🔁 फिर से खेलें (Play Again)
            </button>
          </div>
        </div>
      )}
      
      {/* Background decoration */}
      {step !== "playing" && (
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-10">
           <div className="w-[600px] h-[600px] bg-blue-500 rounded-full blur-[150px]"></div>
        </div>
      )}
    </div>
  );
}
