"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Firebase में जो नाम है, उसे सही URL से जोड़ने के लिए लिस्ट
const gameRoutes: Record<string, string> = {
  CatchGame: "catch-game",
  FruitNinja: "FruitNinja",
  MemoryGame: "MemoryGame",
  Cafe2048: "Cafe2048",
  HungrySnake: "HungrySnake",
  SpinGame: "spin-game",
};

export default function GameGuard({ 
  children, 
  allowedGameName 
}: { 
  children: React.ReactNode, 
  allowedGameName: string 
}) {
  const [isAllowed, setIsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyGameAccess = async () => {
      try {
        const docRef = doc(db, "system_settings", "game_config");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const config = docSnap.data();
          const activeGame = config.activeGame; // POS में चालू गेम
          
          if (activeGame === allowedGameName) {
            setIsAllowed(true); // हाँ, खेलने दो
          } else {
            // अगर गलत गेम खुला है, तो सीधा उस गेम पर भेजो जो POS में चालू है!
            const targetRoute = gameRoutes[activeGame] || "spin-game"; // डिफ़ॉल्ट गेम
            
            // अगर URL में टेबल नंबर है (?table=4), तो उसे भी साथ ले जाओ
            const urlParams = window.location.search;
            
            // सीधा सही गेम वाले पेज पर भेज दो (बिना Home Page पर जाए)
            window.location.replace(`/${targetRoute}${urlParams}`); 
          }
        } else {
          window.location.replace("/");
        }
      } catch (error) {
        console.error("Error:", error);
        window.location.replace("/");
      } finally {
        setLoading(false);
      }
    };

    verifyGameAccess();
  }, [allowedGameName]);

  // जब तक चेक हो रहा है, तब तक छोटी सी लोडिंग दिखाएं
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center items-center font-sans">
        <div className="text-5xl animate-spin mb-6">🌀</div>
        <p className="text-sm font-bold text-orange-500 uppercase animate-pulse">
          Loading Game...
        </p>
      </div>
    );
  }

  if (!isAllowed) return null;

  // अगर सही गेम है, तो गेम दिखाओ
  return <>{children}</>;
}
