import { useRef, useState } from "react";

// Definieren wir den Typ für das Rückgabeobjekt des usePlayer-Hooks
export type Player = {
  isPlaying: boolean;
  play: (stream: ReadableStream<any>, callback: () => void) => Promise<void>;
  stop: () => void;
  unlockAudio: () => void;
};

export function usePlayer(): Player {
    const [isPlaying, setIsPlaying] = useState(false);
    // Wir benutzen ein einfaches HTML-Audio-Element statt des komplexen AudioContext
    const audioRef = useRef<HTMLAudioElement | null>(null);

    /**
     * Spielt eine winzige, stille MP3-Datei ab.
     * Dies ist ein Trick, um die Autoplay-Richtlinien auf mobilen Browsern zu umgehen.
     * Diese Funktion muss als Reaktion auf einen direkten Klick des Nutzers aufgerufen werden.
     */
    function unlockAudio() {
        const silentAudio = new Audio(
            "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQ=="
        );
        silentAudio.volume = 0;
        silentAudio.play().catch((error) => {
            // Fehler können hier ignoriert werden, da es nur um die "Freischaltung" geht
            console.warn("Silent audio playback failed, but this is expected on some browsers.", error);
        });
    }

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
            audioRef.current.src = ""; // Quelle leeren, um Speicher freizugeben
            // URL-Objekt freigeben, um Memory Leaks zu vermeiden
            if (audioRef.current.src.startsWith("blob:")) {
                URL.revokeObjectURL(audioRef.current.src);
            }
            audioRef.current = null;
        }
        setIsPlaying(false);
    }

    return {
        isPlaying,
        play,
        stop,
        unlockAudio, // Die neue Funktion wird hier exportiert
    };
}