import { useEffect, useRef } from "react";

class BlobAnimator {
  blobs: Array<{
    el: HTMLElement;
    baseX: number;
    baseY: number;
    currentX: number;
    currentY: number;
    phaseX: number;
    phaseY: number;
    speedX: number;
    speedY: number;
    ampX: number;
    ampY: number;
  }>;
  mouse: { x: number; y: number };
  time: number;
  raf: number | null;

  constructor() {
    this.blobs = [];
    this.mouse = { x: -1000, y: -1000 };
    this.time = 0;
    this.raf = null;
  }

  init(elements: HTMLElement[]) {
    this.blobs = elements.map((el, i) => ({
      el,
      baseX: parseFloat(el.dataset.baseX || "0") || 0,
      baseY: parseFloat(el.dataset.baseY || "0") || 0,
      currentX: 0,
      currentY: 0,
      phaseX: i * 2.1,
      phaseY: i * 1.7 + 1.3,
      speedX: [0.00045, 0.00065, 0.00085][i],
      speedY: [0.00038, 0.00058, 0.00075][i],
      ampX: [120, 90, 70][i],
      ampY: [100, 80, 60][i],
    }));

    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    this.tick();
  }

  lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  tick() {
    this.time += 1;

    this.blobs.forEach((blob) => {
      const naturalX =
        blob.baseX +
        Math.sin(this.time * blob.speedX + blob.phaseX) * blob.ampX +
        Math.sin(this.time * blob.speedX * 0.37 + blob.phaseX * 1.5) * blob.ampX * 0.4;

      const naturalY =
        blob.baseY +
        Math.sin(this.time * blob.speedY + blob.phaseY) * blob.ampY +
        Math.sin(this.time * blob.speedY * 0.41 + blob.phaseY * 1.3) * blob.ampY * 0.4;

      const rect = blob.el.getBoundingClientRect();
      const blobCX = rect.left + rect.width / 2;
      const blobCY = rect.top + rect.height / 2;
      const dx = blobCX - this.mouse.x;
      const dy = blobCY - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let repelX = 0;
      let repelY = 0;

      if (dist < 220 && dist > 0) {
        const force = Math.min((220 - dist) / 220, 1) * 120;
        repelX = (dx / dist) * force;
        repelY = (dy / dist) * force;
      }

      const targetX = naturalX + repelX;
      const targetY = naturalY + repelY;

      blob.currentX = this.lerp(blob.currentX, targetX, 0.04);
      blob.currentY = this.lerp(blob.currentY, targetY, 0.04);

      blob.el.style.transform = `translate(${blob.currentX}px, ${blob.currentY}px)`;
    });

    this.raf = requestAnimationFrame(() => this.tick());
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

export function BlobBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blobEls = Array.from(container.querySelectorAll<HTMLElement>(".ns-blob"));
    const animator = new BlobAnimator();
    animator.init(blobEls);

    return () => {
      animator.destroy();
    };
  }, []);

  return (
    <div className="ns-blob-bg" ref={containerRef} style={{ zIndex: 0, background: 'transparent' }}>
      <div
        className="ns-blob ns-blob-1"
        data-base-x="0"
        data-base-y="0"
        style={{
          background: 'radial-gradient(circle, rgba(160,160,180,0.70) 0%, rgba(100,100,120,0.30) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="ns-blob ns-blob-2"
        data-base-x="0"
        data-base-y="0"
        style={{
          background: 'radial-gradient(circle, rgba(130,130,150,0.60) 0%, rgba(80,80,100,0.25) 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="ns-blob ns-blob-3"
        data-base-x="0"
        data-base-y="0"
        style={{
          background: 'radial-gradient(circle, rgba(180,180,200,0.65) 0%, rgba(120,120,140,0.28) 50%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
    </div>
  );
}
