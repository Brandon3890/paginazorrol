export function BackgroundPattern() {
  return (
    <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/pattern.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  )
}