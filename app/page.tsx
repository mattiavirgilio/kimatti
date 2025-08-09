"use client";

import clsx from "clsx";
import {
    useActionState,
    useEffect,
    useRef,
    useState,
    startTransition,
} from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";

type Message = {
    role: "user" | "assistant";
    content: string;
    latency?: number;
};

export default function Home() {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const player = usePlayer();
    const [isStarted, setIsStarted] = useState(false); // NEU: State für den Start-Zustand

    const vad = useMicVAD({
        startOnLoad: false, // GEÄNDERT: Startet nicht mehr automatisch
        onSpeechEnd: (audio) => {
            player.stop();
            const wav = utils.encodeWAV(audio);
            const blob = new Blob([wav], { type: "audio/wav" });
            startTransition(() => submit(blob));
            const isFirefox = navigator.userAgent.includes("Firefox");
            if (isFirefox) vad.pause();
        },
        positiveSpeechThreshold: 0.6,
        minSpeechFrames: 4,
    });

    // NEU: Funktion, die beim Klick auf den Start-Button ausgeführt wird
    const handleStart = () => {
        player.unlockAudio(); // WICHTIG: Schaltet das Audio für mobile Geräte frei
        vad.start();
        setIsStarted(true);
    };

    useEffect(() => {
        function keyDown(e: KeyboardEvent) {
            if (e.key === "Enter") return inputRef.current?.focus();
            if (e.key === "Escape") return setInput("");
        }

        window.addEventListener("keydown", keyDown);
        return () => window.removeEventListener("keydown", keyDown);
    });

    const [messages, submit, isPending] = useActionState<
        Array<Message>,
        string | Blob
    >(async (prevMessages, data) => {
        const formData = new FormData();

        if (typeof data === "string") {
            formData.append("input", data);
            track("Text input");
        } else {
            formData.append("input", data, "audio.wav");
            track("Speech input");
        }

        for (const message of prevMessages) {
            formData.append("message", JSON.stringify(message));
        }

        const submittedAt = Date.now();

        const response = await fetch("/api", {
            method: "POST",
            body: formData,
        });

        const transcript = decodeURIComponent(
            response.headers.get("X-Transcript") || ""
        );
        const text = decodeURIComponent(response.headers.get("X-Response") || "");

        if (!response.ok || !transcript || !text || !response.body) {
            if (response.status === 429) {
                toast.error("Too many requests. Please try again later.");
            } else {
                toast.error((await response.text()) || "An error occurred.");
            }
            return prevMessages;
        }

        player.play(response.body, () => {
            const isFirefox = navigator.userAgent.includes("Firefox");
            if (isFirefox) vad.start();
        });
        setInput(transcript);

        return [
            ...prevMessages,
            { role: "user", content: transcript },
            { role: "assistant", content: text, latency: Date.now() - submittedAt },
        ];
    }, []);

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(() => submit(input));
    }

    // NEU: Zeigt den Start-Button, solange das Erlebnis nicht gestartet wurde
    if (!isStarted) {
        return (
            <div className="w-full h-screen flex justify-center items-center bg-black">
                <button
                    onClick={handleStart}
                    className="px-8 py-4 bg-neutral-800 text-white rounded-lg text-xl hover:bg-neutral-700 transition-colors border border-neutral-600"
                >
                    Erlebnis starten
                </button>
            </div>
        );
    }

    // Die normale Ansicht, nachdem der Nutzer auf "Start" geklickt hat
    return (
        <>
            <div className="pb-4 min-h-28" />

            <form
                className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
                onSubmit={handleFormSubmit}
            >
                <input
                    type="text"
                    className="bg-transparent focus:outline-none p-4 w-full placeholder:text-neutral-600 dark:placeholder:text-neutral-400"
                    required
                    placeholder="Frag mich was"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    ref={inputRef}
                />

                <button
                    type="submit"
                    className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                    disabled={isPending}
                    aria-label="Submit"
                >
                    {isPending ? <LoadingIcon /> : <EnterIcon />}
                </button>
            </form>

            <div className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28 space-y-4">
                {messages.length > 0 && (
                    <p>
                        {messages.at(-1)?.content}
                        <span className="text-xs font-mono text-neutral-300 dark:text-neutral-700">
                            {" "}
                            ({messages.at(-1)?.latency}ms)
                        </span>
                    </p>
                )}

                {messages.length === 0 && (
                    <>
                        <p>
                            Kimatti – Sprich mit deinen Idolen. Entwickelt von {" XASSIST, "}
                            <A href="https://groq.com">Groq</A>,{" "}
                            <A href="https://cartesia.ai">Cartesia</A>,{" "}
                            <A href="https://www.vad.ricky0123.com/">VAD</A>, and{" "}
                            <A href="https://vercel.com">Vercel</A>.{" "}
                            <A href="https://github.com/ai-ng/swift" target="_blank">
                                Learn more
                            </A>
                            .
                        </p>

                        {vad.loading ? (
                            <p>Loading speech detection...</p>
                        ) : vad.errored ? (
                            <p>Failed to load speech detection.</p>
                        ) : (
                            <p>Start talking to chat.</p>
                        )}
                    </>
                )}
            </div>

            <div
                className={clsx(
                    "absolute size-36 blur-3xl rounded-full bg-linear-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition ease-in-out",
                    {
                        "opacity-0": vad.loading || vad.errored,
                        "opacity-30": !vad.loading && !vad.errored && !vad.userSpeaking,
                        "opacity-100 scale-110": vad.userSpeaking,
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