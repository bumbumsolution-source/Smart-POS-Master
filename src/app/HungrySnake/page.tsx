"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

const FOOD_EMOJIS = ["🍔", "🍕", "🍟", "🍩", "🥤", "🍦"];

const GRID_SIZE = 20;

export default function HungrySnakePage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState(""); 
  const [birthMonth, setBirthMonth] = useState(""); 
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // गेम UI स्टेट्स
  const [score, setScore] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);

  // Canvas & Game Logic Refs (60fps स्मूथ और बिना लैग के लिए)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  const gameState = useRef({
    snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }],
    direction: { x: 0, y: -1 },
    nextDirection: { x: 0, y: -1 },
    food: { x: 5, y: 5, emoji: "🍔" },
    lastMoveTime: 0,
    speed: 200 // शुरुआत में 200ms में एक कदम
  });

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
        }
      });
    } else {
      setIsReturningUser(false);
    }
  }, [phone]);

  // 🐍 स्नेक गेम इंजन (TypeScript Error Fixed)
  const spawnFood = (snakeBody: {x: number, y: number}[]) => {
    while (true) {
      const newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
      };
      // Check if food spawned on snake
      const onSnake = snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) return newFood; // 👉 Fix: लूप के अंदर ही रिटर्न कर दिया
    }
  };

  // 🚀 1. गेम शुरू करने का हैंडलर
  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");
    if (!isReturningUser && (!birthDay || !birthMonth)) return toast.error("कृपया अपना जन्मदिन चुनें!");

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

      if (!isReturningUser && birthDay && birthMonth) {
        const formattedDate = `2000-${birthMonth}-${birthDay}`;
        if (!existingSpecialDates.some((d: any) => d.type === 'Birthday' && d.name === cleanName)) {
          existingSpecialDates.push({ type: 'Birthday', date: formattedDate, name: cleanName });
        }
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        specialDates: existingSpecialDates, 
        lastActive: serverTimestamp(),
        importSource: 'HungrySnake'
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
        speed: 200
      };
      setGameStartTime(Date.now());
      setStep("playing");
      toast.success("स्वाइप करके सांप को घुमाएं 🐍");

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "playing" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Responsive Canvas
    const size = Math.min(window.innerWidth * 0.95, 400);
    canvas.width = size;
    canvas.height = size;
    const TILE_SIZE = size / GRID_SIZE;

    const gameLoop = (time: number) => {
      const state = gameState.current;
      
      if (time - state.lastMoveTime > state.speed) {
        // Move Snake
        state.direction = { ...state.nextDirection };
        const newHead = {
          x: state.snake[0].x + state.direction.x,
          y: state.snake[0].y + state.direction.y
        };

        // 💥 Collision with Wall
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setStep("gameover");
          return;
        }

        // 💥 Collision with Self
        if (state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setStep("gameover");
          return;
        }

        state.snake.unshift(newHead);

        // 🍔 Eat Food
        if (newHead.x === state.food.x && newHead.y === state.food.y) {
          setScore(s => {
            const newScore = s + 1;
            // स्पीड बढ़ाएं (Maximum speed = 80ms)
            state.speed = Math.max(80, 200 - (newScore * 2));
            return newScore;
          });
          state.food = spawnFood(state.snake);
        } else {
          state.snake.pop(); // Remove tail if no food eaten
        }

        state.lastMoveTime = time;
      }

      // 🎨 Draw Game
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Grid (Optional subtle background)
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Food
      ctx.font = `${TILE_SIZE * 0.8}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.food.emoji, state.food.x * TILE_SIZE + TILE_SIZE/2, state.food.y * TILE_SIZE + TILE_SIZE/2);

      // Draw Snake
      state.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? "#22c55e" : "#16a34a"; // Head is lighter green
        ctx.beginPath();
        ctx.roundRect(segment.x * TILE_SIZE + 1, segment.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2, 4);
        ctx.fill();

        // Eyes for head
        if (index === 0) {
          ctx.fillStyle = "white";
          const eyeOffset = TILE_SIZE * 0.25;
          const eyeSize = TILE_SIZE * 0.15;
          ctx.beginPath();
          ctx.arc(segment.x * TILE_SIZE + TILE_SIZE/2 - eyeOffset, segment.y * TILE_SIZE + TILE_SIZE/2 - eyeOffset, eyeSize, 0, Math.PI * 2);
          ctx.arc(segment.x * TILE_SIZE + TILE_SIZE/2 + eyeOffset, segment.y * TILE_SIZE + TILE_SIZE/2 - eyeOffset, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    // Swipe Detection Logic
    const onTouchStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      const { direction, nextDirection } = gameState.current;

      if (Math.max(absDx, absDy) > 20) {
        if (absDx > absDy) {
          if (dx > 0 && direction.x !== -1) nextDirection.x = 1, nextDirection.y = 0; // Right
          else if (dx < 0 && direction.x !== 1) nextDirection.x = -1, nextDirection.y = 0; // Left
        } else {
          if (dy > 0 && direction.y !== -1) nextDirection.x = 0, nextDirection.y = 1; // Down
          else if (dy < 0 && direction.y !== 1) nextDirection.x = 0, nextDirection.y = -1; // Up
        }
      }
      touchStart.current = null;
    };

    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(requestRef.current!);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [step]);

  // 🛡️ 3. गेम ओवर और डेटा सेविंग
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // Anti-Cheat (Minimum time required to get 30 score)
    const playTimeSeconds = (Date.now() - gameStartTime) / 1000;
    if (score > 0 && (score / playTimeSeconds > 5)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    // 👉 30 फ़ूड = 10 कूपन, 60 फ़ूड = 20 कूपन
    let pointsWon = 0;
    if (score >= 60) pointsWon = 20;
    else if (score >= 30) pointsWon = 10;

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
        lastCatchGameScore: score // POS में दिखाने के लिए
      }, { merge: true });

      setEarnedPoints(finalPointsToAdd);
      
      localStorage.setItem("snake_cooldown", Date.now().toString());
      localStorage.setItem("snake_locked_phone", phone);

      if (finalPointsToAdd > 0) {
        toast.success(`बधाई हो! आपको ${finalPointsToAdd} कूपन मिले! 🎉`);
      } else if (score < 30) {
        toast.error("टारगेट पूरा नहीं हुआ (कम से कम 30 स्कोर चाहिए)!");
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
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans flex flex-col justify-center items-center overflow-hidden select-none touch-none">
      <Toaster position="top-center" />
      
      {/* ---------------- LOGIN SCREEN ---------------- */}
      {step === "login" && (
        <div className="w-full max-w-sm px-4 z-10">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-black text-green-500 drop-shadow-md tracking-wider">Hungry Snake 🐍</h1>
            <p className="text-sm font-bold text-neutral-400 mt-1">बम बम कैफे, मोहंद्रा</p>
          </div>

          <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
            <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700 text-left">
              स्क्रीन पर उंगली फेर कर (Swipe) सांप को घुमाएं और बर्गर-पिज़्ज़ा खिलाएं! 🍔<br/>
              <span className="text-green-400 block mt-2 text-center text-sm">
                30 स्कोर = 10 कूपन (₹10)<br/>
                60 स्कोर = 20 कूपन (₹20)
              </span>
            </p>
            
            <form onSubmit={handleStartGame} className="space-y-3 pt-2">
              <input type="tel" maxLength={10} placeholder="10-अंकों का মোবাইল नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3 rounded-xl outline-none text-white focus:border-green-400 font-mono" />
              <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3 rounded-xl outline-none text-white focus:border-green-400 font-bold" />
              
              {!isReturningUser && (
                <div className="flex gap-2">
                  <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none">
                    <option value="" disabled>दिन (Day) *</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                  </select>
                  <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required className="w-1/2 bg-[#0f172a] border-2 border-pink-500 text-center text-sm py-3 rounded-xl outline-none appearance-none">
                    <option value="" disabled>महीना (Month) *</option>
                    {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month:'short'})}</option>)}
                  </select>
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-2">
                {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- PLAYING SCREEN ---------------- */}
      {step === "playing" && (
        <div className="w-full flex flex-col items-center justify-center h-[100dvh]">
          {/* Header Stats */}
          <div className="w-full max-w-sm px-4 flex justify-between items-center mb-6">
             <div>
               <h2 className="text-2xl font-black text-green-500 tracking-wider">Snake 🐍</h2>
               <p className="text-[10px] text-neutral-400">Target: 30 / 60</p>
             </div>
             <div className="bg-[#1e293b] border border-[#334155] px-6 py-2 rounded-xl text-center shadow-lg">
                <p className="text-[9px] font-black uppercase text-neutral-400">Score</p>
                <p className="text-2xl font-mono font-black text-white">{score}</p>
             </div>
          </div>

          {/* Game Canvas */}
          <div className="rounded-xl overflow-hidden border-4 border-[#334155] shadow-2xl relative bg-[#1e293b]">
             <canvas ref={canvasRef} />
             <div className="absolute inset-0 pointer-events-none border border-black/20 rounded-xl"></div>
          </div>

          <div className="mt-8 text-neutral-500 text-[10px] uppercase font-bold tracking-widest bg-black/40 px-4 py-2 rounded-full">
            👆 Swipe to Move 👆
          </div>
        </div>
      )}

      {/* ---------------- GAME OVER SCREEN ---------------- */}
      {step === "gameover" && (
        <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
          <div className="text-6xl">{score >= 30 ? '🎉' : '💥'}</div>
          <h2 className="text-3xl font-black uppercase text-green-500 tracking-wider">Game Over</h2>
          
          <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#334155]">
            <p className="text-xs font-bold text-neutral-400 uppercase">Your Final Score</p>
            <p className="text-6xl font-mono font-black text-green-400 mt-2">{score}</p>
          </div>

          {isSaving ? (
             <p className="text-sm text-neutral-400 animate-pulse font-bold">स्कोर चेक हो रहा है...</p>
          ) : earnedPoints > 0 ? (
            <div className="bg-green-900/20 border border-green-500/30 p-5 rounded-2xl">
              <p className="text-[11px] font-black uppercase text-green-500">डिस्काउंट कूपन जीते</p>
              <p className="text-4xl font-black text-green-400 mt-1">🎟️ {earnedPoints}</p>
              <p className="text-xs text-neutral-300 mt-3 font-bold">
                कूपन <span className="text-yellow-400">({phone})</span> पर सेव हो गए हैं। बिल बनवाते समय नंबर बताएं!
              </p>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
               <p className="text-sm font-black text-red-400">Better Luck Next Time! 😔</p>
               <p className="text-xs text-neutral-400 mt-2">
                 कूपन जीतने के लिए कम से कम 30 स्कोर (30 फ़ूड) खाना ज़रूरी है।
               </p>
            </div>
          )}

          <button onClick={() => setStep("login")} className="w-full py-3.5 bg-blue-600 text-white font-black text-sm uppercase rounded-xl shadow-lg">
             मुख्य मेनू (Main Menu)
          </button>
        </div>
      )}
    </div>
  );
}
