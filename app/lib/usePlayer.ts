import { useRef, useState } from "react";

export function usePlayer() {
    const [isPlaying, setIsPlaying] = useState(false);
    // Wir benutzen jetzt ein einfaches HTML-Audio-Element statt des komplexen AudioContext
    const audioRef = useRef<HTMLAudioElement | null>(null);

    async function play(stream: ReadableStream, callback: () => void) {
        stop();
        setIsPlaying(true);

        try {
            // 1. Lese den gesamten MP3-Stream in einen "Blob"
            const blob = await new Response(stream).blob();
            
            // 2. Erstelle eine URL für diesen Blob, die der Browser abspielen kann
            const url = URL.createObjectURL(blob);

            // 3. Erstelle ein neues Audio-Element und spiele es ab
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();

            // 4. Wenn die Wiedergabe endet, rufen wir den Callback auf
            audio.onended = () => {
                stop();
                callback();
            };

        } catch (error) {
            console.error("Fehler bei der MP3-Wiedergabe:", error);
            stop();
            callback();
        }
    }

    function stop() {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = ""; // Quelle leeren
            audioRef.current = null;
        }
        setIsPlaying(false);
    }

    return {
        isPlaying,
        play,
        stop,
    };
}