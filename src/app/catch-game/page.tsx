"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// 🛡️ 1. Security Guard
import GameGuard from "@/components/GameGuard";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

const FOOD_ITEMS = ["🍔", "☕", "🍕", "🍟", "🍩", "🍦"];
const BOMB_ITEM = "💣";

export default function CatchGamePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  const [isLoading, setIsLoading] = useState(false);
  
  const [isReturningUser, setIsReturningUser] = useState(false); 

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [basketX, setBasketX] = useState(50); 
  const [items, setItems] = useState<any[]>([]);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);

  const requestRef = useRef<number>();
  const lastItemTime = useRef<number>(0);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const basketXRef = useRef<number>(50);
  const scoreRef = useRef<number>(0);

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

  // ऑटो-फिल (नाम)
  useEffect(() => {
    if (phone.length === 10) {
      getDoc(doc(db, "customer_points", phone)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setName(data.name); 
            setIsReturningUser(true);
          }
        } else {
          setIsReturningUser(false); 
          setName("");
        }
      });
    } else {
      setIsReturningUser(false);
    }
  }, [phone]);

  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    const deviceLastPlayed = localStorage.getItem("catch_game_cooldown");
    const lockedPhone = localStorage.getItem("catch_game_locked_phone");

    if (deviceLastPlayed && lockedPhone) {
      const elapsedDevice = now - parseInt(deviceLastPlayed, 10);
      if (elapsedDevice < ONE_HOUR && lockedPhone !== cleanPhone) {
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
        importSource: 'CatchGame'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      setScore(0);
      scoreRef.current = 0;
      setLives(3);
      setItems([]);
      setBasketX(50);
      basketXRef.current = 50;
      setGameStartTime(Date.now()); 
      setStep("playing");
      toast.success(`गेम में आपका स्वागत है 🎮`);

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = (clientX: number) => {
    if (!gameContainerRef.current || step !== "playing") return;
    const rect = gameContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const newX = Math.max(5, Math.min(95, x));
    setBasketX(newX);
    basketXRef.current = newX; 
  };

  useEffect(() => {
    if (step !== "playing") return;

    const gameLoop = (time: number) => {
      const currentScore = scoreRef.current; 
      
      const level = Math.floor(currentScore / 1500);
      const dropSpeed = Math.max(400, 800 - (level * 20)); 
      
      if (time - lastItemTime.current > dropSpeed) {
        const bombChance = Math.min(0.35, 0.15 + (level * 0.02));
        const isBomb = Math.random() < bombChance; 
        
        const newItem = {
          id: Date.now(),
          type: isBomb ? "bomb" : "food",
          emoji: isBomb ? BOMB_ITEM : FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)],
          x: Math.random() * 90 + 5, 
          y: -10, 
          speed: Math.random() * 0.8 + 1.0 + (level * 0.05) 
        };
        setItems(prev => [...prev, newItem]);
        lastItemTime.current = time;
      }

      setItems(prev => {
        let activeItems = [...prev];
        let frameScore = 0;
        let lostLife = false;

        activeItems = activeItems.map(item => ({ ...item, y: item.y + item.speed })).filter(item => {
          if (item.y > 100) return false; 
          
          if (item.y > 85 && item.y < 95 && Math.abs(item.x - basketXRef.current) < 8) {
            if (item.type === "bomb") {
              lostLife = true;
            } else {
              frameScore += 20; 
            }
            return false; 
          }
          return true; 
        });

        if (frameScore > 0) {
          scoreRef.current += frameScore;
          setScore(scoreRef.current);
        }

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
  }, [step]);

  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    
    if (score > 0 && ((score / playTimeSeconds > 50) || score > 60000)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई! बिना मेहनत कूपन नहीं मिलेंगे!", { style: { background: "#ef4444", color: "#fff" } });
    }

    let eligibleTotalToday = 0;
    
    if (score >= 25000) {
        if (playTimeSeconds < 850) { 
           toast.error("हैक डिटेक्टेड! इतने कम समय में 25,000 संभव नहीं है।");
           setIsSaving(false); return; 
        }
        eligibleTotalToday = 20;
    } 
    else if (score >= 12000) {
        if (playTimeSeconds < 450) {
           toast.error("हैक डिटेक्टेड! इतने कम समय में 12,000 संभव नहीं है।");
           setIsSaving(false); return;
        }
        eligibleTotalToday = 10;
    }

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

      if (lastGameDate !== todayStr) {
        todayGamePoints = 0; 
      }

      // नया नियम: जीत का कैलकुलेशन
      const finalPointsToAdd = Math.max(0, eligibleTotalToday - todayGamePoints);

      if (eligibleTotalToday > 0 && finalPointsToAdd === 0) {
        if (todayGamePoints >= 20) {
           toast("आप आज की लिमिट (20 कूपन) पार कर चुके हैं।", { icon: "⚠️" });
        } else if (todayGamePoints >= 10 && eligibleTotalToday === 10) {
           toast("आप 10 कूपन पहले ही ले चुके हैं! अब 25,000 का स्कोर बनाएं।", { icon: "⚠️" });
        }
        setEarnedPoints(0);
        setIsSaving(false);
        return;
      }

      if (finalPointsToAdd > 0) {
          await setDoc(userRef, {
            gamePoints: prevGamePoints + finalPointsToAdd, 
            todayGamePoints: todayGamePoints + finalPointsToAdd,
            lastGameDate: todayStr,
            lastCatchGameScore: score 
          }, { merge: true });

          setEarnedPoints(finalPointsToAdd);
          
          localStorage.setItem("catch_game_cooldown", Date.now().toString());
          localStorage.setItem("catch_game_locked_phone", phone);

          toast.success(`बधाई हो! आपको ${finalPointsToAdd} कूपन मिले! 🎉`, { duration: 5000 });
      } else {
          setEarnedPoints(0);
          if (score < 12000) {
              toast.error("टारगेट पूरा नहीं हुआ (कम से कम 12,000 स्कोर चाहिए)!");
          }
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

  // 🛡️ 2. GameGuard (allowedGameName="CatchGame")
  return (
    <GameGuard allowedGameName="CatchGame">
      <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden touch-none relative select-none">
        <Toaster position="top-center" />
        
        {step === "login" && (
          <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
            <div className="mb-6 text-center">
              <div className="inline-block bg-yellow-500/15 text-yellow-500 px-4 py-1 rounded-full text-xs font-bold mb-2 border border-yellow-500/30">
                {tableNo}
              </div>
              <h1 className="text-2xl font-black text-yellow-400">बम बम कैफे, मोहंद्रा</h1>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <div className="text-5xl animate-bounce">🍔☕</div>
              <h2 className="text-xl font-black uppercase text-blue-400 tracking-wider">Catch & Win Game</h2>
              
              <p className="text-xs text-neutral-400 font-bold leading-relaxed">
                बर्गर और कॉफ़ी पकडें, बम (💣) से बचें।<br/>
                <span className="text-green-400 inline-block mt-1 bg-green-900/30 px-2 py-1.5 rounded-lg border border-green-500/20">
                  12,000 Score = 10 कूपन (₹10)<br/>
                  25,000 Score = 20 कूपन (₹20)
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
                  className="w-full bg-[#0f172a] border-2 border-yellow-500 text-center text-base py-3 rounded-xl outline-none text-white focus:border-yellow-400 font-mono" 
                />
                <input 
                  type="text" 
                  placeholder="आपका नाम" 
                  value={name} 
                  onChange={(e) => setName(formatNameTitleCase(e.target.value))} 
                  required 
                  className="w-full bg-[#0f172a] border-2 border-blue-500 text-center text-base py-3 rounded-xl outline-none text-white focus:border-blue-400 font-bold" 
                />
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-white font-black text-base rounded-xl tracking-wider transition-all shadow-lg shadow-green-500/20 mt-4 disabled:opacity-50"
                >
                  {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === "playing" && (
          <div 
            ref={gameContainerRef}
            className="relative w-full max-w-md h-[100dvh] bg-[#1a1a1a] overflow-hidden"
            onMouseMove={e => handleMove(e.clientX)}
            onTouchMove={e => handleMove(e.touches[0].clientX)}
          >
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 bg-black/50 px-5 py-3 rounded-2xl backdrop-blur-md border border-neutral-700">
              <div className="text-yellow-400 font-black font-mono text-2xl drop-shadow-md">Score: {score}</div>
              <div className="flex gap-1 text-2xl drop-shadow-md">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < lives ? "opacity-100" : "opacity-20 grayscale"}>❤️</span>
                ))}
              </div>
            </div>
            
            <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-10 opacity-30">
                <span className="text-white font-black text-xl tracking-widest uppercase blur-[1px]">Level {Math.floor(score / 1500)}</span>
            </div>

            {items.map(item => (
              <div 
                key={item.id} 
                className="absolute text-5xl transform -translate-x-1/2 -translate-y-1/2 transition-none drop-shadow-lg"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
              >
                {item.emoji}
              </div>
            ))}

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
                <p className="text-[11px] font-black uppercase text-green-500 tracking-wider">डिस्काउंट कूपन जीते</p>
                <p className="text-4xl font-black text-green-400 drop-shadow-md">⭐ {earnedPoints}</p>
                <p className="text-xs text-neutral-300 mt-3 font-bold leading-snug">
                  यह कूपन <span className="text-white bg-black/30 px-1 rounded">({phone})</span> पर सेव हो गए हैं। बिल बनवाते समय नंबर बताएं!
                </p>
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl space-y-2">
                 <p className="text-lg font-black uppercase text-red-500 drop-shadow-md">Better Luck Next Time! 😔</p>
                 
                 {score >= 25000 ? (
                   <p className="text-xs text-neutral-300 mt-2 font-bold leading-snug">आप आज के अधिकतम 20 कूपन पहले ही जीत चुके हैं!</p>
                 ) : score >= 12000 ? (
                   <p className="text-xs text-neutral-300 mt-2 font-bold leading-snug">आप 10 कूपन वाला इनाम पहले ही जीत चुके हैं। और कूपन पाने के लिए 25,000 स्कोर बनाएं!</p>
                 ) : (
                   <p className="text-xs text-neutral-300 mt-2 font-bold leading-snug">कम से कम 10 रुपये (10 कूपन) जीतने के लिए 12,000 स्कोर बनाना ज़रूरी है!</p>
                 )}
              </div>
            )}

            <div className="pt-4 flex flex-col gap-2">
              <button onClick={() => { 
                  setScore(0); scoreRef.current = 0; setLives(3); setItems([]); setBasketX(50); basketXRef.current = 50; setGameStartTime(Date.now()); setStep("playing"); 
                }} 
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase rounded-xl tracking-wider transition-all shadow-lg"
              >
                 🔁 फिर से खेलें (Play Again)
              </button>
              <button onClick={() => setStep("login")} className="w-full py-2 bg-transparent text-neutral-400 font-bold text-xs hover:text-white transition-all">
                 मुख्य मेनू (Main Menu)
              </button>
            </div>
          </div>
        )}
        
        {step !== "playing" && (
          <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-10">
             <div className="w-[600px] h-[600px] bg-blue-500 rounded-full blur-[150px]"></div>
          </div>
        )}
      </div>
    </GameGuard>
  );
}
