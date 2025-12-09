import { useState, useEffect, useRef } from "react";
import { createClient, LiveClient, LiveConnectionState } from "@deepgram/sdk";
import { Mic, MicOff, Settings, Activity } from "lucide-react";

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<LiveConnectionState>(LiveConnectionState.CLOSED);
  const [error, setError] = useState<string | null>(null);

  const deepgramRef = useRef<LiveClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Auto-scroll to bottom of transcript
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [transcript]);

  const startListening = async () => {
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error("Deepgram API Key is missing");
      }

      const deepgram = createClient(apiKey);

      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
      });

      connection.on("open", () => {
        setConnectionStatus(LiveConnectionState.OPEN);
      });

      connection.on("close", () => {
        setConnectionStatus(LiveConnectionState.CLOSED);
      });

      connection.on("Results", (data: any) => {
        const sentence = data.channel.alternatives[0].transcript;
        if (sentence && data.is_final) {
          setTranscript((prev) => prev + " " + sentence);
        }
      });

      connection.on("error", (e: any) => {
        console.error("Deepgram error:", e);
        setError("Connection error occurred");
      });

      deepgramRef.current = connection;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0 && connection.getReadyState() === 1) {
          connection.send(event.data);
        }
      });

      mediaRecorder.start(250); // Send chunks every 250ms
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);

    } catch (err: any) {
      setError(err.message || "Failed to start listening");
      console.error(err);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (deepgramRef.current) {
      deepgramRef.current.finish();
      deepgramRef.current = null;
    }

    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-rose-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/50 bg-white/50 backdrop-blur-xl fixed top-0 w-full z-10 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500">
            Scribe
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-300 ${connectionStatus === LiveConnectionState.OPEN
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === LiveConnectionState.OPEN ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              }`} />
            {connectionStatus === LiveConnectionState.OPEN ? "Connected" : "Offline"}
          </div>
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pt-24 pb-32 w-full max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <div className="space-y-6">
          {transcript ? (
            <p className="text-xl md:text-2xl leading-relaxed text-zinc-700 font-light whitespace-pre-wrap">
              {transcript}
            </p>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-400 gap-4">
              <Mic className="w-12 h-12 opacity-20" />
              <p className="text-lg font-light">Ready to transcribe. Click the microphone to start.</p>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </main>

      {/* Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent flex justify-center pb-8">
        <button
          onClick={toggleListening}
          className={`
            relative group flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-xl
            ${isListening
              ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 shadow-rose-200/50"
              : "bg-zinc-900 text-white hover:bg-zinc-800 hover:scale-105 shadow-zinc-200"
            }
          `}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              <span>Stop Recording</span>
              <span className="absolute inset-0 rounded-full border border-rose-400/30 animate-ping opacity-20" />
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Start Recording</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default App;
