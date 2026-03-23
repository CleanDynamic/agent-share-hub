# NeoScale AI — Chrome Glassmorphism Design System
# Extracted from approved Stitch design reference

---

## Colour Palette

```css
:root {
  /* Background */
  --ns-void: #08080C;

  /* Glass surfaces */
  --ns-panel-bg: rgba(16, 16, 24, 0.72);
  --ns-panel-border: rgba(255, 255, 255, 0.07);
  --ns-panel-shadow-inner: rgba(255, 255, 255, 0.08);
  --ns-panel-shadow-outer: rgba(0, 0, 0, 0.65);

  --ns-card-bg: rgba(255, 255, 255, 0.03);
  --ns-card-border: rgba(255, 255, 255, 0.06);
  --ns-card-border-hover: rgba(255, 255, 255, 0.12);

  /* Text */
  --ns-text-primary: rgba(255, 255, 255, 0.90);
  --ns-text-secondary: rgba(255, 255, 255, 0.45);
  --ns-text-muted: rgba(255, 255, 255, 0.28);

  /* Brand */
  --ns-orange: #E8571A;
  --ns-orange-glow: rgba(232, 87, 26, 0.20);

  /* Badges */
  --ns-badge-prompt-bg: rgba(232, 87, 26, 0.18);
  --ns-badge-prompt-border: rgba(232, 87, 26, 0.35);
  --ns-badge-prompt-text: #E8571A;

  --ns-badge-beginner-bg: rgba(46, 196, 182, 0.15);
  --ns-badge-beginner-border: rgba(46, 196, 182, 0.30);
  --ns-badge-beginner-text: #2EC4B6;

  --ns-badge-intermediate-bg: rgba(139, 92, 246, 0.15);
  --ns-badge-intermediate-border: rgba(139, 92, 246, 0.30);
  --ns-badge-intermediate-text: #8B5CF6;

  --ns-badge-advanced-bg: rgba(239, 68, 68, 0.15);
  --ns-badge-advanced-border: rgba(239, 68, 68, 0.30);
  --ns-badge-advanced-text: #EF4444;

  /* Chrome blobs */
  --ns-blob-1: #C8C8D8;
  --ns-blob-2: #909098;
  --ns-blob-3: #D8D8E8;

  /* Buttons */
  --ns-btn-primary-bg: linear-gradient(160deg, #111111 0%, #1C1C1C 50%, #0A0A0A 100%);
  --ns-btn-primary-border: rgba(255, 255, 255, 0.10);
  --ns-btn-primary-text: #FFFFFF;

  --ns-btn-silver-bg: linear-gradient(135deg, #787888 0%, #C0C0CC 40%, #888898 70%, #606070 100%);
  --ns-btn-silver-text: #0A0A0A;

  /* Layout */
  --ns-panel-radius: 20px;
  --ns-card-radius: 12px;
  --ns-badge-radius: 6px;
  --ns-btn-radius: 100px;

  --ns-panel-blur: blur(40px) saturate(180%);
  --ns-card-blur: blur(12px);
}
```

---

## Layout

Three fixed panels, full viewport height:

| Panel | Width | Position |
|-------|-------|----------|
| Left (nav) | 275px | fixed left |
| Centre (feed) | flex-1, max 600px | scrollable |
| Right (discovery) | 350px | fixed right |

Outer container: `max-width: 1280px`, centred, `height: 100vh`
Gap between panels: `0` — panels touch edge to edge inside the container

---

## Glass Panel CSS

```css
.ns-panel {
  background: var(--ns-panel-bg);
  backdrop-filter: var(--ns-panel-blur);
  -webkit-backdrop-filter: var(--ns-panel-blur);
  border: 1px solid var(--ns-panel-border);
  box-shadow:
    inset 0 1px 0 var(--ns-panel-shadow-inner),
    0 32px 80px var(--ns-panel-shadow-outer);
}

/* Left panel — right edge only */
.ns-panel-left {
  border-right: 1px solid var(--ns-panel-border);
  border-left: none;
  border-top: none;
  border-bottom: none;
}

/* Right panel — left edge only */
.ns-panel-right {
  border-left: 1px solid var(--ns-panel-border);
  border-right: none;
  border-top: none;
  border-bottom: none;
}

/* Centre panel — no side borders */
.ns-panel-centre {
  background: rgba(10, 10, 16, 0.80);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: none;
}
```

---

## Glass Card CSS

```css
.ns-card {
  background: var(--ns-card-bg);
  border: 1px solid var(--ns-card-border);
  border-radius: var(--ns-card-radius);
  transition: border-color 0.2s ease;
}

.ns-card:hover {
  border-color: var(--ns-card-border-hover);
}

/* Feed items — no border, space separation only */
.ns-feed-item {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 8px;
  padding: 14px 16px;
}

.ns-feed-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.09);
}
```

---

## Animated Chrome Blob Background

```css
.ns-blob-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: var(--ns-void);
  overflow: hidden;
  pointer-events: none;
}

.ns-blob {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: screen;
  will-change: transform;
  pointer-events: none;
}

.ns-blob-1 {
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(200,200,216,0.65) 0%, transparent 70%);
  filter: blur(80px);
  top: -200px;
  left: -150px;
}

.ns-blob-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(144,144,152,0.45) 0%, transparent 70%);
  filter: blur(100px);
  bottom: -150px;
  right: -100px;
}

.ns-blob-3 {
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(216,216,232,0.38) 0%, transparent 70%);
  filter: blur(60px);
  top: 40%;
  right: 15%;
}
```

```javascript
// Blob animation — paste into a BlobBackground.tsx component
// Uses simplex-noise-like movement via Math.sin with offset phases

class BlobAnimator {
  constructor() {
    this.blobs = [];
    this.mouse = { x: -1000, y: -1000 };
    this.time = 0;
    this.raf = null;
  }

  init(elements) {
    this.blobs = elements.map((el, i) => ({
      el,
      // Natural position (starting point)
      baseX: parseFloat(el.dataset.baseX) || 0,
      baseY: parseFloat(el.dataset.baseY) || 0,
      // Current rendered position
      currentX: 0,
      currentY: 0,
      // Phase offsets so each blob moves differently
      phaseX: i * 2.1,
      phaseY: i * 1.7 + 1.3,
      // Speed: different period per blob
      speedX: [0.00045, 0.00065, 0.00085][i],
      speedY: [0.00038, 0.00058, 0.00075][i],
      // Amplitude of wandering (px)
      ampX: [120, 90, 70][i],
      ampY: [100, 80, 60][i],
    }));

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    this.tick();
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  tick() {
    this.time += 1;

    this.blobs.forEach((blob) => {
      // Natural wandering position using sin waves
      const naturalX = blob.baseX
        + Math.sin(this.time * blob.speedX + blob.phaseX) * blob.ampX
        + Math.sin(this.time * blob.speedX * 0.37 + blob.phaseX * 1.5) * blob.ampX * 0.4;

      const naturalY = blob.baseY
        + Math.sin(this.time * blob.speedY + blob.phaseY) * blob.ampY
        + Math.sin(this.time * blob.speedY * 0.41 + blob.phaseY * 1.3) * blob.ampY * 0.4;

      // Cursor repulsion
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

      // Smooth lerp — factor 0.04 for fluid movement
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
```

---

## Buttons

```css
/* PRIMARY — black metal */
.ns-btn-primary {
  background: linear-gradient(160deg, #111111 0%, #1C1C1C 50%, #0A0A0A 100%);
  border: 1px solid rgba(255,255,255,0.10);
  color: #FFFFFF;
  border-radius: 100px;
  font-weight: 600;
  font-size: 13px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.50);
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.ns-btn-primary::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 45%;
  background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%);
  border-radius: inherit;
  pointer-events: none;
}

.ns-btn-primary:hover {
  border-color: rgba(255,255,255,0.20);
  transform: translateY(-1px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 20px rgba(0,0,0,0.60);
}

.ns-btn-primary:active {
  transform: scale(0.97);
}

/* SECONDARY — silver metal shimmer */
.ns-btn-silver {
  background: linear-gradient(135deg, #787888 0%, #C0C0CC 40%, #888898 70%, #606070 100%);
  background-size: 300% 300%;
  animation: silverShift 4s ease-in-out infinite;
  border: none;
  color: #0A0A0A;
  border-radius: 100px;
  font-weight: 600;
  font-size: 13px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(0,0,0,0.30);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.ns-btn-silver::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 45%;
  background: linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%);
  border-radius: inherit;
  pointer-events: none;
}

.ns-btn-silver:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 20px rgba(0,0,0,0.35);
}

@keyframes silverShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

---

## Typography

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  font-weight: 300;
  line-height: 1.6;
  color: var(--ns-text-primary);
}

.ns-label { font-size: 12px; font-weight: 500; letter-spacing: 0.04em; }
.ns-heading { font-size: 20px; font-weight: 600; }
.ns-title { font-size: 15px; font-weight: 600; }
.ns-muted { color: var(--ns-text-secondary); }
.ns-ghost { color: var(--ns-text-muted); }
```

---

## Badges

```css
.ns-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
}

.ns-badge-prompt {
  background: var(--ns-badge-prompt-bg);
  border-color: var(--ns-badge-prompt-border);
  color: var(--ns-badge-prompt-text);
}

.ns-badge-beginner {
  background: var(--ns-badge-beginner-bg);
  border-color: var(--ns-badge-beginner-border);
  color: var(--ns-badge-beginner-text);
}

.ns-badge-intermediate {
  background: var(--ns-badge-intermediate-bg);
  border-color: var(--ns-badge-intermediate-border);
  color: var(--ns-badge-intermediate-text);
}

.ns-badge-advanced {
  background: var(--ns-badge-advanced-bg);
  border-color: var(--ns-badge-advanced-border);
  color: var(--ns-badge-advanced-text);
}
```

---

## Navigation

```css
.ns-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--ns-text-secondary);
  font-size: 14px;
  font-weight: 400;
  transition: background 0.15s ease, color 0.15s ease;
  cursor: pointer;
  border-left: 2px solid transparent;
}

.ns-nav-item:hover {
  background: rgba(255,255,255,0.05);
  color: var(--ns-text-primary);
}

.ns-nav-item.active {
  color: var(--ns-text-primary);
  border-left-color: var(--ns-orange);
  background: rgba(232, 87, 26, 0.08);
}
```

---

## Spacing

| Token | Value |
|-------|-------|
| Panel padding | 20px 16px |
| Card padding | 14px 16px |
| Feed item gap | 8px |
| Nav item gap | 4px |
| Section gap | 24px |
| Badge gap | 6px |
