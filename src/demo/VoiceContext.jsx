import { createContext, useContext, useState } from "react";

const VoiceContext = createContext({ voiceOn: true, toggleVoice: () => {} });

export function VoiceProvider({ children }) {
  const [voiceOn, setVoiceOn] = useState(true);
  return (
    <VoiceContext.Provider value={{ voiceOn, toggleVoice: () => setVoiceOn((v) => !v) }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  return useContext(VoiceContext);
}
