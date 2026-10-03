"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// 🛡️ Security Guard 
import GameGuard from "@/components/GameGuard";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

const FOOD_EMOJIS = ["🍔", "🍕", "🍟", "🍩", "🥤", "🍦"];
const GRID_SIZE = 20;

export default function RetroSnakePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [birthDay, setBirthDay] = useState(""); 
  const [birthMonth, setBirthMonth] = useState(""); 
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  
  const [isLoading, setIsLoading] = useState(false);
  
  // 🏆 Leaderboard States
  const [globalHighScore, setGlobalHighScore] = useState(30); 
  const [globalHighScorer, setGlobalHighScorer] = useState("बम बम कैफे");

  // गेम UI स्टेट्स
  const [score, setScore] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);

  // Canvas & Game Logic Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  // 🐍 स्नेक फ़ूड स्पॉनर 
  const spawnFood = (snakeBody: {x: number, y: number}[]) => {
    while (true) {
      const newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
      };
      const onSnake = snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) return newFood;
    }
  };

  const gameState = useRef({
    snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }],
    direction: { x: 0, y: -1 },
    nextDirection: { x: 0, y: -1 },
    food: { x: 5, y: 5, emoji: "🍔" },
    lastMoveTime: 0,
    speed: 180 
  });

  // URL से टेबल नंबर
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("table");
      setTableNo(t && /^[0-9]{1,2}$/.test(t) ? `टेबल नं: ${t}` : "सामान्य टेबल");
    }
  }, []);

  // 📡 Real-time Leaderboard Fetch 
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "leaderboards", "HungrySnake"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalHighScore(docSnap.data().topScore || 30);
        setGlobalHighScorer(docSnap.data().topName || "बम बम कैफे");
      }
    });
    return () => unsub();
  }, []);

  // 🚀 ऑटो-फिल लॉजिक (अब जन्मतिथि भी ऑटो-फिल होगी)
  useEffect(() => {
    if (phone.length === 10) {
      getDoc(doc(db, "customer_points", phone)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setName(data.name);
          
          // चेक करें कि क्या जन्मदिन सेव है
          if (data.specialDates && Array.isArray(data.specialDates)) {
            const bdayObj = data.specialDates.find((d: any) => d.type === "Birthday");
            if (bdayObj && bdayObj.date) {
              const parts = bdayObj.date.split('-'); // Format is 'YYYY-MM-DD'
              if (parts.length === 3) {
                setBirthMonth(parts[1]); // MM
                setBirthDay(parts[2]);   // DD
              }
            }
          }
        } else {
          setName("");
          setBirthDay("");
          setBirthMonth("");
        }
      });
    } else {
      // अगर नंबर 10 अंकों से कम है तो नाम और डेट खाली कर सकते हैं
      setName("");
      setBirthDay("");
      setBirthMonth("");
    }
  }, [phone]);

  // 🚀 गेम शुरू करने का हैंडलर
  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");
    if (!birthDay || !birthMonth) return toast.error("कृपया अपने जन्मदिन की तारीख और महीना चुनें!");

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    const deviceLastPlayed = localStorage.getItem("snake_cooldown");
    const lockedPhone = localStorage.getItem("snake_locked_phone");

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
        importSource: 'ClassicSnake'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      setScore(0);
      gameState.current = {
        snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }],
        direction: { x: 0, y: -1 },
        nextDirection: { x: 0, y: -1 },
        food: spawnFood([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]),
        lastMoveTime: Date.now(), 
        speed: 180
      };
      setGameStartTime(Date.now());
      setStep("playing");
      toast.success(`टारगेट: ${globalHighScore + 1} स्कोर बनाएं और जीतें! 🏆`);

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // 🎮 गेम लूप और कंट्रोल्स
  useEffect(() => {
    if (step !== "playing" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 🚀 स्क्रीन के हिसाब से परफेक्ट चौड़ाई
    const size = Math.min(window.innerWidth * 0.92, 420); 
    canvas.width = size;
    canvas.height = size;
    const TILE_SIZE = size / GRID_SIZE;

    const gameLoop = () => {
      const state = gameState.current;
      const now = Date.now(); 

      if (now - state.lastMoveTime > state.speed) {
        state.direction = { ...state.nextDirection };
        
        let newX = state.snake[0].x + state.direction.x;
        let newY = state.snake[0].y + state.direction.y;

        // Wrap Around Logic (दीवार के आर-पार)
        if (newX < 0) newX = GRID_SIZE - 1;
        else if (newX >= GRID_SIZE) newX = 0;
        if (newY < 0) newY = GRID_SIZE - 1;
        else if (newY >= GRID_SIZE) newY = 0;

        const newHead = { x: newX, y: newY };

        // खुद से टकराना
        if (state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setStep("gameover");
          return;
        }

        state.snake.unshift(newHead);

        // खाना खाना
        if (newHead.x === state.food.x && newHead.y === state.food.y) {
          setScore(s => {
            const newScore = s + 1;
            state.speed = Math.max(50, 180 - (newScore * 2)); 
            return newScore;
          });
          state.food = spawnFood(state.snake);
        } else {
          state.snake.pop(); 
        }

        state.lastMoveTime = now;
      }

      // 🎨 Draw Canvas Background (Brighter & Clearer Green)
      ctx.fillStyle = "#A8D08D"; // साफ और चमकदार रेट्रो हरा
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle Grid Lines
      ctx.strokeStyle = "#9BBE83"; 
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * TILE_SIZE, 0); ctx.lineTo(i * TILE_SIZE, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * TILE_SIZE); ctx.lineTo(canvas.width, i * TILE_SIZE); ctx.stroke();
      }

      // Draw Food (बड़ा और साफ इमोजी)
      ctx.font = `${TILE_SIZE * 0.9}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.food.emoji, state.food.x * TILE_SIZE + TILE_SIZE/2, state.food.y * TILE_SIZE + TILE_SIZE/2);

      // Draw Snake (गहरा रंग ताकि एकदम साफ दिखे)
      ctx.fillStyle = "#1A2315"; // Very dark green, almost black
      state.snake.forEach((segment) => {
        // हल्का सा राउंडेड और बड़ा पिक्सल
        ctx.fillRect(segment.x * TILE_SIZE + 0.5, segment.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      });

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    // 👆 Swipe Controls
    const onTouchStart = (e: TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      const { direction, nextDirection } = gameState.current;

      if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) {
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && direction.x !== -1) { nextDirection.x = 1; nextDirection.y = 0; }
          else if (dx < 0 && direction.x !== 1) { nextDirection.x = -1; nextDirection.y = 0; }
        } else {
          if (dy > 0 && direction.y !== -1) { nextDirection.x = 0; nextDirection.y = 1; }
          else if (dy < 0 && direction.y !== 1) { nextDirection.x = 0; nextDirection.y = -1; }
        }
      }
      touchStart.current = null;
    };

    // Keyboard (for PC)
    const onKeyDown = (e: KeyboardEvent) => {
      const { direction, nextDirection } = gameState.current;
      if (e.key === "ArrowUp" && direction.y !== 1) { nextDirection.x = 0; nextDirection.y = -1; }
      else if (e.key === "ArrowDown" && direction.y !== -1) { nextDirection.x = 0; nextDirection.y = 1; }
      else if (e.key === "ArrowLeft" && direction.x !== 1) { nextDirection.x = -1; nextDirection.y = 0; }
      else if (e.key === "ArrowRight" && direction.x !== -1) { nextDirection.x = 1; nextDirection.y = 0; }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(requestRef.current!);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [step, score]);

  // 🛡️ गेम ओवर 
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    if (score > 0 && (score / playTimeSeconds > 6)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    let pointsWon = 0;
    let isNewRecord = false;
    
    if (score > globalHighScore) {
      pointsWon = 20; 
      isNewRecord = true;
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
      }

      await setDoc(userRef, {
        gamePoints: prevGamePoints + finalPointsToAdd, 
        todayGamePoints: todayGamePoints + finalPointsToAdd,
        lastGameDate: todayStr,
        lastCatchGameScore: score 
      }, { merge: true });

      if (isNewRecord) {
        const cleanName = formatNameTitleCase(name.trim());
        await setDoc(doc(db, "leaderboards", "HungrySnake"), {
          topScore: score,
          topName: cleanName,
          timestamp: serverTimestamp()
        });
      }

      setEarnedPoints(finalPointsToAdd);
      localStorage.setItem("snake_cooldown", Date.now().toString());
      localStorage.setItem("snake_locked_phone", phone);

      if (isNewRecord && finalPointsToAdd > 0) {
        toast.success(`बधाई हो! आपने रिकॉर्ड तोड़ दिया और ${finalPointsToAdd} कूपन जीते! 🎉`, { duration: 5000 });
      } else if (isNewRecord) {
        toast.success(`आपने रिकॉर्ड तोड़ दिया! आप नए चैंपियन हैं! 👑`);
      } else {
        toast.error(`टारगेट पूरा नहीं हुआ! रिकॉर्ड तोड़ने के लिए ${globalHighScore + 1} स्कोर चाहिए था।`);
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

  return (
    <GameGuard allowedGameName="HungrySnake">
      <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden select-none touch-none">
        <Toaster position="top-center" />
        
        {/* ---------------- LOGIN SCREEN ---------------- */}
        {step === "login" && (
          <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
            
            <div className="bg-gradient-to-br from-yellow-900/60 to-yellow-700/20 border border-yellow-500/50 rounded-2xl p-5 mb-6 text-center shadow-[0_0_20px_rgba(234,179,8,0.25)] animate-pulse-slow">
              <p className="text-yellow-400 text-[11px] font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-2"><span>🏆</span> Current Champion <span>🏆</span></p>
              <h2 className="text-3xl font-black text-white drop-shadow-lg mt-1">{globalHighScorer}</h2>
              <div className="inline-block bg-yellow-500 text-black px-5 py-1.5 rounded-full text-sm font-black mt-3 shadow-lg border border-yellow-300">
                High Score: {globalHighScore}
              </div>
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-4xl font-black text-green-500 drop-shadow-md tracking-wider">SNAKE 🐍</h1>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-4 rounded-xl border border-neutral-700 text-left">
                बचपन की यादें! कूपन जीतने के लिए आपको <strong className="text-yellow-400">{globalHighScorer}</strong> का रिकॉर्ड <strong className="text-yellow-400">({globalHighScore} Score)</strong> तोड़ना होगा!<br/>
                <span className="text-green-400 block mt-2 text-center text-xs bg-green-900/20 py-2 rounded-lg border border-green-500/20">
                  रिकॉर्ड तोड़ने पर मिलेंगे = 20 कूपन (₹20) 🎟️
                </span>
              </p>
              
              <form onSubmit={handleStartGame} className="space-y-3 pt-2">
                <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3.5 rounded-xl outline-none text-white focus:border-green-400 font-mono" />
                <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3.5 rounded-xl outline-none text-white focus:border-green-400 font-bold" />
                
                <div className="mt-3 pt-3 border-t border-[#334155] space-y-2">
                  <div className="flex gap-2">
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3.5 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>जन्म तारीख *</option>
                      {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                    </select>
                    <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3.5 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>महीना *</option>
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month:'short'})}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4 transition-all">
                  {isLoading ? "प्रतीक्षा करें..." : `▶ रिकॉर्ड तोड़ें (Target: ${globalHighScore + 1})`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING SCREEN (FULL SCREEN CANVAS) ---------------- */}
        {step === "playing" && (
          <div className="w-full flex flex-col items-center justify-center h-[100dvh] px-4 relative">
            
            {/* 🏆 Header - Bum Bum Cafe Branding */}
            <div className="w-full max-w-[420px] flex justify-between items-end mb-6">
               <div>
                 <h2 className="text-3xl font-black text-green-400 tracking-wider drop-shadow-[0_2px_10px_rgba(74,222,128,0.5)] leading-none">BUM BUM CAFE</h2>
                 <p className="text-[13px] text-green-600 font-black uppercase tracking-[0.2em] mt-1 ml-1">Mohandra</p>
               </div>
               
               <div className="flex flex-col items-end">
                 <p className="text-[10px] text-neutral-400 font-bold uppercase mb-1 mr-1">Your Score: {score}</p>
                 <div className="bg-yellow-500 text-black px-4 py-1.5 rounded-full text-xs font-black shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-300">
                   Target: {globalHighScore + 1}
                 </div>
               </div>
            </div>

            {/* 🟩 Beautiful Glowing Canvas Frame */}
            <div className="p-2 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.15)] bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50">
               <div className="rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] border-4 border-[#1A2315]">
                  <canvas ref={canvasRef} className="block bg-[#A8D08D]" />
               </div>
            </div>

            {/* 👆 Swipe Instruction */}
            <div className="mt-10 animate-bounce">
              <p className="text-neutral-300 text-[11px] uppercase font-black tracking-widest bg-[#1e293b]/80 px-6 py-3 rounded-full border border-neutral-600 shadow-[0_5px_20px_rgba(0,0,0,0.5)] flex gap-3 items-center backdrop-blur-sm">
                <span>👆</span> Swipe On Screen to Play <span>👇</span>
              </p>
            </div>

          </div>
        )}

        {/* ---------------- GAME OVER SCREEN ---------------- */}
        {step === "gameover" && (
          <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
            
            <div className="text-6xl">{score > globalHighScore ? '🏆' : '💥'}</div>
            
            <h2 className={`text-3xl font-black uppercase tracking-wider ${score > globalHighScore ? 'text-yellow-400' : 'text-red-500'}`}>
              {score > globalHighScore ? 'NEW CHAMPION!' : 'Game Over'}
            </h2>
            
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#334155]">
              <p className="text-xs font-bold text-neutral-400 uppercase">Your Final Score</p>
              <p className={`text-6xl font-mono font-black mt-2 ${score > globalHighScore ? 'text-yellow-400' : 'text-green-400'}`}>
                {score}
              </p>
            </div>

            {isSaving ? (
               <p className="text-sm text-neutral-400 animate-pulse font-bold">स्कोर चेक हो रहा है...</p>
            ) : earnedPoints > 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-500/30 p-5 rounded-2xl">
                <p className="text-[11px] font-black uppercase text-yellow-500">आपने रिकॉर्ड तोड़ दिया!</p>
                <p className="text-4xl font-black text-yellow-400 mt-1">🎟️ {earnedPoints} कूपन</p>
                <p className="text-xs text-neutral-300 mt-3 font-bold">
                  आप कैफे के नए किंग हैं! कूपन <span className="text-white bg-black/30 px-1 rounded">({phone})</span> पर सेव हो गए हैं।
                </p>
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
                 <p className="text-sm font-black text-red-400">Better Luck Next Time! 😔</p>
                 <p className="text-xs text-neutral-400 mt-2">
                   रिकॉर्ड तोड़ने के लिए आपको कम से कम <strong className="text-white">{globalHighScore + 1}</strong> स्कोर बनाना था।
                 </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => window.location.reload()} 
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-sm uppercase rounded-xl shadow-lg"
              >
                 🔁 फिर से खेलें (Main Menu)
              </button>
            </div>
          </div>
        )}
      </div>
    </GameGuard>
  );
}
