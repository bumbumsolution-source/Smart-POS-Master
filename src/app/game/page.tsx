"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function SmartGameRouter() {
  const [loadingText, setLoadingText] = useState("गेम लोड हो रहा है...");

  useEffect(() => {
    const fetchActiveGame = async () => {
      try {
        const docRef = doc(db, "system_settings", "game_config");
        const docSnap = await getDoc(docRef);
        
        let targetGame = "spin-game"; // डिफ़ॉल्ट गेम
        
        if (docSnap.exists()) {
          const config = docSnap.data();
          
          if (config.activeGame === "CatchGame") {
            targetGame = "catch-game";
          } else if (config.activeGame === "FruitNinja") {
            targetGame = "FruitNinja"; 
          } else if (config.activeGame === "MemoryGame") {
            targetGame = "MemoryGame"; 
          } else if (config.activeGame === "Cafe2048") {
            targetGame = "Cafe2048"; // 👉 2048 पज़ल गेम के लिए
          } else if (config.activeGame === "SpinGame") {
            targetGame = "spin-game"; 
          }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const table = urlParams.get('table') || '';
        const queryString = table ? `?table=${table}` : '';

        setLoadingText("आपको गेम में ले जाया जा रहा है... 🚀");
        
        setTimeout(() => {
          window.location.replace(`/${targetGame}${queryString}`);
        }, 500);

      } catch (error) {
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
