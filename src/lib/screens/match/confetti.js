// @ts-check
const COLORS = ['var(--accent)', 'var(--gold)', 'var(--success)', 'var(--danger)', 'var(--warning)'];
let running = false;

/** Konfetti per Web Animations API (kein globales Keyframe-CSS nötig). Aus bei prefers-reduced-motion. */
export function triggerConfetti() {
  if (running || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  running = true;
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const size = 6 + Math.random() * 6;
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = `position:fixed;top:-10px;left:${Math.random() * 100}vw;width:${size}px;height:${size}px;`
        + `background:${COLORS[Math.floor(Math.random() * COLORS.length)]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};`
        + 'z-index:9999;pointer-events:none;';
      document.body.appendChild(el);
      const anim = el.animate(
        [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(105vh) rotate(720deg)', opacity: 0 }],
        { duration: 1200 + Math.random() * 1500, easing: 'ease-in', fill: 'forwards' },
      );
      anim.onfinish = () => el.remove();
    }, i * 30);
  }
  setTimeout(() => { running = false; }, 3000);
}
