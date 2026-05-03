import { useEffect, useRef } from 'react';

const modules = [
    { label: 'Validate', sub: 'schema · rules', col: '#00c9a7', angle: 270 },
    { label: 'Clean', sub: 'nulls · trim', col: '#4a90d9', angle: 310 },
    { label: 'Transform', sub: 'reshape · enrich', col: '#f472b6', angle: 350 },
    { label: 'Map', sub: 'fields · schema', col: '#7c6fcd', angle: 30 },
    { label: 'Match', sub: 'dedupe · fuzzy', col: '#e07b54', angle: 70 },
    { label: 'Scrape', sub: 'web · templates', col: '#f59e0b', angle: 110 },
    { label: 'Pricing', sub: 'AI · intel', col: '#e05c94', angle: 150 },
    { label: 'Visualize', sub: 'AI charts', col: '#2dd4bf', angle: 190 },
    { label: 'Pipeline', sub: 'orchestrate', col: '#a78bfa', angle: 230 },
];

export default function CleanflowAnimation() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');

        const W = 680, H = 500;
        cv.width = W;
        cv.height = H;

        const HUB = { x: 340, y: 252 };
        const R_NODE = 26;
        const ORBIT = 172;
        const PHASE_DUR = 2200;

        const mods = modules.map(m => {
            const rad = m.angle * Math.PI / 180;
            return {
                ...m,
                x: HUB.x + Math.cos(rad) * ORBIT,
                y: HUB.y + Math.sin(rad) * ORBIT,
            };
        });

        let particles = [];
        let tick = 0;
        let activeModule = 0;
        let phaseTimer = 0;
        let spawnClock = 0;
        let transformBits = [];
        let lastTS = 0;
        let rafId;

        const orbiters = Array.from({ length: 14 }, (_, i) => ({
            angle: (i / 14) * Math.PI * 2,
            r: 50 + (i % 3) * 8,
            speed: 0.007 + (i % 4) * 0.003,
            size: 1.4 + (i % 2) * 0.8,
            col: ['#00c9a7', '#4a90d9', '#7c6fcd', '#f472b6'][i % 4],
            alpha: 0.35 + Math.random() * 0.4,
        }));

        function spawnParticle(fromX, fromY, toX, toY, col, size = 2.2) {
            particles.push({
                x: fromX, y: fromY, tx: toX, ty: toY,
                col, size, t: 0,
                speed: 0.015 + Math.random() * 0.01,
                trail: [], done: false,
            });
        }

        function spawnTransformBit(m) {
            transformBits.push({
                x: m.x - 12,
                y: m.y - 10 + Math.random() * 20,
                alpha: 1,
                speed: 1.8 + Math.random() * 1.2,
                col: '#f472b6',
            });
        }

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        }

        function draw(ts) {
            const dt = Math.min(ts - lastTS, 32);
            lastTS = ts;
            tick += dt;
            phaseTimer += dt;

            if (phaseTimer > PHASE_DUR) {
                phaseTimer = 0;
                activeModule = (activeModule + 1) % mods.length;
            }

            // Background
            ctx.fillStyle = '#0b1520';
            ctx.fillRect(0, 0, W, H);

            // Grid
            ctx.strokeStyle = 'rgba(255,255,255,0.022)';
            ctx.lineWidth = 0.5;
            for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

            const am = mods[activeModule];
            const isTransform = am.label === 'Transform';

            // Connectors
            mods.forEach((m, i) => {
                const isActive = i === activeModule;
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(HUB.x, HUB.y);
                ctx.strokeStyle = isActive ? m.col + 'bb' : 'rgba(255,255,255,0.06)';
                ctx.lineWidth = isActive ? 1.5 : 0.5;
                ctx.setLineDash(isActive ? [] : [4, 9]);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            // Spawn
            spawnClock += dt;
            if (spawnClock > 200) {
                spawnClock = 0;
                spawnParticle(HUB.x, HUB.y, am.x, am.y, am.col, 2.5);
                if (Math.random() > 0.35) spawnParticle(am.x, am.y, HUB.x, HUB.y, am.col, 1.8);
                const rnd = mods[(activeModule + 3 + Math.floor(Math.random() * 4)) % mods.length];
                spawnParticle(HUB.x, HUB.y, rnd.x, rnd.y, rnd.col, 1.1);
                if (isTransform && Math.random() > 0.5) spawnTransformBit(am);
            }

            // Transform bits
            if (isTransform) {
                transformBits = transformBits.filter(b => b.alpha > 0.02);
                transformBits.forEach(b => {
                    b.x += b.speed;
                    b.alpha -= 0.028;
                    ctx.globalAlpha = b.alpha;
                    ctx.strokeStyle = b.col;
                    ctx.lineWidth = 1.5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x + 18, b.y);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                });
            }

            // Particles
            particles = particles.filter(p => !p.done);
            for (const p of particles) {
                p.t = Math.min(p.t + p.speed, 1);
                p.x = p.x + (p.tx - p.x) * p.speed * 0.85;
                p.y = p.y + (p.ty - p.y) * p.speed * 0.85;
                if (p.t >= 1) { p.done = true; continue; }
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 16) p.trail.shift();
                for (let i = 0; i < p.trail.length; i++) {
                    ctx.beginPath();
                    ctx.arc(p.trail[i].x, p.trail[i].y, p.size * 0.45, 0, Math.PI * 2);
                    ctx.fillStyle = p.col + '44';
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.col;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
                ctx.fillStyle = p.col + '16';
                ctx.fill();
            }

            // Orbiters
            orbiters.forEach(o => {
                o.angle += o.speed;
                const ox = HUB.x + Math.cos(o.angle) * o.r;
                const oy = HUB.y + Math.sin(o.angle) * o.r;
                ctx.beginPath();
                ctx.arc(ox, oy, o.size, 0, Math.PI * 2);
                ctx.fillStyle = o.col;
                ctx.globalAlpha = o.alpha;
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            // Hub pulse ring
            const pulse = Math.sin(tick * 0.002) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(HUB.x, HUB.y, 43 + pulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0,201,167,${0.07 + pulse * 0.11})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Hub ring
            ctx.beginPath();
            ctx.arc(HUB.x, HUB.y, 41, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,201,167,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Hub fill
            ctx.beginPath();
            ctx.arc(HUB.x, HUB.y, 39, 0, Math.PI * 2);
            ctx.fillStyle = '#0f2030';
            ctx.fill();

            // Hub text
            ctx.font = '500 11px sans-serif';
            ctx.fillStyle = '#00c9a7';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Cleanflow', HUB.x, HUB.y - 5);
            ctx.font = '9px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillText('data hub', HUB.x, HUB.y + 8);

            // Module nodes
            mods.forEach((m, i) => {
                const isActive = i === activeModule;
                const pp = Math.sin(tick * 0.0025 + i * 0.7) * 0.5 + 0.5;

                if (isActive) {
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, R_NODE + 10 + pp * 5, 0, Math.PI * 2);
                    ctx.strokeStyle = m.col + '28';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, R_NODE + 4, 0, Math.PI * 2);
                    ctx.strokeStyle = m.col + '80';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(m.x, m.y, R_NODE, 0, Math.PI * 2);
                ctx.fillStyle = '#0d1a27';
                ctx.fill();
                ctx.strokeStyle = isActive ? m.col + 'cc' : m.col + '30';
                ctx.lineWidth = isActive ? 1.5 : 0.75;
                ctx.stroke();

                if (isActive && m.label === 'Transform') {
                    ctx.font = '10px sans-serif';
                    ctx.fillStyle = m.col;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⇄', m.x, m.y);
                } else {
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, isActive ? 6 : 4, 0, Math.PI * 2);
                    ctx.fillStyle = isActive ? m.col : m.col + '77';
                    ctx.fill();
                }

                ctx.font = `${isActive ? '500' : '400'} 11px sans-serif`;
                ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.4)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(m.label, m.x, m.y + R_NODE + 7);
                ctx.font = '9px monospace';
                ctx.fillStyle = isActive ? m.col : 'rgba(255,255,255,0.18)';
                ctx.fillText(m.sub, m.x, m.y + R_NODE + 20);
            });

            // Active label near hub
            const fadeIn = Math.min(phaseTimer / 350, 1);
            const fadeOut = phaseTimer > PHASE_DUR - 280 ? (PHASE_DUR - phaseTimer) / 280 : 1;
            ctx.globalAlpha = Math.min(fadeIn, fadeOut);
            ctx.font = '500 11px sans-serif';
            ctx.fillStyle = am.col;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▶ ' + am.label.toLowerCase() + ' in progress', HUB.x, HUB.y + 60);
            ctx.globalAlpha = 1;

            // Progress arc on active node
            const prog = phaseTimer / PHASE_DUR;
            ctx.beginPath();
            ctx.arc(am.x, am.y, R_NODE + 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
            ctx.strokeStyle = am.col;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();

            rafId = requestAnimationFrame(draw);
        }

        rafId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return (
        <div className="absolute inset-0 bg-[#0b1520] overflow-hidden">
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Dark gradient overlay at the bottom so the overlaid text is perfectly readable */}
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0b1520] via-[#0b1520]/60 to-transparent pointer-events-none" />
        </div>
    );
}