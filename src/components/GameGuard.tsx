"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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
          
          // चेक करें कि जो गेम खोला गया है, क्या वही Firebase में एक्टिव है?
          if (config.activeGame === allowedGameName) {
            setIsAllowed(true); // हाँ, खेलने दो
          } else {
            // अगर गलत गेम है, तो वापस Router वाले पेज पर भेज दो (मान लीजिये वो "/" है)
            window.location.replace("/"); 
          }
        } else {
          window.location.replace("/");
        }
      } catch (error) {
        console.error("Error verifying game:", error);
        window.location.replace("/");
      } finally {
        setLoading(false);
      }
    };

    verifyGameAccess();
  }, [allowedGameName]);

  // जब तक चेक हो रहा है, तब तक लोडिंग दिखाएं (ताकि गेम दिखे नहीं)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col justify-center items-center font-sans">
        <div className="text-5xl animate-spin mb-6">🌀</div>
        <p className="text-sm font-bold text-neutral-400">Verifying Game Access...</p>
      </div>
    );
  }

  // अगर allowed नहीं है तो कुछ मत दिखाओ (redirect हो जाएगा)
  if (!isAllowed) return null;

  // अगर allowed है, तो असली गेम रेंडर करो
  return <>{children}</>;
}
