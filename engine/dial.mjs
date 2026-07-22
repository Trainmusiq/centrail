// Dial de aguja — elemento firma de la marca (brief de diseño §5: "cuando el
// tema está afinado, la aguja queda centrada — la metáfora de Centrail hecha
// interfaz"). Extraído de index.html (v1.3) para reusarlo en el modo
// Grabación (una sola medición) y en el modo En vivo (alimentación continua,
// misma función, se llama en cada actualización del afinador).

/**
 * @param {SVGSVGElement} svg elemento <svg> destino (viewBox "0 0 340 120")
 * @param {number} offsetCents desviación en cents, clampeada a ±50 para el dibujo
 */
export function drawDial(svg, offsetCents) {
  const cx = 170, cy = 118, rad = 100;
  const clamp = Math.max(-50, Math.min(50, offsetCents));
  const ang = (clamp / 50) * (Math.PI / 3); // 0 = vertical (centrado), ±60° en los extremos
  let ticks = "";
  for (let c = -50; c <= 50; c += 10) {
    const a = (c / 50) * (Math.PI / 3);
    const r1 = c === 0 ? rad - 16 : rad - 9;
    ticks += tick(cx, cy, a, r1, rad, c === 0);
  }
  function tick(cx, cy, a, r1, r2, major) {
    const x1 = cx + Math.sin(a) * r1, y1 = cy - Math.cos(a) * r1;
    const x2 = cx + Math.sin(a) * r2, y2 = cy - Math.cos(a) * r2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${major ? "var(--cyan)" : "var(--line)"}" stroke-width="${major ? 2 : 1.2}"/>`;
  }
  const nx = cx + Math.sin(ang) * (rad - 20), ny = cy - Math.cos(ang) * (rad - 20);
  svg.innerHTML = `
    <path d="M ${cx - Math.sin(Math.PI/3)*rad} ${cy - Math.cos(Math.PI/3)*rad}
             A ${rad} ${rad} 0 0 1 ${cx + Math.sin(Math.PI/3)*rad} ${cy - Math.cos(Math.PI/3)*rad}"
          fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"
          stroke="var(--amber)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="var(--amber)"/>`;
}
