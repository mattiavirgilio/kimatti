"use client";

import { useState, useEffect } from "react";
import Script from "next/script";

// Definiere den Typ für die RetellWebClient-Klasse, die global verfügbar sein wird
declare global {
  interface Window {
    RetellWebClient: any;
  }
}

type RegisterCallResponse = {
  call_id: string;
  sample_rate: number;
};

export default function Home() {
  const [isCalling, setIsCalling] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(false);

  const startConversation = async () => {
    setIsCalling(true);
    try {
      const res = await fetch("/api/retell/token", { method: "POST" });
      const data: RegisterCallResponse = await res.json();

      const agent = new window.RetellWebClient();
      
      agent.on("conversationStarted", () => console.log("Gespräch gestartet."));
      agent.on("conversationEnded", () => {
        console.log("Gespräch beendet.");
        setIsCalling(false);
      });
      agent.on("error", (error: string) => {
        console.error("Ein Fehler ist aufgetreten:", error);
        setIsCalling(false);
      });
      agent.on("update", (update: any) => console.log(update));
      
      await agent.startConversation({
        callId: data.call_id,
        sampleRate: data.sample_rate,
      });

    } catch (error) {
      console.error("Fehler beim Starten des Gesprächs:", error);
      setIsCalling(false);
    }
  };

  return (
    <>
      {/* Lädt das Retell-Skript von der KORREKTEN URL */}
      <Script
        src="https://web.retell.ai/retell-client.js"
        onLoad={() => setIsSdkReady(true)}
      />

      <div className="w-full h-screen flex justify-center items-center bg-black">
        <button
          onClick={startConversation}
          disabled={isCalling || !isSdkReady}
          className="px-8 py-4 bg-neutral-800 text-white rounded-lg text-xl hover:bg-neutral-700 transition-colors border border-neutral-600 disabled:bg-neutral-900 disabled:text-neutral-500"
        >
          {!isSdkReady ? "Lade..." : isCalling ? "Gespräch läuft..." : "Erlebnis starten"}
        </button>
      </div>
    </>
  );
}