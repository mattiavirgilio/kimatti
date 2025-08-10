"use client";

import clsx from "clsx";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon } from "@/lib/icons";
import { track } from "@vercel/analytics";

// Fallback für RetellWebClient
let RetellWebClient: any = null;
try {
  const retellModule = require("retell-client-js-sdk");
  RetellWebClient = retellModule.RetellWebClient;
} catch (error) {
  console.warn("Retell SDK nicht verfügbar:", error);
}

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type CreateWebCallResponse = {
  access_token: string;
  call_id: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [retellWebClient, setRetellWebClient] = useState<any>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function keyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !isCalling) return inputRef.current?.focus();
      if (e.key === "Escape") return setInput("");
    }

    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [isCalling]);

  const startConversation = async () => {
    if (!RetellWebClient) {
      toast.error("Retell SDK nicht verfügbar");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch("/api/retell/token", { method: "POST" });
      
      if (!res.ok) {
        throw new Error(`API Fehler: ${res.status}`);
      }
      
      const data: CreateWebCallResponse = await res.json();

      const client = new RetellWebClient();
      
      // Event Listener hinzufügen
      client.on("call_started", () => {
        console.log("Call gestartet");
        setIsCalling(true);
        setIsConnecting(false);
        toast.success("Call gestartet!");
        track("Call started");
      });

      client.on("call_ended", () => {
        console.log("Call beendet");
        setIsCalling(false);
        setIsAgentSpeaking(false);
        setIsUserSpeaking(false);
        toast.info("Call beendet");
        track("Call ended");
      });

      client.on("agent_start_talking", () => {
        console.log("Agent beginnt zu sprechen");
        setIsAgentSpeaking(true);
        track("Agent started talking");
      });

      client.on("agent_stop_talking", () => {
        console.log("Agent hört auf zu sprechen");
        setIsAgentSpeaking(false);
        track("Agent stopped talking");
      });

      client.on("user_start_talking", () => {
        console.log("Benutzer beginnt zu sprechen");
        setIsUserSpeaking(true);
        track("User started talking");
      });

      client.on("user_stop_talking", () => {
        console.log("Benutzer hört auf zu sprechen");
        setIsUserSpeaking(false);
        track("User stopped talking");
      });

      client.on("update", (update: any) => {
        console.log("Update:", update);
        if (update.transcript && typeof update.transcript === 'string') {
          setMessages(prev => [...prev, {
            role: "user",
            content: update.transcript,
            timestamp: Date.now()
          }]);
        }
      });

      client.on("error", (error: any) => {
        console.error("Ein Fehler ist aufgetreten:", error);
        setIsCalling(false);
        setIsConnecting(false);
        toast.error(`Fehler: ${error}`);
        track("Call error", { error });
      });

      await client.startCall({
        accessToken: data.access_token,
        sampleRate: 24000,
      });

      setRetellWebClient(client);

    } catch (error) {
      console.error("Fehler beim Starten des Calls:", error);
      setIsCalling(false);
      setIsConnecting(false);
      toast.error("Fehler beim Starten des Calls");
      track("Call start error", { error: String(error) });
    }
  };

  const stopConversation = () => {
    if (retellWebClient) {
      retellWebClient.stopCall();
      setIsCalling(false);
      setIsAgentSpeaking(false);
      setIsUserSpeaking(false);
      track("Call stopped manually");
    }
  };

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCalling) {
      startConversation();
    }
  }

  return (
    <>
      <div className="pb-4 min-h-28" />

      {!isCalling && !isConnecting && (
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={startConversation}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-lg font-medium transition-colors shadow-lg hover:shadow-xl"
            disabled={isConnecting || !RetellWebClient}
          >
            {isConnecting ? (
              <div className="flex items-center space-x-2">
                <LoadingIcon />
                <span>Verbinde...</span>
              </div>
            ) : !RetellWebClient ? (
              <span>SDK nicht verfügbar</span>
            ) : (
              <div className="flex items-center space-x-2">
                <span>🎤</span>
                <span>Call starten</span>
              </div>
            )}
          </button>
        </div>
      )}

      {isCalling && (
        <div className="flex flex-col items-center space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Call läuft...
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500">
              Sprechen Sie jetzt mit dem Agent
            </p>
          </div>
        </div>
      )}

      {isCalling && (
        <div className="mt-4">
          <button
            onClick={stopConversation}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
          >
            Call beenden
          </button>
        </div>
      )}

      <div className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28 space-y-4">
        {messages.length > 0 && (
          <div className="space-y-2">
            {messages.slice(-3).map((message, index) => (
              <p key={index} className="text-sm">
                <span className="font-medium">
                  {message.role === "user" ? "Sie" : "Agent"}:
                </span>{" "}
                {message.content}
              </p>
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <>
            <p>
              Ein intelligenter Voice Assistant powered by{" "}
              <A href="https://retellai.com">Retell AI</A>,{" "}
              <A href="https://nextjs.org">Next.js</A>, and{" "}
              <A href="https://vercel.com">Vercel</A>.
            </p>

            {!isCalling && (
              <p>Klicken Sie auf den &quot;Call starten&quot; Button um mit dem Agent zu sprechen.</p>
            )}
          </>
        )}

        {isCalling && (
          <div className="space-y-2">
            {isAgentSpeaking && (
              <p className="text-green-400"> Agent spricht...</p>
            )}
            {isUserSpeaking && (
              <p className="text-blue-400"> Sie sprechen...</p>
            )}
            {!isAgentSpeaking && !isUserSpeaking && (
              <p className="text-neutral-500">Warten auf Spracheingabe...</p>
            )}
          </div>
        )}
      </div>

      <div
        className={clsx(
          "absolute size-36 blur-3xl rounded-full bg-linear-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition ease-in-out",
          {
            "opacity-0": !isCalling,
            "opacity-30": isCalling && !isUserSpeaking && !isAgentSpeaking,
            "opacity-100 scale-110": isUserSpeaking || isAgentSpeaking,
          }
        )}
      />
    </>
  );
}

function A(props: any) {
  return (
    <a
      {...props}
      className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
    />
  );
}