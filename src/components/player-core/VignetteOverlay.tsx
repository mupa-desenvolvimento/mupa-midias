/**
 * Vignette effect overlay — smooth black gradient blur on all edges.
 * Pure CSS, pointer-events-none so it never blocks interaction.
 */
const VignetteOverlay = () => (
  <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden="true">
    {/* Top edge */}
    <div
      className="absolute top-0 left-0 right-0 h-[15%]"
      style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, transparent 100%)',
      }}
    />
    {/* Bottom edge */}
    <div
      className="absolute bottom-0 left-0 right-0 h-[18%]"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 40%, transparent 100%)',
      }}
    />
    {/* Left edge */}
    <div
      className="absolute top-0 bottom-0 left-0 w-[10%]"
      style={{
        background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
      }}
    />
    {/* Right edge */}
    <div
      className="absolute top-0 bottom-0 right-0 w-[10%]"
      style={{
        background: 'linear-gradient(to left, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
      }}
    />
  </div>
);

export { VignetteOverlay };
