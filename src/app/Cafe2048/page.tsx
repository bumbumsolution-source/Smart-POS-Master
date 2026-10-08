"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// 🛡️ 1. Security Guard को Import किया है
import GameGuard from "@/components/GameGuard";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// 🧩 2048 के लिए कैफे आइटम्स का सीक्वेंस (Evolution)
const TILE_MAP: Record<number, { emoji: string, name: string, bg: string }> = {
  0: { emoji: "", name: "Empty", bg: "bg-neutral-800" },
  2: { emoji: "🍬", name: "Candy", bg: "bg-pink-900/40" },
  4: { emoji: "🍟", name: "Fries", bg: "bg-yellow-900/40" },
  8: { emoji: "🍦", name: "Ice Cream", bg: "bg-blue-900/40" },
  16: { emoji: "🍩", name: "Donut", bg: "bg-purple-900/40" },
  32: { emoji: "🥤", name: "Drink", bg: "bg-cyan-900/40" },
  64: { emoji: "☕", name: "Coffee", bg: "bg-amber-900/40" },
  128: { emoji: "🥪", name: "Sandwich", bg: "bg-green-900/40" },
  256: { emoji: "🌭", name: "Hotdog", bg: "bg-red-900/40" },
  512: { emoji: "🍔", name: "Burger", bg: "bg-orange-600" }, // 10 Coupons
  1024: { emoji: "🌮", name: "Taco", bg: "bg-rose-600" },
  2048: { emoji: "🍕", name: "Pizza", bg: "bg-red-600 animate-pulse border-2 border-yellow-400" } // 20 Coupons
};

export default function Cafe2048Page() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [birthDay, setBirthDay] = useState(""); 
  const [birthMonth, setBirthMonth] = useState(""); 
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  
  // 👉 NEW: Store Settings State
  const [storeNameConfig, setStoreNameConfig] = useState('Smart POS Store');

  // Load Store Name from Firebase
  useEffect(() => {
    const unsubStore = onSnapshot(doc(db, "system_settings", "store_info"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().storeName) {
        setStoreNameConfig(docSnap.data().storeName);
      }
    });
    return () => unsubStore();
  }, []);

  // गेम स्टेट्स
  const [board, setBoard] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [maxTile, setMaxTile] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // Swipe / Touch डिटेक्शन के लिए Refs
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const boardRef = useRef<number[][]>([]); // गेम लॉजिक सिंक करने के लिए

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

  // 🚀 1. गेम शुरू करने का हैंडलर
  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");
    
    // 👉 अब सबके लिए (नए और पुराने) जन्मदिन अनिवार्य है
    if (!birthDay || !birthMonth) {
      return toast.error("कृपया अपने जन्मदिन की तारीख और महीना चुनें!");
    }

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    const deviceLastPlayed = localStorage.getItem("cafe2048_cooldown");
    const lockedPhone = localStorage.getItem("cafe2048_locked_phone");

    if (deviceLastPlayed && lockedPhone) {
      if (now - parseInt(deviceLastPlayed, 10) < ONE_HOUR && lockedPhone !== cleanPhone) {
        setIsLoading(false);
        return toast.error("🚫 इस फोन से पहले ही खेला जा चुका है! कृपया 1 घंटे प्रतीक्षा करें।", { duration: 5000 });
      }
    }

    try {
      const userRef = doc(db, "customer_points", cleanPhone);
      const userSnap = await getDoc(userRef);
      let existingSpecialDates: any[] = [];

      if (userSnap.exists()) {
        const data = userSnap.data();
        existingSpecialDates = data.specialDates || [];
        const todayStr = new Date().toDateString();
        if (data.lastGameDate === todayStr && data.todayGamePoints >= 20) {
          toast("⚠️ आप आज की 20 कूपन की लिमिट पार कर चुके हैं, मजे के लिए खेलें!", { icon: '🎮' });
        }
      }

      // 👉 सबके लिए बर्थडे सेव / अपडेट करें
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
        importSource: 'Cafe2048'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      // Reset & Initialize Game Board
      initializeGame();
      setGameStartTime(Date.now());
      setStep("playing");
      toast.success("आइटम्स को स्वाइप करके जोड़ें! 🧩");

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // 🧩 2048 GAME LOGIC 🧩
  const initializeGame = () => {
    let newBoard = [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]];
    newBoard = addRandomTile(addRandomTile(newBoard));
    setBoard(newBoard);
    boardRef.current = newBoard;
    setScore(0);
    setMaxTile(0);
  };

  const addRandomTile = (currentBoard: number[][]) => {
    let emptyTiles = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) emptyTiles.push({ r, c });
      }
    }
    if (emptyTiles.length === 0) return currentBoard;
    const randomTile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    let newBoard = JSON.parse(JSON.stringify(currentBoard));
    newBoard[randomTile.r][randomTile.c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  };

  const slide = (row: number[]) => {
    let arr = row.filter(val => val);
    let missing = 4 - arr.length;
    let zeros = Array(missing).fill(0);
    return arr.concat(zeros);
  };

  const combine = (row: number[], currentScore: {val: number}, highestTile: {val: number}) => {
    for (let i = 0; i < 3; i++) {
      if (row[i] !== 0 && row[i] === row[i + 1]) {
        row[i] = row[i] * 2;
        row[i + 1] = 0;
        currentScore.val += row[i];
        if (row[i] > highestTile.val) highestTile.val = row[i];
      }
    }
    return row;
  };

  const move = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    let oldBoard = JSON.parse(JSON.stringify(boardRef.current));
    let newBoard = JSON.parse(JSON.stringify(oldBoard));
    let currentScore = { val: score };
    let highestTile = { val: maxTile };

    const moveLeft = (b: number[][]) => {
      for (let i = 0; i < 4; i++) {
        b[i] = slide(b[i]);
        b[i] = combine(b[i], currentScore, highestTile);
        b[i] = slide(b[i]);
      }
      return b;
    };

    const rotateRight = (b: number[][]) => {
      let result = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      for(let r=0; r<4; r++) for(let c=0; c<4; c++) result[c][3-r] = b[r][c];
      return result;
    };
    const rotateLeft = (b: number[][]) => {
      let result = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      for(let r=0; r<4; r++) for(let c=0; c<4; c++) result[3-c][r] = b[r][c];
      return result;
    };

    if (direction === 'LEFT') newBoard = moveLeft(newBoard);
    else if (direction === 'RIGHT') { newBoard = rotateRight(rotateRight(newBoard)); newBoard = moveLeft(newBoard); newBoard = rotateRight(rotateRight(newBoard)); }
    else if (direction === 'UP') { newBoard = rotateLeft(newBoard); newBoard = moveLeft(newBoard); newBoard = rotateRight(newBoard); }
    else if (direction === 'DOWN') { newBoard = rotateRight(newBoard); newBoard = moveLeft(newBoard); newBoard = rotateLeft(newBoard); }

    if (JSON.stringify(oldBoard) !== JSON.stringify(newBoard)) {
      newBoard = addRandomTile(newBoard);
      setBoard(newBoard);
      boardRef.current = newBoard;
      setScore(currentScore.val);
      setMaxTile(Math.max(highestTile.val, maxTile));
      
      checkGameOver(newBoard);
    }
  };

  const checkGameOver = (b: number[][]) => {
    for(let r=0; r<4; r++) for(let c=0; c<4; c++) if (b[r][c] === 0) return;
    for(let r=0; r<4; r++) {
      for(let c=0; c<4; c++) {
        if (c < 3 && b[r][c] === b[r][c+1]) return;
        if (r < 3 && b[r][c] === b[r+1][c]) return;
      }
    }
    setStep("gameover"); // No moves left
  };

  // Keyboard support (Desktop testing)
  useEffect(() => {
    if (step !== "playing") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); move('UP'); }
      if (e.key === "ArrowDown") { e.preventDefault(); move('DOWN'); }
      if (e.key === "ArrowLeft") { e.preventDefault(); move('LEFT'); }
      if (e.key === "ArrowRight") { e.preventDefault(); move('RIGHT'); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, score, maxTile]);

  // Touch Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.current.x;
    const dy = touchEnd.y - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) { 
      if (absDx > absDy) {
        if (dx > 0) move('RIGHT');
        else move('LEFT');
      } else {
        if (dy > 0) move('DOWN');
        else move('UP');
      }
    }
    touchStart.current = null;
  };

  // 🛡️ 3. गेम ओवर और डेटा सेविंग
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // Anti-Cheat (Burger (512) takes time. Pizza (2048) takes a lot of time)
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    if ((maxTile >= 512 && playTimeSeconds < 15) || (maxTile >= 2048 && playTimeSeconds < 40)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    // 👉 Pizza (2048) = 20 कूपन, Burger (512) = 10 कूपन
    let pointsWon = 0;
    if (maxTile >= 2048) pointsWon = 20;
    else if (maxTile >= 512) pointsWon = 10;

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
        lastCatchGameScore: score 
      }, { merge: true });

      setEarnedPoints(finalPointsToAdd);
      
      localStorage.setItem("cafe2048_cooldown", Date.now().toString());
      localStorage.setItem("cafe2048_locked_phone", phone);

      if (finalPointsToAdd > 0) {
        toast.success(`बधाई हो! आपको ${finalPointsToAdd} कूपन मिले! 🎉`);
      } else if (maxTile < 512) {
        toast.error("टारगेट पूरा नहीं हुआ (कम से कम 🍔 बर्गर तक पहुँचना था)!");
      }

    } catch (err) {
      toast.error("स्कोर सेव करने में समस्या आई।");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (step === "gameover") savePointsToDatabase();
  }, [step]);

  // 🛡️ 2. यहाँ हमने GameGuard का इस्तेमाल किया है (allowedGameName="Cafe2048")
  return (
    <GameGuard allowedGameName="Cafe2048">
      <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden select-none">
        <Toaster position="top-center" />
        
        {/* ---------------- LOGIN SCREEN ---------------- */}
        {step === "login" && (
          <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
            <div className="mb-6 text-center">
              <h1 className="text-4xl font-black text-amber-500 drop-shadow-md tracking-wider">Cafe 2048 🧩</h1>
              <p className="text-sm font-bold text-neutral-400 mt-1 uppercase">{storeNameConfig}</p>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700 text-left">
                उंगली से स्वाइप करके एक जैसे 2 आइटम्स को जोड़ें और बड़ा आइटम बनाएँ!<br/>
                <span className="text-amber-400 block mt-2 text-center text-sm">
                  🍔 (बर्गर) बनाया = 10 कूपन<br/>
                  🍕 (पिज़्ज़ा) बनाया = 20 कूपन
                </span>
              </p>
              
              <form onSubmit={handleStartGame} className="space-y-3 pt-2">
                <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-amber-500 text-center py-3 rounded-xl outline-none text-white focus:border-amber-400 font-mono" />
                <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-orange-500 text-center py-3 rounded-xl outline-none text-white focus:border-orange-400 font-bold" />
                
                {/* 👉 जन्मदिन वाला सेक्शन */}
                <div className="mt-3 pt-3 border-t border-[#334155] space-y-2">
                  <p className="text-[11px] font-bold text-pink-400 text-left leading-tight">
                    🎂 अपना या अपने बच्चे का असली जन्मदिन (Birth Date) चुनें <span className="text-white">(अनिवार्य)</span>:
                  </p>
                  <div className="flex gap-2">
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>जन्म की तारीख *</option>
                      {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                    </select>
                    <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>जन्म का महीना *</option>
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month:'short'})}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-yellow-400 font-bold text-left bg-yellow-900/20 p-2 rounded-lg border border-yellow-500/30">
                    ⚠️ कृपया आज की तारीख न चुनें। अपना असली जन्मदिन ही डालें ताकि आपको आपके जन्मदिन पर स्पेशल गिफ्ट मिल सके!
                  </p>
                </div>

                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4">
                  {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING SCREEN ---------------- */}
        {step === "playing" && (
          <div className="w-full max-w-sm px-4 flex flex-col items-center justify-center h-[100dvh]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="w-full flex justify-between items-center mb-6">
               <div>
                 <h2 className="text-2xl font-black text-amber-500">Cafe 2048</h2>
                 <p className="text-[10px] text-neutral-400">Target: 🍔 or 🍕</p>
               </div>
               <div className="bg-[#1e293b] border border-[#334155] px-4 py-2 rounded-xl text-center shadow-lg">
                  <p className="text-[9px] font-black uppercase text-neutral-400">Score</p>
                  <p className="text-xl font-mono font-black text-white">{score}</p>
               </div>
            </div>
            
            <div className="w-full bg-[#1e293b] p-3 rounded-xl border border-neutral-700 mb-4 flex justify-between items-center text-xl">
               <div className={`opacity-50 ${maxTile >= 512 ? 'opacity-100 scale-125 transition-transform' : ''}`}>🍔</div>
               <div className="h-1 flex-1 bg-neutral-700 mx-3 rounded">
                 <div className="h-1 bg-amber-500 rounded transition-all" style={{width: `${Math.min(100, (maxTile/2048)*100)}%`}}></div>
               </div>
               <div className={`opacity-50 ${maxTile >= 2048 ? 'opacity-100 scale-125 transition-transform' : ''}`}>🍕</div>
            </div>

            <div className="bg-[#a67c52] p-2 rounded-2xl shadow-[inset_0_4px_15px_rgba(0,0,0,0.5)] touch-none">
              <div className="grid grid-cols-4 gap-2">
                {board.map((row, r) => 
                  row.map((val, c) => (
                    <div 
                      key={`${r}-${c}`} 
                      className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center text-4xl shadow-sm transition-all duration-150 ${TILE_MAP[val]?.bg}`}
                    >
                      <span className={`${val > 0 ? 'scale-100 animate-[pop_0.2s_ease-in-out]' : 'scale-0'}`}>
                        {TILE_MAP[val]?.emoji}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 text-neutral-500 text-[10px] uppercase font-bold tracking-widest">
              Swipe Up, Down, Left, Right
            </div>
            
            <button onClick={() => setStep("gameover")} className="mt-4 px-4 py-2 bg-red-900/50 text-red-400 rounded-lg text-[10px] font-black uppercase border border-red-900">
              End Game
            </button>
          </div>
        )}

        {/* ---------------- GAME OVER SCREEN ---------------- */}
        {step === "gameover" && (
          <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
            <div className="text-6xl">{maxTile >= 512 ? '🎉' : '💥'}</div>
            <h2 className="text-3xl font-black uppercase text-amber-500 tracking-wider">Game Over</h2>
            
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#334155]">
              <p className="text-xs font-bold text-neutral-400 uppercase">Your Final Score</p>
              <p className="text-5xl font-mono font-black text-amber-400 mt-2">{score}</p>
              <p className="text-[10px] mt-2 text-neutral-500">Biggest Item: {TILE_MAP[maxTile]?.emoji} {TILE_MAP[maxTile]?.name}</p>
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
                   कूपन जीतने के लिए कम से कम 🍔 (बर्गर) तक पहुँचना ज़रूरी है।
                 </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => {
                  initializeGame();
                  setGameStartTime(Date.now());
                  setStep("playing");
                }} 
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm uppercase rounded-xl shadow-lg"
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
