export default function GlobalStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      @keyframes pulse      { 0%,100%{opacity:1;box-shadow:0 0 20px rgba(224,16,16,0.3)} 50%{opacity:0.8;box-shadow:0 0 40px rgba(224,16,16,0.6)} }
      @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes fadeIn     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes glowPulse  { 0%,100%{box-shadow:0 0 20px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 40px rgba(224,16,16,0.7)} }
      ::-webkit-scrollbar          { width: 4px; }
      ::-webkit-scrollbar-track    { background: transparent; }
      ::-webkit-scrollbar-thumb    { background: #2a2a2a; border-radius: 2px; }
      input:focus { border-color: #e01010 !important; outline: none; }
      a { text-decoration: none; }
      button { font-family: inherit; }
    `}</style>
  );
}
