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
  const [globalHighScore, setGlobalHighScore] = useState(30); // डिफ़ॉल्ट टारगेट 30
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

  // 📡 Real-time Leaderboard Fetch (सभी मोबाइल्स पर लाइव दिखेगा)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "leaderboards", "HungrySnake"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalHighScore(docSnap.data().topScore || 30);
        setGlobalHighScorer(docSnap.data().topName || "बम बम कैफे");
      }
    });
    return () => unsub();
  }, []);

  // ऑटो-फिल
  useEffect(() => {
    if (phone.length === 10) {
      getDoc(doc(db, "customer_points", phone)).then((snap) => {
        if (snap.exists() && snap.data().name) {
          setName(snap.data().name); 
        } else {
          setName("");
        }
      });
    }
  }, [phone]);

  // 🚀 1. गेम शुरू करने का हैंडलर
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
      
      // Reset Game 
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

    const size = 260; 
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

        // 💥 खुद से टकराना (Game Over)
        if (state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setStep("gameover");
          return;
        }

        state.snake.unshift(newHead);

        // 🍔 खाना
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

      // 🎨 Draw Nokia Retro Screen
      ctx.fillStyle = "#8CC084";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#82b47a";
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * TILE_SIZE, 0); ctx.lineTo(i * TILE_SIZE, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * TILE_SIZE); ctx.lineTo(canvas.width, i * TILE_SIZE); ctx.stroke();
      }

      ctx.font = `${TILE_SIZE * 0.8}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.food.emoji, state.food.x * TILE_SIZE + TILE_SIZE/2, state.food.y * TILE_SIZE + TILE_SIZE/2);

      ctx.fillStyle = "#202B19"; 
      state.snake.forEach((segment) => {
        ctx.fillRect(segment.x * TILE_SIZE + 1, segment.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      });

      // Score Text inside Screen
      ctx.fillStyle = "#202B19";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${score}`, 6, 6);

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);

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

  const handleDirectionButton = (dx: number, dy: number) => {
    const { direction, nextDirection } = gameState.current;
    if (dx !== 0 && direction.x !== -dx) { nextDirection.x = dx; nextDirection.y = 0; }
    if (dy !== 0 && direction.y !== -dy) { nextDirection.x = 0; nextDirection.y = dy; }
  };

  // 🛡️ 3. गेम ओवर और नया लीडरबोर्ड सेविंग लॉजिक
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    if (score > 0 && (score / playTimeSeconds > 6)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    // 🏆 नया नियम: अगर पिछले चैंपियन का रिकॉर्ड तोड़ा, तो जीतेंगे 20 कूपन
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

      // यूजर का डेटा अपडेट करें
      await setDoc(userRef, {
        gamePoints: prevGamePoints + finalPointsToAdd, 
        todayGamePoints: todayGamePoints + finalPointsToAdd,
        lastGameDate: todayStr,
        lastCatchGameScore: score 
      }, { merge: true });

      // 🏆 ग्लोबल लीडरबोर्ड अपडेट करें (अगर रिकॉर्ड टूटा है)
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
            
            {/* 🏆 LIVE LEADERBOARD BANNER */}
            <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-2xl p-4 mb-6 text-center shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-pulse-slow">
              <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1">👑 Current Champion 👑</p>
              <h2 className="text-2xl font-black text-white drop-shadow-md">{globalHighScorer}</h2>
              <div className="inline-block bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-black mt-2 shadow-lg">
                High Score: {globalHighScore}
              </div>
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black text-green-500 drop-shadow-md tracking-wider font-mono">RETRO SNAKE 🐍</h1>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700 text-left">
                बचपन की यादें! कूपन जीतने के लिए आपको <strong className="text-yellow-400">{globalHighScorer}</strong> का रिकॉर्ड <strong className="text-yellow-400">({globalHighScore} Score)</strong> तोड़ना होगा!<br/>
                <span className="text-green-400 block mt-2 text-center text-[11px]">
                  रिकॉर्ड तोड़ने पर मिलेंगे = 20 कूपन (₹20) 🎟️
                </span>
              </p>
              
              <form onSubmit={handleStartGame} className="space-y-3 pt-2">
                <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3 rounded-xl outline-none text-white focus:border-green-400 font-mono" />
                <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3 rounded-xl outline-none text-white focus:border-green-400 font-bold" />
                
                <div className="mt-3 pt-3 border-t border-[#334155] space-y-2">
                  <div className="flex gap-2">
                    <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>जन्म तारीख *</option>
                      {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                    </select>
                    <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none text-white">
                      <option value="" disabled>जन्म महीना *</option>
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month:'short'})}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4">
                  {isLoading ? "प्रतीक्षा करें..." : `▶ रिकॉर्ड तोड़ें (Target: ${globalHighScore + 1})`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING SCREEN (NOKIA 3310 UI) ---------------- */}
        {step === "playing" && (
          <div className="w-full flex flex-col items-center justify-center h-[100dvh]">
            
            <div className="relative bg-[#1c2938] w-[340px] h-[650px] rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_-10px_20px_rgba(255,255,255,0.1)] border-[6px] border-[#0f172a] flex flex-col items-center pt-8 pb-10">
              
              <div className="text-neutral-400/60 text-lg font-black tracking-widest mb-4 font-mono">
                BAM BAM 3310
              </div>
              
              <div className="bg-[#111] p-3 rounded-2xl shadow-inner mb-6 relative">
                {/* Score Target Overlay (छोटे अक्षरों में ऊपर दिखेगा) */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow-md">
                  Target: {globalHighScore + 1}
                </div>
                
                <div className="rounded-xl overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] bg-[#8CC084] border-4 border-[#333]">
                   <canvas ref={canvasRef} className="block" />
                </div>
              </div>

              <div className="text-center mb-6">
                <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">
                  👆 Swipe or Use Buttons 👇
                </p>
                <p className="text-yellow-600/80 text-[10px] font-bold mt-1">Break {globalHighScorer}'s Record!</p>
              </div>

              {/* Classic Physical-looking D-PAD */}
              <div className="grid grid-cols-3 gap-2 mt-auto w-full px-12">
                <div />
                <button onClick={() => handleDirectionButton(0, -1)} className="bg-[#2a3a52] text-neutral-300 w-16 h-12 rounded-t-2xl shadow-[0_5px_0_#0f172a] active:shadow-[0_0px_0_#0f172a] active:translate-y-[5px] mx-auto flex items-center justify-center text-xl font-black">▲</button>
                <div />
                <button onClick={() => handleDirectionButton(-1, 0)} className="bg-[#2a3a52] text-neutral-300 w-16 h-12 rounded-l-2xl shadow-[0_5px_0_#0f172a] active:shadow-[0_0px_0_#0f172a] active:translate-y-[5px] ml-auto flex items-center justify-center text-xl font-black">◀</button>
                <button className="bg-[#3b4c6b] text-neutral-400 w-16 h-12 rounded-xl shadow-[0_5px_0_#0f172a] active:shadow-[0_0px_0_#0f172a] active:translate-y-[5px] mx-auto flex items-center justify-center text-xs font-black">OK</button>
                <button onClick={() => handleDirectionButton(1, 0)} className="bg-[#2a3a52] text-neutral-300 w-16 h-12 rounded-r-2xl shadow-[0_5px_0_#0f172a] active:shadow-[0_0px_0_#0f172a] active:translate-y-[5px] mr-auto flex items-center justify-center text-xl font-black">▶</button>
                <div />
                <button onClick={() => handleDirectionButton(0, 1)} className="bg-[#2a3a52] text-neutral-300 w-16 h-12 rounded-b-2xl shadow-[0_5px_0_#0f172a] active:shadow-[0_0px_0_#0f172a] active:translate-y-[5px] mx-auto flex items-center justify-center text-xl font-black">▼</button>
                <div />
              </div>
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
