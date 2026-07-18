import PocketBase from 'pocketbase';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
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

const pb = new PocketBase(PB_HOST);

const actions = [
  'bewegen',
  'aufruesten',
  'handeln',
  'produzieren',
  'entwickeln',
  'einsetzen',
  'bauen',
  'rekrutieren'
];

// Paths
const brainDir = 'C:\\Users\\bades\\.gemini\\antigravity\\brain\\ed8ab3b5-f0a0-4ebf-a751-e58b8d56ad33';
const localDestDir = join(__dirname, 'static', 'images', 'scythe', 'aktionen');
if (!existsSync(localDestDir)) {
  mkdirSync(localDestDir, { recursive: true });
}
const aktionenJsonPath = join(__dirname, 'static', 'data', 'games', 'scythe', 'modules', 'aktionen.json');

async function run() {
  try {
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASS);
    console.log(`✅ Angemeldet als Superuser.`);
  } catch (err) {
    try {
      await pb.admins.authWithPassword(PB_EMAIL, PB_PASS);
      console.log(`✅ Angemeldet als Admin.`);
    } catch (e) {
      console.error(`❌ Login fehlgeschlagen:`, e.message);
      process.exit(1);
    }
  }

  // Load aktionen.json
  let aktionenData;
  if (existsSync(aktionenJsonPath)) {
    aktionenData = JSON.parse(readFileSync(aktionenJsonPath, 'utf8'));
  } else {
    console.warn(`⚠️ aktionen.json nicht gefunden unter ${aktionenJsonPath}`);
  }

  for (const action of actions) {
    console.log(`\nVerarbeite Aktion: ${action}...`);

    // Find the latest generated PNG for this action
    const { readdirSync } = await import('fs');
    const brainFiles = readdirSync(brainDir);
    const pngFiles = brainFiles.filter(f => f.startsWith(`icon_${action}_`) && f.endsWith('.png'));
    
    if (pngFiles.length === 0) {
      console.error(`❌ Kein generiertes PNG gefunden für ${action}`);
      continue;
    }
    
    // Get the most recent one by sorting alphabetically (timestamp in filename)
    pngFiles.sort();
    const latestPng = pngFiles[pngFiles.length - 1];
    const sourcePngPath = join(brainDir, latestPng);
    
    const webpFilename = `icon-${action}.webp`;
    const localWebpPath = join(localDestDir, webpFilename);

    // Convert to webp
    try {
      await sharp(sourcePngPath)
        .webp({ quality: 90 })
        .toFile(localWebpPath);
      console.log(`✅ Konvertiert zu WebP: ${localWebpPath}`);
    } catch (err) {
      console.error(`❌ Fehler bei der Konvertierung von ${latestPng}:`, err.message);
      continue;
    }

    // Upload to Pocketbase
    try {
      const list = await pb.collection('wiki_items').getList(1, 1, {
        filter: `game_key = "scythe" && item_id = "aktion-${action}"`
      });

      if (list.items.length > 0) {
        const item = list.items[0];
        const fileBuffer = readFileSync(localWebpPath);
        const formData = new FormData();
        formData.append('image', new Blob([fileBuffer]), webpFilename);
        
        await pb.collection('wiki_items').update(item.id, formData);
        console.log(`✅ In PocketBase hochgeladen für item_id: aktion-${action}`);
      } else {
        console.warn(`⚠️ Kein Eintrag in PocketBase für item_id: aktion-${action} gefunden.`);
      }
    } catch (err) {
      console.error(`❌ Fehler beim Hochladen nach PocketBase:`, err.message);
    }

    // Update aktionen.json locally
    if (aktionenData) {
      const entry = aktionenData.entries.find(e => e.id === `aktion-${action}`);
      if (entry) {
        entry.image = `/images/scythe/aktionen/${webpFilename}`;
        console.log(`✅ aktionen.json Eintrag aktualisiert.`);
      }
    }
  }

  // Save aktionen.json
  if (aktionenData) {
    writeFileSync(aktionenJsonPath, JSON.stringify(aktionenData, null, 2));
    console.log(`\n✅ aktionen.json gespeichert.`);
  }

  console.log('\n🎉 Fertig!');
}

run();
