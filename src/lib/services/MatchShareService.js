// @ts-check

/**
 * Erstellt ein Bild aus den Match-Daten auf einem HTML5 Canvas.
 * @param {any} match 
 * @param {string} coverUrl 
 * @returns {Promise<Blob>}
 */
export async function generateShareImage(match, coverUrl) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    // Hintergrund zeichnen
    if (coverUrl) {
        try {
            const img = await loadImage(coverUrl);
            
            // Coverbild formatfüllend (cover) zeichnen
            const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;
            
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            
            // Dunkles Overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.warn('Could not load cover for share image', e);
            drawFallbackBackground(ctx, canvas);
        }
    } else {
        drawFallbackBackground(ctx, canvas);
    }

    // Glassmorphism Panel in der Mitte
    const panelWidth = 900;
    const panelHeight = 1200;
    const panelX = (canvas.width - panelWidth) / 2;
    const panelY = (canvas.height - panelHeight) / 2;

    ctx.fillStyle = 'rgba(30, 30, 40, 0.6)';
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Titel (Game Name)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(match.game_name || 'Unbekanntes Spiel', canvas.width / 2, panelY + 120);

    // Datum
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '36px sans-serif';
    const dateStr = match.date ? new Date(match.date).toLocaleDateString('de-DE') : '';
    ctx.fillText(dateStr, canvas.width / 2, panelY + 180);

    // Spieler und Punkte
    const scores = match.player_scores ?? match.expand?.player_scores ?? [];
    const sortedScores = [...scores].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    const topScore = sortedScores[0]?.total_score ?? 0;
    const isDraw = sortedScores.length > 1 && sortedScores[1]?.total_score === topScore;

    // Titel anpassen bei Gleichstand
    if (isDraw) {
        ctx.fillStyle = '#14b8a6';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🤝 UNENTSCHIEDEN', canvas.width / 2, panelY + 68);
    }

    let startY = panelY + 350;
    for (let i = 0; i < sortedScores.length; i++) {
        const ps = sortedScores[i];
        const isTied = isDraw && (ps.total_score || 0) === topScore;

        // Spieler Zeile
        const rowY = startY + (i * 140);

        // Avatar / Initiale
        ctx.fillStyle = isTied ? '#0d9488' : (i === 0 ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)');
        ctx.beginPath();
        ctx.arc(panelX + 120, rowY - 15, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = (i === 0 || isTied) ? '#ffffff' : '#aaaaaa';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isTied ? '🤝' : (i === 0 ? '👑' : String(i + 1)), panelX + 120, rowY + 2);

        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ps.player_name || 'Spieler', panelX + 210, rowY);

        // Punkte
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(ps.total_score || 0), panelX + panelWidth - 80, rowY + 5);
        
        // Label "Punkte"
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '24px sans-serif';
        ctx.fillText('Punkte', panelX + panelWidth - 80, rowY + 40);
    }

    // App Branding Bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Erstellt mit Brettspiel Partner', canvas.width / 2, panelY + panelHeight - 60);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.9);
    });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 */
function drawFallbackBackground(ctx, canvas) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#312e81');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

/**
 * Teilt ein Match als Bild oder lädt es herunter falls Share API nicht verfügbar
 * @param {any} match 
 * @param {string} coverUrl 
 */
export async function shareMatchAsImage(match, coverUrl) {
    const blob = await generateShareImage(match, coverUrl);
    const file = new File([blob], `match_${match.id || 'share'}.jpg`, { type: 'image/jpeg' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'Mein Brettspiel-Match',
                text: `Schau dir das Ergebnis von ${match.game_name} an!`,
                files: [file]
            });
            return;
        } catch (e) {
            console.warn('Share API Fehler/Abbruch', e);
        }
    }
    
    // Fallback: Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
