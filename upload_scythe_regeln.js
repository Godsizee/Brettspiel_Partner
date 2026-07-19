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

const groups = [
  'grundlagen',
  'bewegung',
  'kampf',
  'begegnungen',
  'ansehen',
  'ziele'
];

// Mapping for our script groups to the actual "group" value in regeln.json
const groupMap = {
  'grundlagen': 'grundlagen',
  'bewegung': 'bewegung',
  'kampf': 'kampf',
  'begegnungen': 'begegnungen-fabrik',
  'ansehen': 'ansehen-staerke',
  'ziele': 'ziele-spielende'
};

// Paths
const brainDir = 'C:\\Users\\bades\\.gemini\\antigravity\\brain\\e460dc8e-df1d-435f-aed4-1a69f137ab34';
const localDestDir = join(__dirname, 'static', 'images', 'scythe', 'regeln');
if (!existsSync(localDestDir)) {
  mkdirSync(localDestDir, { recursive: true });
}
const regelnJsonPath = join(__dirname, 'static', 'data', 'games', 'scythe', 'modules', 'regeln.json');

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

  // Load regeln.json
  let regelnData;
  if (existsSync(regelnJsonPath)) {
    regelnData = JSON.parse(readFileSync(regelnJsonPath, 'utf8'));
  } else {
    console.warn(`⚠️ regeln.json nicht gefunden unter ${regelnJsonPath}`);
  }

  const { readdirSync } = await import('fs');
  const brainFiles = readdirSync(brainDir);

  for (const groupKey of groups) {
    console.log(`\nVerarbeite Kategorie: ${groupKey}...`);
    const actualGroup = groupMap[groupKey];

    // Find the latest generated PNG for this group
    const pngFiles = brainFiles.filter(f => f.startsWith(`icon_${groupKey}_`) && f.endsWith('.png'));
    
    if (pngFiles.length === 0) {
      console.error(`❌ Kein generiertes PNG gefunden für ${groupKey}`);
      continue;
    }
    
    // Get the most recent one by sorting alphabetically (timestamp in filename)
    pngFiles.sort();
    const latestPng = pngFiles[pngFiles.length - 1];
    const sourcePngPath = join(brainDir, latestPng);
    
    const webpFilename = `icon-${groupKey}.webp`;
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

    // Now update all items in pocketbase that belong to this group
    // The items are in 'wiki_items' with game_key = "scythe" and category_id = "regeln"
    if (regelnData) {
      const itemsInGroup = regelnData.entries.filter(e => e.group === actualGroup);
      for (const entry of itemsInGroup) {
        entry.image = `/images/scythe/regeln/${webpFilename}`;
        
        // Upload to PocketBase
        try {
          const list = await pb.collection('wiki_items').getList(1, 1, {
            filter: `game_key = "scythe" && item_id = "${entry.id}"`
          });

          if (list.items.length > 0) {
            const item = list.items[0];
            const fileBuffer = readFileSync(localWebpPath);
            const formData = new FormData();
            formData.append('image', new Blob([fileBuffer]), webpFilename);
            
            await pb.collection('wiki_items').update(item.id, formData);
            console.log(`✅ In PocketBase hochgeladen für item_id: ${entry.id}`);
          } else {
            console.warn(`⚠️ Kein Eintrag in PocketBase für item_id: ${entry.id} gefunden.`);
          }
        } catch (err) {
          console.error(`❌ Fehler beim Hochladen nach PocketBase für ${entry.id}:`, err.message);
        }
      }
      console.log(`✅ regeln.json Einträge für Gruppe ${actualGroup} aktualisiert.`);
    }
  }

  // Save regeln.json
  if (regelnData) {
    writeFileSync(regelnJsonPath, JSON.stringify(regelnData, null, 2));
    console.log(`\n✅ regeln.json gespeichert.`);
  }

  console.log('\n🎉 Fertig!');
}

run();
