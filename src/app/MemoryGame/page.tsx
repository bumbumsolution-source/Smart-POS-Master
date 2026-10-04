"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// 🛡️ 1. Security Guard
import GameGuard from "@/components/GameGuard";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// 🚀 हार्ड मोड: 8 की जगह 10 आइटम्स (कुल 20 कार्ड्स)
const FOOD_EMOJIS = ["🍔", "🍕", "🍟", "🍩", "☕", "🍦", "🌭", "🥤", "🌮", "🍉"];

interface CardData {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function MemoryGamePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // गेम स्टेट्स
  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]); // card IDs
  const [matches, setMatches] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameInterval, setGameInterval] = useState<NodeJS.Timeout | null>(null);

  // UI Stats
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // URL से टेबल नंबर
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
        if (snap.exists() && snap.data().name) {
          setName(snap.data().name); 
          setIsReturningUser(true);
        } else {
          setIsReturningUser(false); 
          setName("");
        }
      });
    } else {
      setIsReturningUser(false);
    }
  }, [phone]);

  // कार्ड्स को शफ़ल (मिश्रित) करने का फंक्शन
  const shuffleCards = () => {
    const duplicatedCards = [...FOOD_EMOJIS, ...FOOD_EMOJIS].map((emoji, index) => ({
      id: index,
      emoji,
      isFlipped: false,
      isMatched: false,
    }));
    for (let i = duplicatedCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [duplicatedCards[i], duplicatedCards[j]] = [duplicatedCards[j], duplicatedCards[i]];
    }
    return duplicatedCards;
  };

  // 🚀 1. गेम शुरू करने का हैंडलर
  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    const deviceLastPlayed = localStorage.getItem("memory_game_cooldown");
    const lockedPhone = localStorage.getItem("memory_game_locked_phone");

    if (deviceLastPlayed && lockedPhone) {
      if (now - parseInt(deviceLastPlayed, 10) < ONE_HOUR && lockedPhone !== cleanPhone) {
        setIsLoading(false);
        return toast.error("🚫 इस फोन से पहले ही खेला जा चुका है! कृपया 1 घंटे प्रतीक्षा करें।", { duration: 5000 });
      }
    }

    try {
      const userRef = doc(db, "customer_points", cleanPhone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const todayStr = new Date().toDateString();
        if (data.lastGameDate === todayStr && data.todayGamePoints >= 20) {
          toast("⚠️ आप आज की 20 कूपन की लिमिट पार कर चुके हैं, मजे के लिए खेलें!", { icon: '🎮' });
        }
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        lastActive: serverTimestamp(),
        importSource: 'MemoryGame'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      // Reset Game 
      setCards(shuffleCards());
      setFlippedCards([]);
      setMatches(0);
      setTimeElapsed(0);
      
      setStep("playing");
      toast.success("सभी 10 जोड़ियों (Pairs) को जल्दी से खोजें! 🃏");

      // Start Timer
      const interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      setGameInterval(interval);

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // ⏱️ टाइमर और गेम ओवर चेक (हार्ड मोड)
  useEffect(() => {
    if (step === "playing") {
      // 50 सेकंड में गेम ओवर (Time Up)
      if (timeElapsed >= 50 && matches < 10) {
        if (gameInterval) clearInterval(gameInterval);
        setStep("gameover");
      }
      // अगर सारे 10 मैच मिल गए (Win)
      if (matches === 10) {
        if (gameInterval) clearInterval(gameInterval);
        setStep("gameover");
      }
    }
  }, [timeElapsed, matches, step, gameInterval]);

  // 🃏 कार्ड क्लिक हैंडलर 
  const handleCardClick = (clickedId: number) => {
    if (flippedCards.length === 2) return;
    const clickedCard = cards.find(c => c.id === clickedId);
    if (clickedCard?.isFlipped || clickedCard?.isMatched) return;

    setCards(prev => prev.map(c => c.id === clickedId ? { ...c, isFlipped: true } : c));
    const newFlipped = [...flippedCards, clickedId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      const firstCardId = newFlipped[0]; 
      const secondCardId = clickedId;    

      const card1 = cards.find(c => c.id === firstCardId);
      const card2 = cards.find(c => c.id === secondCardId);

      if (card1 && card2 && card1.emoji === card2.emoji) {
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            (c.id === firstCardId || c.id === secondCardId) ? { ...c, isMatched: true } : c
          ));
          setFlippedCards([]);
          setMatches(prev => prev + 1);
        }, 500); 
      } else {
        // 🚀 हार्ड मोड: 800ms से घटाकर 400ms कर दिया ताकि गलत कार्ड बहुत जल्दी पलट जाए
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            (c.id === firstCardId || c.id === secondCardId) ? { ...c, isFlipped: false } : c
          ));
          setFlippedCards([]);
        }, 400); 
      }
    }
  };

  // 🛡️ 3. गेम ओवर और डेटा सेविंग
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // Anti-Cheat
    if (matches === 10 && timeElapsed < 10) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    // 🚀 नया हार्ड स्कोर रूल: 40s = 10 कूपन, 25s = 20 कूपन
    let pointsWon = 0;
    if (matches === 10) {
      if (timeElapsed <= 25) pointsWon = 20;
      else if (timeElapsed <= 40) pointsWon = 10;
    }

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

      const remainingLimit = Math.max(0, 20 - todayGamePoints);
      const finalPointsToAdd = Math.min(pointsWon, remainingLimit);

      if (pointsWon > 0 && finalPointsToAdd === 0) {
        toast("आप आज की लिमिट (20 कूपन) पार कर चुके हैं।", { icon: "⚠️" });
        setIsSaving(false);
        return;
      }

      await setDoc(userRef, {
        gamePoints: prevGamePoints + finalPointsToAdd, 
        todayGamePoints: todayGamePoints + finalPointsToAdd,
        lastGameDate: todayStr,
        lastMemoryGameScore: timeElapsed 
      }, { merge: true });

      setEarnedPoints(finalPointsToAdd);
      
      localStorage.setItem("memory_game_cooldown", Date.now().toString());
      localStorage.setItem("memory_game_locked_phone", phone);

      if (finalPointsToAdd > 0) {
        toast.success(`बधाई हो! आपको ${finalPointsToAdd} कूपन मिले! 🎉`);
      } else if (matches === 10) {
        toast.error("आप जीत गए, लेकिन समय ज्यादा लगा (40 सेकंड से ज्यादा)!");
      } else {
        toast.error("Time Up! आप सारे कार्ड्स नहीं खोज पाए।");
      }

    } catch (err) {
      toast.error("स्कोर सेव करने में समस्या आई।");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (step === "gameover") savePointsToDatabase();
    return () => { if (gameInterval) clearInterval(gameInterval); };
  }, [step]);

  return (
    <GameGuard allowedGameName="MemoryGame">
      <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden touch-none relative select-none">
        <Toaster position="top-center" />
        
        {/* ---------------- LOGIN SCREEN ---------------- */}
        {step === "login" && (
          <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
            <div className="mb-6 text-center">
              <div className="inline-block bg-cyan-500/15 text-cyan-400 px-4 py-1 rounded-full text-xs font-bold mb-2 border border-cyan-500/30">
                {tableNo}
              </div>
              <h1 className="text-3xl font-black text-cyan-400 drop-shadow-md">Food Memory 🃏</h1>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700 text-left">
                दिमाग लगाएँ और 2 एक जैसे कार्ड खोजें! (कुल 20 कार्ड, समय: 50s)<br/><br/>
                <span className="text-green-400 text-[11px] block text-center">
                  40 सेकंड के अंदर खोजा = 10 कूपन<br/>
                  25 सेकंड के अंदर खोजा = 20 कूपन
                </span>
              </p>
              
              <form onSubmit={handleStartGame} className="space-y-3 pt-2">
                <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-cyan-500 text-center py-3 rounded-xl outline-none text-white focus:border-cyan-400 font-mono" />
                <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-blue-500 text-center py-3 rounded-xl outline-none text-white focus:border-blue-400 font-bold" />
                
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4">
                  {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING SCREEN ---------------- */}
        {step === "playing" && (
          <div className="w-full max-w-md px-4 flex flex-col items-center justify-center h-[100dvh]">
            <div className="w-full flex justify-between items-center bg-[#1e293b] border border-[#334155] p-3 rounded-2xl shadow-lg mb-6">
              <div className="text-center">
                 <p className="text-[10px] font-black uppercase text-neutral-400">समय (Time)</p>
                 <p className={`text-2xl font-mono font-black ${timeElapsed > 35 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                   {timeElapsed}s <span className="text-sm text-neutral-500">/50s</span>
                 </p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] font-black uppercase text-neutral-400">जोड़ियां (Pairs)</p>
                 <p className="text-2xl font-mono font-black text-green-400">
                   {matches} <span className="text-sm text-neutral-500">/10</span>
                 </p>
              </div>
            </div>

            {/* 🚀 20 कार्ड्स के लिए grid-cols-4 और gap-2 ताकि स्क्रीन में अच्छे से फिट हो */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-[340px] mx-auto">
              {cards.map(card => (
                <div 
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="relative aspect-square cursor-pointer group perspective-1000"
                  style={{ perspective: "1000px" }}
                >
                  <div 
                    className={`absolute w-full h-full transition-transform duration-500 rounded-xl shadow-md ${card.isFlipped || card.isMatched ? 'rotate-y-180' : ''}`}
                    style={{ transformStyle: "preserve-3d", transform: card.isFlipped || card.isMatched ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    <div className="absolute w-full h-full bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl border-2 border-cyan-400/50 flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]" style={{ backfaceVisibility: "hidden" }}>
                      <div className="text-2xl opacity-30 text-white">❓</div>
                    </div>
                    {/* Emoji size slightly reduced for 20 cards layout */}
                    <div className={`absolute w-full h-full bg-white rounded-xl border-2 flex items-center justify-center text-3xl shadow-inner ${card.isMatched ? 'border-green-500 bg-green-50' : 'border-neutral-200'}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                      {card.emoji}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- GAME OVER SCREEN ---------------- */}
        {step === "gameover" && (
          <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
            <div className="text-6xl">{matches === 10 ? '🎉' : '⏳'}</div>
            <h2 className={`text-3xl font-black uppercase tracking-wider ${matches === 10 ? 'text-green-500' : 'text-red-500'}`}>
              {matches === 10 ? 'You Won!' : 'Time Up!'}
            </h2>
            
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#334155]">
              <p className="text-xs font-bold text-neutral-400 uppercase">समय लगा (Time Taken)</p>
              <p className="text-5xl font-mono font-black text-cyan-400 mt-2">{timeElapsed}s</p>
            </div>

            {isSaving ? (
               <p className="text-sm text-neutral-400 animate-pulse font-bold">स्कोर चेक हो रहा है...</p>
            ) : earnedPoints > 0 ? (
              <div className="bg-green-900/20 border border-green-500/30 p-5 rounded-2xl">
                <p className="text-[11px] font-black uppercase text-green-500">डिस्काउंट कूपन जीते</p>
                <p className="text-4xl font-black text-green-400 mt-1">🎟️ {earnedPoints}</p>
                <p className="text-xs text-neutral-300 mt-3 font-bold">
                  कूपन <span className="text-white bg-black/30 px-1 rounded">({phone})</span> पर सेव हो गए हैं। बिल बनवाते समय नंबर बताएं!
                </p>
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
                 <p className="text-sm font-black text-red-400">Better Luck Next Time! 😔</p>
                 <p className="text-xs text-neutral-400 mt-2">
                   {matches === 10 ? "आपने गेम जीत लिया, लेकिन 40 सेकंड से ज्यादा समय लग गया।" : "आप 50 सेकंड के अंदर सारे 20 कार्ड्स नहीं खोज पाए।"}
                 </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => {
                  setCards(shuffleCards()); setFlippedCards([]); setMatches(0); setTimeElapsed(0); setStep("playing");
                  const interval = setInterval(() => { setTimeElapsed(prev => prev + 1); }, 1000);
                  setGameInterval(interval);
                }} 
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm uppercase rounded-xl shadow-lg"
              >
                 🔁 फिर से खेलें (Play Again)
              </button>
              <button onClick={() => setStep("login")} className="w-full py-2 bg-transparent text-neutral-400 font-bold text-xs hover:text-white transition-all">
                 मुख्य मेनू (Main Menu)
              </button>
            </div>
          </div>
        )}
      </div>
    </GameGuard>
  );
}
