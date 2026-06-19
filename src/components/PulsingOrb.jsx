export default function PulsingOrb() {
  return (
    <div style={{ position: "relative", width: 280, height: 280, margin: "0 auto" }}>

      {/* Outer faint ambient rings — slow, alternating */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: `${i * 14}px`,
            borderRadius: "50%",
            border: `1px solid rgba(224,16,16,${0.08 - i * 0.02})`,
            animation: `spin ${20 + i * 8}s linear infinite ${i % 2 === 0 ? "" : "reverse"}`,
          }}
        />
      ))}

      {/* Outer rotating ring — clockwise, dashed, with glow nodes */}
      <div style={{
        position: "absolute",
        inset: 28,
        borderRadius: "50%",
        border: "1.5px dashed rgba(224,16,16,0.35)",
        animation: "spin 10s linear infinite",
        boxShadow: "0 0 8px rgba(224,16,16,0.15)",
      }}>
        {/* 4 glow nodes on the ring */}
        {[0, 90, 180, 270].map((deg) => (
          <div key={deg} style={{ position: "absolute", inset: 0, transform: `rotate(${deg}deg)` }}>
            <div style={{
              position: "absolute", top: -3, left: "50%",
              width: 6, height: 6, borderRadius: "50%",
              background: "#e01010",
              transform: "translateX(-50%)",
              boxShadow: "0 0 8px #e01010, 0 0 16px rgba(224,16,16,0.5)",
            }} />
          </div>
        ))}
      </div>

      {/* Inner rotating ring — counter-clockwise, solid, with tick marks */}
      <div style={{
        position: "absolute",
        inset: 44,
        borderRadius: "50%",
        border: "2px solid #e01010",
        animation: "spin 7s linear infinite reverse",
        boxShadow: "0 0 20px rgba(224,16,16,0.4), inset 0 0 10px rgba(224,16,16,0.1)",
      }}>
        {/* Tick marks at 45° intervals */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div key={deg} style={{ position: "absolute", inset: 0, transform: `rotate(${deg}deg)` }}>
            <div style={{
              position: "absolute", top: -1, left: "50%",
              width: deg % 90 === 0 ? 10 : 5,
              height: deg % 90 === 0 ? 3 : 2,
              background: deg % 90 === 0 ? "#e01010" : "rgba(224,16,16,0.5)",
              transform: "translateX(-50%)",
              boxShadow: deg % 90 === 0 ? "0 0 6px #e01010" : "none",
            }} />
          </div>
        ))}
      </div>

      {/* Kai image — static centre */}
      <div style={{
        position: "absolute",
        inset: 58,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 40px rgba(224,16,16,0.5), inset 0 0 20px rgba(224,16,16,0.15)",
        animation: "pulse 3s ease-in-out infinite",
      }}>
        <img
          src="/assets/kai.png"
          alt="Kai"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        />
      </div>

      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 30px rgba(224,16,16,0.4)} 50%{box-shadow:0 0 60px rgba(224,16,16,0.7)} }
      `}</style>
    </div>
  );
}
