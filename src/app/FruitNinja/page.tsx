"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";

// 🛡️ 1. Security Guard को Import किया है
import GameGuard from "@/components/GameGuard";

// नाम को सही फॉर्मेट में करने के लिए
const formatNameTitleCase = (text: string) => {
  return text.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// गेम के इमोजी
const FRUITS = ["🍉", "🍎", "🍌", "🍍", "🥭", "🥝", "🍓"];
const BOMB = "💣";

export default function FruitNinjaPage() {
  const [step, setStep] = useState<"login" | "playing" | "gameover">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [birthDay, setBirthDay] = useState(""); 
  const [birthMonth, setBirthMonth] = useState(""); 
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // UI Stats (गेम ओवर पर दिखाने के लिए)
  const [finalScore, setFinalScore] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Canvas Refs (गेम इंजन के लिए)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // गेम स्टेट्स (React state से बाहर ताकि 60fps पर लैग न हो)
  const gameState = useRef({
    score: 0,
    lives: 3,
    fruits: [] as any[],
    particles: [] as any[],
    trail: [] as {x: number, y: number, age: number}[],
    isSlicing: false,
    startTime: 0,
    lastSpawnTime: 0
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

    const deviceLastPlayed = localStorage.getItem("ninja_game_cooldown");
    const lockedPhone = localStorage.getItem("ninja_game_locked_phone");

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
        existingSpecialDates[bdayIndex].date = formattedDate; // अगर पहले से है तो अपडेट करें
      } else {
        existingSpecialDates.push({ type: 'Birthday', date: formattedDate, name: cleanName }); // नया डालें
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        specialDates: existingSpecialDates, 
        lastActive: serverTimestamp(),
        importSource: 'FruitNinja'
      }, { merge: true });

      setName(cleanName);
      setPhone(cleanPhone);
      
      // Reset Game Engine State
      gameState.current = {
        score: 0,
        lives: 3,
        fruits: [],
        particles: [],
        trail: [],
        isSlicing: false,
        startTime: Date.now(),
        lastSpawnTime: 0
      };
      
      setStep("playing");
      toast.success("स्वैप (Swipe) करके फ्रूट्स काटें ⚔️");

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // ⚔️ 2. फ्रूट निंजा गेम इंजन (Canvas + Physics) - 🔥 HARD MODE 🔥
  useEffect(() => {
    if (step !== "playing" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const spawnFruit = (time: number) => {
      // 30% चांस बम आने का (पहले से ज्यादा)
      const isBomb = Math.random() < 0.30; 
      const size = isBomb ? 60 : 70;
      
      gameState.current.fruits.push({
        id: Math.random(),
        emoji: isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)],
        isBomb: isBomb,
        x: Math.random() * (canvas.width - 100) + 50,
        y: canvas.height + size,
        vx: (Math.random() - 0.5) * 8, // Left/Right movement तेज़
        vy: -(Math.random() * 5 + 18), // Jump height ज़्यादा (तेज़ उछाल)
        size: size,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        sliced: false
      });
      gameState.current.lastSpawnTime = time;
    };

    const createParticles = (x: number, y: number) => {
      for (let i = 0; i < 8; i++) {
        gameState.current.particles.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          life: 1.0,
          color: ['#ff3366', '#ffcc00', '#33cc33'][Math.floor(Math.random() * 3)]
        });
      }
    };

    const updatePhysics = (time: number) => {
      // Spawn Control (बहुत जल्दी-जल्दी फल आएँगे)
      const spawnDelay = Math.max(250, 1000 - gameState.current.score * 5);
      if (time - gameState.current.lastSpawnTime > spawnDelay) {
        spawnFruit(time);
        if (Math.random() < 0.4) spawnFruit(time); // Double jump चांस 40%
      }

      // Update Fruits
      for (let i = gameState.current.fruits.length - 1; i >= 0; i--) {
        const f = gameState.current.fruits[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.5; // Gravity (नीचे गिरने की स्पीड भी बढ़ा दी है)
        f.rotation += f.rotationSpeed;

        // Check if sliced
        if (!f.sliced && gameState.current.isSlicing && gameState.current.trail.length > 0) {
          const head = gameState.current.trail[gameState.current.trail.length - 1];
          const dist = Math.hypot(f.x - head.x, f.y - head.y);
          
          if (dist < f.size) { // Collision True
            if (f.isBomb) {
              gameState.current.lives = 0; // बम कटने पर गेम ख़त्म
            } else {
              gameState.current.score += 1;
              createParticles(f.x, f.y);
            }
            f.sliced = true;
            gameState.current.fruits.splice(i, 1);
            continue;
          }
        }

        // Missed fruit (नीचे गिर गया)
        if (f.y > canvas.height + f.size + 10 && f.vy > 0) {
          if (!f.isBomb && !f.sliced) {
            gameState.current.lives -= 1; // फल छूटने पर लाइफ जाएगी
          }
          gameState.current.fruits.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = gameState.current.particles.length - 1; i >= 0; i--) {
        const p = gameState.current.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) gameState.current.particles.splice(i, 1);
      }

      // Update Trail (Blade Fade effect)
      for (let i = gameState.current.trail.length - 1; i >= 0; i--) {
        gameState.current.trail[i].age -= 0.1;
        if (gameState.current.trail[i].age <= 0) gameState.current.trail.splice(i, 1);
      }

      if (gameState.current.lives <= 0) {
        setFinalScore(gameState.current.score);
        setStep("gameover");
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Trail (Ninja Blade)
      if (gameState.current.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(gameState.current.trail[0].x, gameState.current.trail[0].y);
        for (let i = 1; i < gameState.current.trail.length; i++) {
          ctx.lineTo(gameState.current.trail[i].x, gameState.current.trail[i].y);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "cyan";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw Particles
      gameState.current.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Draw Fruits
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      gameState.current.fruits.forEach(f => {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.font = `${f.size}px Arial`;
        
        if (f.isBomb) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = "red";
        }
        
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();
      });

      // Draw HUD (Score & Lives)
      ctx.fillStyle = "white";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`🍉 Score: ${gameState.current.score}`, 20, 40);
      
      ctx.textAlign = "right";
      ctx.fillText(`❤️`.repeat(gameState.current.lives), canvas.width - 20, 40);
    };

    const gameLoop = (time: number) => {
      updatePhysics(time);
      draw();
      if (gameState.current.lives > 0) {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    };
    
    requestRef.current = requestAnimationFrame(gameLoop);

    const addTrailPoint = (x: number, y: number) => {
      gameState.current.trail.push({ x, y, age: 1.0 });
      if (gameState.current.trail.length > 10) gameState.current.trail.shift();
    };

    const handleStart = () => { 
      gameState.current.isSlicing = true; 
      gameState.current.trail = [];
    };
    const handleMove = (e: any) => {
      if (!gameState.current.isSlicing) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      addTrailPoint(clientX, clientY);
    };
    const handleEnd = () => { 
      gameState.current.isSlicing = false; 
    };

    window.addEventListener("mousedown", handleStart);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchstart", handleStart, { passive: false });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current!);
      window.removeEventListener("mousedown", handleStart);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("resize", handleResize);
    };
  }, [step]);

  // 🛡️ 3. गेम ओवर और डेटा सेविंग
  const savePointsToDatabase = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    // Anti-Cheat (Speed Hack Detection)
    const playTimeSeconds = (Date.now() - gameState.current.startTime) / 1000;
    if (finalScore > 0 && (finalScore / playTimeSeconds > 15 || finalScore > 1000)) {
      setIsSaving(false);
      return toast.error("⚠️ चीटिंग पकड़ी गई!", { style: { background: "#ef4444", color: "#fff" } });
    }

    // 👉 नया स्कोर रूल: 100 फ्रूट्स = 10 कूपन, 200 फ्रूट्स = 20 कूपन
    let pointsWon = 0;
    if (finalScore >= 200) pointsWon = 20;
    else if (finalScore >= 100) pointsWon = 10;
    else pointsWon = 0;

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
        lastCatchGameScore: finalScore // Reusing this key for POS display
      }, { merge: true });

      setEarnedPoints(finalPointsToAdd);
      
      localStorage.setItem("ninja_game_cooldown", Date.now().toString());
      localStorage.setItem("ninja_game_locked_phone", phone);

      if (finalPointsToAdd > 0) {
        toast.success(`बधाई हो! आपको ${finalPointsToAdd} कूपन मिले! 🎉`);
      } else if (finalScore < 100) {
        toast.error("टारगेट पूरा नहीं हुआ (कम से कम 100 फ्रूट चाहिए)!");
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

  // 🛡️ 2. यहाँ हमने GameGuard का इस्तेमाल किया है
  return (
    <GameGuard allowedGameName="FruitNinja">
      <div className="min-h-screen bg-[#111] text-white font-sans flex flex-col justify-center items-center overflow-hidden touch-none relative select-none">
        <Toaster position="top-center" />
        
        {/* ---------------- LOGIN SCREEN ---------------- */}
        {step === "login" && (
          <div className="w-full max-w-sm px-4 z-10 py-6 overflow-y-auto max-h-[100dvh]">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black text-green-400 drop-shadow-md">Fruit Cutter ⚔️</h1>
              <p className="text-sm font-bold text-neutral-400 mt-1">बम बम कैफे, मोहंद्रा</p>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-[#334155] shadow-2xl text-center space-y-4">
              <p className="text-xs text-neutral-300 font-bold leading-relaxed bg-black/30 p-3 rounded-xl border border-neutral-700">
                स्क्रीन पर उँगली फेर कर फलों को काटें।<br/>बम (💣) कटा, तो गेम खत्म!<br/><br/>
                <span className="text-orange-400 text-sm">
                  100 फ्रूट्स = 10 कूपन (₹10)<br/>
                  200 फ्रूट्स = 20 कूपन (₹20)
                </span>
              </p>
              
              <form onSubmit={handleStartGame} className="space-y-3 pt-2">
                <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full bg-[#0f172a] border-2 border-green-500 text-center py-3 rounded-xl outline-none text-white focus:border-green-400 font-mono" />
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

                <button type="submit" disabled={isLoading} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-lg disabled:opacity-50 mt-4">
                  {isLoading ? "प्रतीक्षा करें..." : "▶ गेम शुरू करें"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING SCREEN (Canvas) ---------------- */}
        {step === "playing" && (
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full cursor-crosshair z-0"
            style={{ background: "radial-gradient(circle at center, #2b1f1f 0%, #111 100%)" }}
          />
        )}

        {/* ---------------- GAME OVER SCREEN ---------------- */}
        {step === "gameover" && (
          <div className="bg-[#1e293b] p-8 rounded-3xl w-full max-w-sm border border-[#334155] shadow-2xl text-center space-y-6 z-10 mx-4">
            <h2 className="text-3xl font-black uppercase text-red-500">Game Over</h2>
            
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#334155]">
              <p className="text-xs font-bold text-neutral-400 uppercase">Total Fruits Sliced</p>
              <p className="text-6xl font-black text-orange-400 mt-2">🍉 {finalScore}</p>
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
                 <p className="text-xs text-neutral-400 mt-2">कूपन जीतने के लिए 100 फ्रूट्स काटना ज़रूरी है।</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => {
                  gameState.current = { score: 0, lives: 3, fruits: [], particles: [], trail: [], isSlicing: false, startTime: Date.now(), lastSpawnTime: 0 };
                  setStep("playing");
                }} 
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-sm uppercase rounded-xl shadow-lg"
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
