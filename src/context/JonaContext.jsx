import { createContext, useContext, useState } from "react";

const JonaContext = createContext({ jonaSpeaking: false, setJonaSpeaking: () => {} });

export function JonaProvider({ children }) {
  const [jonaSpeaking, setJonaSpeaking] = useState(false);
  return (
    <JonaContext.Provider value={{ jonaSpeaking, setJonaSpeaking }}>
      {children}
    </JonaContext.Provider>
  );
}

export function useJona() {
  return useContext(JonaContext);
}
