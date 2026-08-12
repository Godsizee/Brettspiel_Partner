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

const COVER_PATH = 'C:\\Users\\bades\\.gemini\\antigravity-ide\\brain\\a582648d-df2f-42ab-a1bf-a2a37ce34c88\\frostpunk_cover_inspired_1786547308765.png';

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
  let frostpunkRecord;
  try {
    const list = await pb.collection('games').getFullList();
    console.log('🎮 Vorhandene Spiele in PocketBase:');
    let found = list.find(item => item.key === 'frostpunk' || item.name === 'Frostpunk');
    if (!found) {
      console.log('➕ Frostpunk nicht in PocketBase gefunden. Erstelle Record...');
      found = await pb.collection('games').create({
        key: 'frostpunk',
        name: 'Frostpunk',
        badge: 'Kennerspiel',
        description: 'Überlebe in einer eisigen, post-apokalyptischen Welt durch kluges Ressourcenmanagement und harte Entscheidungen.',
        players: '1–4 Spieler',
        active: true,
        order: 100,
        theme: {
          primary: 'hsl(190, 60%, 40%)',
          secondary: 'hsl(210, 80%, 55%)',
          gradientColor: '#0ea5e9',
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
      console.log(`✅ Frostpunk-Record erstellt. ID: ${found.id}`);
    } else {
      console.log(`✅ Frostpunk-Record gefunden. ID: ${found.id}`);
    }
    frostpunkRecord = found;
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
    formData.append('cover', new Blob([fileBuffer]), 'frostpunk_cover.png');
    formData.append('cover_image', 'frostpunk_cover.png');

    console.log('⏳ Lade Cover hoch...');
    const updated = await pb.collection('games').update(frostpunkRecord.id, formData);
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
