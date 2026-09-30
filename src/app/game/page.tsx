"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function SmartGameRouter() {
  const [loadingText, setLoadingText] = useState("गेम लोड हो रहा है...");

  useEffect(() => {
    const fetchActiveGame = async () => {
      try {
        // डेटाबेस से चेक करें कि POS से कौन सा गेम चालू किया गया है
        const docRef = doc(db, "system_settings", "game_config");
        const docSnap = await getDoc(docRef);
        
        let targetGame = "spin-game"; // डिफ़ॉल्ट गेम (Spin Wheel)
        
        if (docSnap.exists()) {
          const config = docSnap.data();
          
          // POS से सेट की गई वैल्यू के आधार पर सही फोल्डर (URL) का नाम सेट करें
          if (config.activeGame === "CatchGame") {
            targetGame = "catch-game";
          } else if (config.activeGame === "FruitNinja") {
            targetGame = "FruitNinja"; // 👉 यहाँ Capital F और N होना चाहिए (आपके फोल्डर के नाम के अनुसार)
          } else if (config.activeGame === "SpinGame") {
            targetGame = "spin-game"; 
          }
        }

        // टेबल नंबर को URL में सुरक्षित रखें ताकि गेम में टेबल नंबर दिखे
        const urlParams = new URLSearchParams(window.location.search);
        const table = urlParams.get('table') || '';
        const queryString = table ? `?table=${table}` : '';

        setLoadingText("आपको गेम में ले जाया जा रहा है... 🚀");
        
        // आधा सेकंड के अंदर कस्टमर को सीधे सही गेम पर भेज दें
        setTimeout(() => {
          window.location.replace(`/${targetGame}${queryString}`);
        }, 500);

      } catch (error) {
        // अगर नेट स्लो है या कोई दिक्कत आये, तो डिफ़ॉल्ट स्पिन गेम खोल दें
        window.location.replace("/spin-game");
      }
    };

    fetchActiveGame();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center items-center font-sans">
      <div className="text-5xl animate-spin mb-6">🌀</div>
      <h1 className="text-2xl font-black text-orange-500 uppercase tracking-widest animate-pulse">
        Bum Bum Cafe
      </h1>
      <p className="mt-4 text-sm font-bold text-neutral-400">
        {loadingText}
      </p>
    </div>
  );
}
