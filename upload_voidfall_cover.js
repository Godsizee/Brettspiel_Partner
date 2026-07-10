import PocketBase from 'pocketbase';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env laden
try {
  process.loadEnvFile(join(__dirname, '.env'));
} catch {
  console.error('❌ Keine .env Datei gefunden.');
  process.exit(1);
}

const PB_HOST  = process.env.PB_HOST  || 'https://pocketbase-boardgame.dasdann.jetzt';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

if (!PB_EMAIL || !PB_PASS) {
  console.error('❌ Bitte Admin-Zugangsdaten in .env setzen.');
  process.exit(1);
}

const COVER_PATH = 'C:\\Users\\SRH\\.gemini\\antigravity\\brain\\c7664829-55af-4677-959c-9755e79838b5\\voidfall_cover_1783339290555.png';

if (!existsSync(COVER_PATH)) {
  console.error(`❌ Cover-Bild nicht gefunden unter: ${COVER_PATH}`);
  process.exit(1);
}

async function run() {
  const pb = new PocketBase(PB_HOST);

  try {
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASS);
    console.log(`✅ Angemeldet als Superuser.`);
  } catch (err) {
    console.error(`❌ Login fehlgeschlagen:`, err.message);
    process.exit(1);
  }

  // Record suchen
  let voidfallRecord;
  try {
    const list = await pb.collection('games').getFullList();
    console.log('🎮 Vorhandene Spiele in PocketBase:');
    for (const item of list) {
      console.log(` - Key: "${item.key}", Name: "${item.name}", ID: "${item.id}"`);
    }
    let found = list.find(item => item.key === 'voidfall' || item.key === 'Voidfall');
    if (!found) {
      console.log('➕ Voidfall nicht in PocketBase gefunden. Erstelle Record...');
      found = await pb.collection('games').create({
        key: 'voidfall',
        name: 'Voidfall',
        badge: 'Expertenspiel',
        description: 'Verteidige dein Haus gegen die Leere — mit Fokuskarten, Technologien und Galaktischen Ereignissen.',
        players: '1–4 Spieler',
        active: true,
        order: 99,
        theme: {
          primary: 'hsl(260, 60%, 50%)',
          secondary: 'hsl(200, 80%, 55%)',
          gradientColor: '#7C3AED',
          icon_bg: null,
          icon_style: 'colored'
        },
        categories: [
          {
            "id": "placeholder",
            "label": "Platzhalter",
            "type": "sum"
          }
        ]
      });
      console.log(`✅ Voidfall-Record erstellt. ID: ${found.id}`);
    }
    voidfallRecord = found;
  } catch (err) {
    console.error('❌ Fehler beim Suchen/Erstellen des Records:', err.message);
    if (err.data) {
      console.error('🔍 Fehlerdetails:', JSON.stringify(err.data, null, 2));
    }
    process.exit(1);
  }

  // Cover hochladen
  try {
    const fileBuffer = readFileSync(COVER_PATH);
    const formData = new FormData();
    formData.append('cover', new Blob([fileBuffer]), 'voidfall_cover.png');
    formData.append('cover_image', 'voidfall_cover.png');

    console.log('⏳ Lade Cover hoch...');
    const updated = await pb.collection('games').update(voidfallRecord.id, formData);
    console.log('✅ Cover erfolgreich hochgeladen und verknüpft!');
    console.log(`🔗 Neues Cover: ${PB_HOST}/api/files/games/${updated.id}/${updated.cover}`);
  } catch (err) {
    console.error('❌ Fehler:', err.message);
    if (err.data) {
      console.error('🔍 Fehlerdetails:', JSON.stringify(err.data, null, 2));
    }
    process.exit(1);
  }
}

run();
