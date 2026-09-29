"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import confetti from "canvas-confetti"; 

// नाम को टाइटल केस में बदलने के लिए
const formatNameTitleCase = (text: string) => {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const isValidIndianPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

const PRIZES = [
  "Better Luck",
  "₹10 OFF",
  "Free Hot Coffee",
  "₹20 OFF",
  "Free Sandwich",
  "Manchurian Half",
  "Manch. Rice Half",
];
const PROBABILITIES = [80, 12, 3, 2, 1, 1, 1];

// साउंड इफेक्ट्स
const playAudio = (type: "win" | "lose" | "spin") => {
  let src = "";
  if (type === "win") src = "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"; 
  if (type === "lose") src = "https://assets.mixkit.co/active_storage/sfx/1436/1436-preview.mp3"; 
  if (type === "spin") src = "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3"; 

  const audio = new Audio(src);
  if (type === "spin") audio.loop = true; 
  audio.play().catch((e) => console.log("Sound blocked by browser:", e));
  return audio; 
};

// आतिशबाज़ी
const triggerConfetti = () => {
  const duration = 3 * 1000;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#22c55e', '#f1c40f', '#3b82f6', '#ef4444'] });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#22c55e', '#f1c40f', '#3b82f6', '#ef4444'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
};

export default function SurpriseArcadeGame() {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthday, setBirthday] = useState(""); // 👉 NEW: Birthday State
  const [tableNo, setTableNo] = useState<string>("सामान्य टेबल");
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // गेम स्टेट्स
  const [lastPlayedTime, setLastPlayedTime] = useState<number | null>(null);
  const [prizeWon, setPrizeWon] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [showGame, setShowGame] = useState(false); 
  
  // टाइमर UI स्टेट्स
  const [activeScreen, setActiveScreen] = useState<"voucher" | "cooldown" | "none">("none");
  const [timerText, setTimerText] = useState<string>("");

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

  useEffect(() => {
    if (!isLoggedIn || !lastPlayedTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastPlayedTime;
      const ONE_HOUR = 60 * 60 * 1000;
      const FIVE_MINS = 5 * 60 * 1000;

      if (elapsed >= ONE_HOUR) {
        setActiveScreen("none");
        setShowGame(true);
        setLastPlayedTime(null);
        clearInterval(interval);
      } else {
        if (couponCode && elapsed < FIVE_MINS) {
          setActiveScreen("voucher");
          const left = Math.floor((FIVE_MINS - elapsed) / 1000);
          const m = Math.floor(left / 60);
          const s = left % 60;
          setTimerText(`${m}:${s < 10 ? "0" + s : s} मिनट शेष`);
        } else {
          setActiveScreen("cooldown");
          setShowGame(false);
          const left = Math.floor((ONE_HOUR - elapsed) / 1000);
          const m = Math.floor(left / 60);
          const s = left % 60;
          setTimerText(`${m} मिनट ${s < 10 ? "0" + s : s} सेकंड`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn, lastPlayedTime, couponCode]);

  // 🚀 लॉगिन हैंडलर (यहाँ डिवाइस लॉकिंग और बर्थडे सेविंग है)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formatNameTitleCase(name.trim());
    if (cleanName.length < 2) return toast.error("कृपया सही नाम दर्ज करें!");
    const cleanPhone = phoneNumber.replace(/\D/g, "").slice(-10);
    if (!isValidIndianPhone(cleanPhone)) return toast.error("सही 10-अंकों का नंबर डालें!");
    if (!birthday) return toast.error("कृपया अपनी जन्मतिथि (Birthday) चुनें!"); // 👉 NEW

    setIsLoading(true);
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    // 🛑 1. DEVICE LOCK CHECK (एक मोबाइल = एक नंबर)
    const deviceLastPlayed = localStorage.getItem("device_cooldown_time");
    const lockedPhone = localStorage.getItem("device_locked_phone");

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

        if (data?.lastPlayedAt) {
          const playedMillis = (data.lastPlayedAt as Timestamp).toMillis();
          const elapsed = now - playedMillis;

          if (elapsed < ONE_HOUR) {
            setLastPlayedTime(playedMillis);
            setCouponCode(data.voucherCode || null);
            setPrizeWon(data.lastPrizeWon || null);
            setName(data.name || cleanName);
            setIsLoggedIn(true);
            setShowGame(false); 
            setIsLoading(false);
            return;
          }
        }
      }

      // 👉 NEW: चेक करें कि क्या इसका बर्थडे पहले से सेव है, अगर नहीं तो ऐड करें
      const hasBirthday = existingSpecialDates.some((d: any) => d.type === 'Birthday' && d.name === cleanName);
      if (!hasBirthday) {
        existingSpecialDates.push({ type: 'Birthday', date: birthday, name: cleanName });
      }

      await setDoc(userRef, { 
        name: cleanName, 
        phone: cleanPhone, 
        table: tableNo,
        specialDates: existingSpecialDates, // 👉 NEW: CRM के लिए बर्थडे सेव हो रहा है
        lastActive: serverTimestamp(),
        importSource: 'SpinGame'
      }, { merge: true });

      setName(cleanName);
      setPhoneNumber(cleanPhone);
      setLastPlayedTime(null);
      setCouponCode(null);
      setIsLoggedIn(true);
      setShowGame(true); 
      toast.success(`लकी स्पिन व्हील में आपका स्वागत है 🎡`);

    } catch {
      toast.error("सर्वर त्रुटि! पुनः प्रयास करें।");
    } finally {
      setIsLoading(false);
    }
  };

  // डेटाबेस में रिजल्ट सेव करें और डिवाइस लॉक करें
  const generateResultAndSave = async () => {
    const rand = Math.random() * 100;
    let sum = 0, winIdx = 0;
    for (let i = 0; i < PROBABILITIES.length; i++) {
      sum += PROBABILITIES[i];
      if (rand <= sum) { winIdx = i; break; }
    }

    const prize = PRIZES[winIdx];
    const voucher = prize !== "Better Luck" ? `BOM-${Math.floor(1000 + Math.random() * 9000)}` : null;

    try {
      await setDoc(doc(db, "customer_points", phoneNumber), {
        lastPlayedAt: serverTimestamp(),
        lastPrizeWon: prize,
        voucherCode: voucher,
        table: tableNo,
        voucherClaimed: false,
      }, { merge: true });

      localStorage.setItem("device_cooldown_time", Date.now().toString());
      localStorage.setItem("device_locked_phone", phoneNumber);

    } catch (e) { console.error(e); }

    return { winIdx, prize, voucher };
  };

  const handleGameEndUI = (prize: string, voucher: string | null) => {
    setPrizeWon(prize);
    setCouponCode(voucher);
    setLastPlayedTime(Date.now()); 

    if (prize === "Better Luck") {
      playAudio("lose");
      toast("उफ़! इस बार कोई इनाम नहीं मिला।", { icon: "😔" });
    } else {
      playAudio("win");
      triggerConfetti();
      toast.success("बधाई हो! आप जीत गए हैं!");
    }
    setShowGame(false); 
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#0b0f19", color: "#ffffff", minHeight: "100vh", textAlign: "center", padding: "25px 15px", boxSizing: "border-box" }}>
      <Toaster position="top-center" />

      <div style={{ marginBottom: "25px" }}>
        <div style={{ display: "inline-block", backgroundColor: "rgba(241, 196, 15, 0.15)", color: "#f1c40f", padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", marginBottom: "8px", border: "1px solid rgba(241, 196, 15, 0.3)" }}>
          {tableNo}
        </div>
        <h1 style={{ color: "#f1c40f", fontSize: "26px", margin: "0 0 6px 0", fontWeight: "900" }}>बम बम कैफे, मोहंद्रा</h1>
      </div>

      {!isLoggedIn ? (
        <div style={{ maxWidth: "340px", margin: "0 auto", backgroundColor: "#1e293b", padding: "25px 20px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🎁</div>
          <h2 style={{ fontSize: "18px", margin: "0 0 16px 0", color: "#38bdf8", fontWeight: "bold" }}>खेलने के लिए विवरण दर्ज करें</h2>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(formatNameTitleCase(e.target.value))} required style={{ padding: "14px", borderRadius: "10px", border: "2px solid #3b82f6", backgroundColor: "#0f172a", color: "#fff", fontSize: "16px", textAlign: "center", outline: "none" }} />
            
            <input type="tel" maxLength={10} placeholder="10-अंकों का मोबाइल नंबर" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required style={{ padding: "14px", borderRadius: "10px", border: "2px solid #f1c40f", backgroundColor: "#0f172a", color: "#fff", fontSize: "16px", textAlign: "center", outline: "none" }} />
            
            {/* 👉 NEW: Birthday Input */}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", top: "-8px", left: "15px", backgroundColor: "#1e293b", padding: "0 5px", fontSize: "10px", color: "#f472b6", fontWeight: "bold" }}>जन्मदिन (Birthday) 🎂</span>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} required style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "2px solid #ec4899", backgroundColor: "#0f172a", color: "#fff", fontSize: "16px", textAlign: "center", outline: "none", boxSizing: "border-box" }} />
            </div>

            <button type="submit" disabled={isLoading} style={{ padding: "14px", borderRadius: "25px", border: "none", backgroundColor: "#22c55e", color: "#fff", fontSize: "16px", fontWeight: "900", cursor: isLoading ? "not-allowed" : "pointer", marginTop: "10px" }}>
              {isLoading ? "प्रतीक्षा करें..." : "स्पिन गेम खेलें ➔"}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ maxWidth: "420px", margin: "0 auto" }}>
          
          {showGame && (
            <SpinWheelGame onFinish={generateResultAndSave} onEndUI={handleGameEndUI} />
          )}

          {activeScreen === "voucher" && (
            <div style={{ backgroundColor: "#1e293b", padding: "25px", borderRadius: "16px", border: "2px solid #22c55e" }}>
              <h2 style={{ color: "#22c55e", margin: "0 0 10px 0" }}>🎉 आपका इनाम</h2>
              <p style={{ fontSize: "24px", color: "#f1c40f", fontWeight: "900" }}>{prizeWon}</p>
              <div style={{ backgroundColor: "#0f172a", padding: "12px 20px", borderRadius: "12px", margin: "15px 0", border: "1px dashed #22c55e" }}>
                <span style={{ fontSize: "14px", color: "#94a3b8", display: "block" }}>कूपन कोड: </span>
                <strong style={{ fontSize: "26px", color: "#22c55e", letterSpacing: "3px" }}>{couponCode}</strong>
              </div>
              <p style={{ color: "#cbd5e1", fontSize: "14px" }}>काउंटर पर यह कूपन दिखाएं!</p>
              <div style={{ marginTop: "15px", color: "#f59e0b", fontWeight: "bold" }}>⏳ {timerText}</div>
            </div>
          )}

          {activeScreen === "cooldown" && (
            <div style={{ backgroundColor: "#1e293b", padding: "30px 20px", borderRadius: "16px", border: "2px solid #334155" }}>
              <div style={{ fontSize: "50px", marginBottom: "10px" }}>🕒</div>
              <h2 style={{ color: "#38bdf8", margin: "0 0 10px 0" }}>आप खेल चुके हैं!</h2>
              <p style={{ color: "#94a3b8", fontSize: "15px", marginBottom: "20px" }}>हर ग्राहक 1 घंटे में केवल एक बार खेल सकता है। कृपया थोड़ी प्रतीक्षा करें।</p>
              <div style={{ backgroundColor: "#0f172a", padding: "15px", borderRadius: "12px" }}>
                <span style={{ fontSize: "14px", color: "#cbd5e1", display: "block", marginBottom: "5px" }}>अगला मौका मिलेगा:</span>
                <strong style={{ fontSize: "28px", color: "#ef4444", letterSpacing: "1px", fontVariantNumeric: "tabular-nums" }}>
                  {timerText}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpinWheelGame({ onFinish, onEndUI }: { onFinish: () => Promise<any>; onEndUI: (p: string, v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const colors = ["#ef4444", "#3b82f6", "#eab308", "#a855f7", "#f97316", "#14b8a6", "#22c55e"];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);
    let startAngle = 0;
    const arc = (2 * Math.PI) / PRIZES.length;
    for (let i = 0; i < PRIZES.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(150, 150);
      ctx.arc(150, 150, 145, startAngle, startAngle + arc);
      ctx.fill();
      ctx.save();
      ctx.translate(150, 150);
      ctx.rotate(startAngle + arc / 2);
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.fillText(PRIZES[i], 38, 4);
      ctx.restore();
      startAngle += arc;
    }
  }, []);

  const handleSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    const spinAudio = playAudio("spin");

    const { winIdx, prize, voucher } = await onFinish();

    const arcDegree = 360 / PRIZES.length;
    const stopAngle = winIdx * arcDegree + arcDegree / 2;
    const targetAngle = ((270 - stopAngle) % 360 + 360) % 360;
    setRotation((prev) => prev + 3600 + targetAngle - (prev % 360));

    setTimeout(() => {
      setIsSpinning(false);
      spinAudio.pause();
      onEndUI(prize, voucher); 
    }, 4000);
  };

  return (
    <div>
      <p style={{ color: "#cbd5e1", fontSize: "14px", marginBottom: "10px" }}>पहिया घुमाएं और अपना भाग्य देखें!</p>
      <div style={{ position: "relative", width: "300px", height: "300px", margin: "10px auto 20px" }}>
        <div style={{ position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", fontSize: "36px", color: "#ef4444", zIndex: 10 }}>▼</div>
        <canvas ref={canvasRef} style={{ width: "300px", height: "300px", borderRadius: "50%", border: "5px solid #fff", boxShadow: "0 0 25px rgba(0,0,0,0.6)", transform: `rotate(${rotation}deg)`, transition: "transform 4s cubic-bezier(0.1, 0.7, 0.1, 1)" }} />
      </div>
      <button onClick={handleSpin} disabled={isSpinning} style={{ padding: "12px 35px", backgroundColor: isSpinning ? "#64748b" : "#ef4444", color: "white", border: "none", borderRadius: "30px", fontWeight: "900", fontSize: "16px", cursor: isSpinning ? "not-allowed" : "pointer", boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)" }}>
        {isSpinning ? "घूम रहा है..." : "पहिया घुमाएं (SPIN)"}
      </button>
    </div>
  );
}
