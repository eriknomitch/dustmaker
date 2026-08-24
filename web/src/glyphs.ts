// Vector military glyphs, ported from the prototype's canvas renderer to
// PixiJS Graphics. Presentation only — shapes encode type and mode
// (launch chevron, defend ring, submerged dash) exactly like the prototype.
import { Graphics } from 'pixi.js';
import type { Unit } from '../../engine/src/types';

export function dashedCircle(
  g: Graphics, x: number, y: number, r: number,
  color: number, alpha: number, dash = 4, gap = 4, width = 1,
): void {
  const step = (dash + gap) / r; // radians per dash+gap
  for (let a = 0; a < Math.PI * 2; a += step) {
    // moveTo first — arc() draws a connecting line from the current point
    g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.arc(x, y, r, a, Math.min(a + dash / r, Math.PI * 2));
    g.stroke({ color, alpha, width });
  }
}

export function drawGlyph(g: Graphics, u: Unit, x: number, y: number, s: number, color: number, lw: number): void {
  const stroke = { color, width: lw };
  switch (u.type) {
    case 'silo':
      g.moveTo(x - s, y + s).lineTo(x, y - s).lineTo(x + s, y + s).closePath().stroke(stroke);
      if (u.siloMode === 'launch') {
        g.moveTo(x, y + s * 0.5).lineTo(x, y - s * 1.7).stroke(stroke);
        g.moveTo(x - 2.5, y - s * 1.1).lineTo(x, y - s * 1.9).lineTo(x + 2.5, y - s * 1.1).stroke(stroke);
      } else if (u.siloMode === 'defend') {
        dashedCircle(g, x, y, s * 1.55, color, 0.85, 2, 2, lw * 0.7);
      } else {
        dashedCircle(g, x, y, s * 1.55, color, 0.45, 2, 2, lw * 0.7);
      }
      break;
    case 'radar': {
      const a0 = Math.PI * 1.15;
      for (const r of [s, s * 1.7]) {
        g.moveTo(x + Math.cos(a0) * r, y + s * 0.6 + Math.sin(a0) * r);
        g.arc(x, y + s * 0.6, r, a0, Math.PI * 1.85).stroke(stroke);
      }
      g.moveTo(x, y + s * 0.6).lineTo(x, y + s * 1.4).stroke(stroke);
      break;
    }
    case 'airbase':
      g.circle(x, y, s * 1.1).stroke(stroke);
      g.moveTo(x - s * 1.5, y + s * 0.9).lineTo(x + s * 1.5, y - s * 0.9).stroke(stroke);
      break;
    case 'carrier':
      g.moveTo(x - s * 1.6, y - s * 0.6).lineTo(x + s * 1.6, y - s * 0.6)
        .lineTo(x + s * 1.1, y + s * 0.8).lineTo(x - s * 1.1, y + s * 0.8).closePath().stroke(stroke);
      g.moveTo(x - s * 1.2, y - s * 0.6).lineTo(x + s * 0.4, y - s * 1.5).stroke(stroke);
      break;
    case 'battleship':
      g.moveTo(x - s * 1.8, y).lineTo(x - s * 0.9, y - s * 0.75).lineTo(x + s * 1.1, y - s * 0.75)
        .lineTo(x + s * 1.8, y).lineTo(x + s * 1.1, y + s * 0.75).lineTo(x - s * 0.9, y + s * 0.75)
        .closePath().stroke(stroke);
      break;
    case 'sub':
      if (u.subMode === 'submerged') {
        dashedEllipse(g, x, y, s * 1.7, s * 0.72, color, 0.9, lw);
      } else {
        g.ellipse(x, y, s * 1.7, s * 0.72).stroke(stroke);
      }
      g.moveTo(x - s * 0.2, y - s * 0.7).lineTo(x - s * 0.2, y - s * 1.5).stroke(stroke);
      break;
    case 'bomber':
      g.moveTo(x - s * 1.3, y + s * 0.8).lineTo(x, y - s).lineTo(x + s * 1.3, y + s * 0.8)
        .lineTo(x, y + s * 0.25).closePath().stroke(stroke);
      break;
  }
}

function dashedEllipse(
  g: Graphics, x: number, y: number, rx: number, ry: number,
  color: number, alpha: number, width: number,
): void {
  const n = 16;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    g.moveTo(x + Math.cos(a0) * rx, y + Math.sin(a0) * ry)
      .lineTo(x + Math.cos(a1) * rx, y + Math.sin(a1) * ry)
      .stroke({ color, alpha, width });
  }
}

export function hostileBracket(g: Graphics, x: number, y: number, b: number, color: number): void {
  const s = { color, width: 1, alpha: 0.5 };
  const c = 3;
  g.moveTo(x - b, y - b + c).lineTo(x - b, y - b).lineTo(x - b + c, y - b).stroke(s);
  g.moveTo(x + b - c, y - b).lineTo(x + b, y - b).lineTo(x + b, y - b + c).stroke(s);
  g.moveTo(x - b, y + b - c).lineTo(x - b, y + b).lineTo(x - b + c, y + b).stroke(s);
  g.moveTo(x + b - c, y + b).lineTo(x + b, y + b).lineTo(x + b, y + b - c).stroke(s);
}

export function hpPips(g: Graphics, x: number, y: number, hp: number, hpMax: number, color: number): void {
  if (hpMax <= 1) return;
  for (let i = 0; i < hpMax; i++) {
    g.rect(x - (hpMax * 3) / 2 + i * 3, y, 2, 2)
      .fill({ color: i < hp ? color : 0x2b2b2b, alpha: i < hp ? 0.9 : 0.6 });
  }
}
