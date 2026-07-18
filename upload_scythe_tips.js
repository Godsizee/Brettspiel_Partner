import PocketBase from 'pocketbase';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const tips = [
  {
    game_key: 'scythe',
    title: 'Wichtige Grundprinzipien',
    difficulty: 'Allgemein',
    tags: ['Grundlagen', 'Strategie'],
    sort_order: 10,
    content: `
      <ul>
        <li><strong>Münzen sind der Schlüssel:</strong> Du gewinnst über Münzen, nicht über Sterne. Sterne sind primär ein Tempo-Tool, um das Spiel zu beenden.</li>
        <li><strong>Ziele setzen:</strong> Plane früh, welche 5–6 Sterne du anpeilst. Optimal sind 3–4 „langsame“ Sterne (wie Upgrades, Mechs, Gebäude, Rekruten) und 2–3 „schnelle“ Sterne (z.B. Kämpfe, maximale Stärke, Arbeiter).</li>
        <li><strong>Aktionseffizienz:</strong> Das Ziel ist fast immer, obere und untere Aktionen zusammen zu nutzen, damit jeder Zug die Engine voranbringt UND einen kurzfristigen Effekt hat.</li>
      </ul>
      <p><strong>Beispiele für gute „langsame“ Sterne:</strong> 4× gleiche untere Aktion, alle Gebäude/Mechs, 8 Arbeiter (nur wenn danach kaum noch produziert wird).</p>
      <p><strong>Beispiele für „schnelle“ Sterne:</strong> 2 gewonnene Kämpfe, 16 Stärke, Missionskarte.</p>
    `
  },
  {
    game_key: 'scythe',
    title: 'Aktions- und Engine-Basics',
    difficulty: 'Allgemein',
    tags: ['Aktionen', 'Engine'],
    sort_order: 20,
    content: `
      <h3>Aktionsökonomie</h3>
      <ul>
        <li><strong>Häufige Fehler:</strong> Nur die obere Aktion nutzen oder Aktionen ohne klares Folgeziel ausführen.</li>
        <li><strong>Starke Züge:</strong> Plane Abfolgen wie „Produzieren → (Ressourcen liegen lassen) → Upgrade/Bauen/Rekrutieren“ und wechsle dann auf Handel, sobald das Produzieren zu teuer wird.</li>
      </ul>
      <h3>Gute frühe Upgrades</h3>
      <ul>
        <li><strong>Bewegung:</strong> Mehr Felder pro Bewegung bedeuten schnelleren Zugang zu Encounters und der Factory.</li>
        <li><strong>Kosten-Reduktion:</strong> Reduziere die Kosten deiner lukrativsten unteren Aktion (die auf deinem Tableau die meisten Münzen bringt).</li>
      </ul>
      <h3>Board-Entwicklung</h3>
      <ul>
        <li><strong>Frühes Spiel:</strong> Arbeiter verteilen, Holz/Metall sichern und einen Weg von der Startinsel finden (z.B. über Mine oder Riverwalk-Mech).</li>
        <li><strong>Mittleres Spiel:</strong> Präsenz um die Factory aufbauen, Tunnels sichern und Encounters einsammeln.</li>
        <li><strong>Spätes Spiel:</strong> Arbeiter weit verteilen (oft über Mechs transportiert). Ein gut vorbereiteter Doppel-Move kann 6-8 zusätzliche Gebiete für die Endwertung sichern.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Ressourcen, Arbeiter, Popularität',
    difficulty: 'Allgemein',
    tags: ['Ressourcen', 'Arbeiter', 'Popularität'],
    sort_order: 30,
    content: `
      <h3>Arbeiter-Management</h3>
      <ul>
        <li><strong>5 Arbeiter:</strong> Guter Standard, die Produktionskosten bleiben moderat.</li>
        <li><strong>8 Arbeiter:</strong> Maximal flexibel (hohe Präsenz und Druck, schneller Stern), aber du musst sehr früh auf Handel umsteigen, sonst fressen dich die Produktionskosten auf.</li>
        <li><strong>Positionierung:</strong> Platziere Arbeiter dort, wo du später Gebäude bauen oder Mechs bezahlen willst. Das spart dir kostbare Bewegungsaktionen.</li>
      </ul>
      <h3>Popularität</h3>
      <ul>
        <li><strong>Der Multiplikator:</strong> Popularität ist extrem wichtig, da sie den Punktwert deiner Sterne, Gebiete und Ressourcen bei Spielende bestimmt. Die Sprünge zwischen den Leisten-Bereichen sind enorm.</li>
        <li><strong>Popularitätsverlust:</strong> Kämpfe gegen ungeschützte gegnerische Arbeiter kosten Popularität. Setze deshalb gerne große Arbeiter-Stacks zur Abschreckung ein.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Kampf, Drohung und Timing',
    difficulty: 'Fortgeschritten',
    tags: ['Kampf', 'Timing'],
    sort_order: 40,
    content: `
      <ul>
        <li><strong>Kein Kriegsspiel:</strong> Scythe ist ein Engine-Builder. Kämpfe sind punktuelle Tools für Sterne, Position und Tempo.</li>
        <li><strong>Abschreckung:</strong> Früh die Stärke durch Aufrüsten oder Rekruten-Boni hochzuziehen, schreckt Angriffe ab und erleichtert später den Doppelkampf-Stern.</li>
        <li><strong>Kampfkarten effizient einsetzen:</strong> Es reicht oft, knapp zu gewinnen. Overkill verschwendet wertvolle Ressourcen.</li>
      </ul>
      <h3>Timing-Aspekte</h3>
      <ul>
        <li><strong>Wachsamkeit:</strong> Beobachte immer, wer bereits 4–5 Sterne hat. Das Spiel kann dann in ein bis zwei Zügen enden.</li>
        <li><strong>Der "Spike":</strong> Plane eine Runde, in der du nacheinander z.B. einen Kampfstern, den Stern für eine untere Aktion und dann noch den Stärke- oder Arbeiter-Stern erlangst.</li>
        <li><strong>Strategisches Warten:</strong> Lege deinen sechsten Stern nicht sofort, wenn deine Endpunktzahl zu diesem Zeitpunkt noch schlechter wäre als die deines Verfolgers.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Encounters, Objectives, Factory',
    difficulty: 'Allgemein',
    tags: ['Encounters', 'Factory', 'Objectives'],
    sort_order: 50,
    content: `
      <h3>Begegnungen (Encounters)</h3>
      <ul>
        <li><strong>Tempo im Early Game:</strong> Gehe mit dem Anführer schnell auf mindestens einen Encounter. Dies ist oft viel stärker als ein Standard-Zug.</li>
        <li><strong>Die richtige Wahl:</strong> Wähle Optionen, die deine Engine dauerhaft stärken. Upgrades, Rekruten oder Mechs sind meist besser als einmalige Ressourcen.</li>
      </ul>
      <h3>Missionen (Objectives)</h3>
      <ul>
        <li><strong>Frühe Planung:</strong> Lies die Karten vor dem ersten Zug und entscheide, welche gut zu deinem Tableau und deiner Fraktion passt.</li>
        <li><strong>Als Wildcard:</strong> Sie eignen sich super als flexibler Stern, den du gegen Ende relativ spontan oder gezielt einsammeln kannst.</li>
      </ul>
      <h3>Die Fabrik (Factory)</h3>
      <ul>
        <li><strong>Kontrolle:</strong> Die Factory zählt am Ende als 3 Gebiete und gibt dir eine sehr starke zusätzliche Aktionskarte (starke obere Aktion + Bewegung unten).</li>
        <li><strong>Fabrikkarten-Effizienz:</strong> Karten, die als obere Aktion Upgrades oder Mechs erlauben, sind besonders stark, da sie die Ressourcenanforderungen umgehen.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Fraktion: Rusviet (Rot)',
    difficulty: 'Anfänger',
    tags: ['Fraktionen', 'Rusviet'],
    sort_order: 60,
    content: `
      <ul>
        <li><strong>Fähigkeit:</strong> Die gleiche Aktion im nächsten Zug wiederholen. Dies negiert die größte Einschränkung im Spiel.</li>
        <li><strong>Spielplan:</strong> Etabliere effiziente Aktions-Loops (z.B. Bewegen+Bauen oder Produzieren+Aufrüsten) und spamme diese, bis die Engine steht. Dann sammle Sterne.</li>
        <li><strong>Tipps:</strong> Baue früh Mechs für die Mobilität. Nutze deine stärkste Aktion ruhig zwei- oder dreimal hintereinander.</li>
        <li><strong>Achtung:</strong> Variiere trotzdem rechtzeitig (z.B. Rekrutieren/Bauen), sonst fehlen dir am Ende Münzen aus den unteren Aktionen. Nutze die Fähigkeit nicht, um eine schwache Aktion unnötig zu wiederholen.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Fraktion: Nordic (Blau)',
    difficulty: 'Anfänger',
    tags: ['Fraktionen', 'Nordic'],
    sort_order: 70,
    content: `
      <ul>
        <li><strong>Fähigkeit:</strong> Arbeiter können über Flüsse schwimmen (integrierter Riverwalk).</li>
        <li><strong>Spielplan:</strong> Nutze Flüsse früh für schnelle Expansion. Baue viele Arbeiter, sichere weite Gebiete und wechsle später vom Produzieren auf den Handel.</li>
        <li><strong>Tipps:</strong> 6-8 Arbeiter sind früh möglich, sofern du rechtzeitig auf Handel umschaltest. Platziere Gebäude wie die Mine klug, um über die Karte flexibel zu bleiben.</li>
        <li><strong>Achtung:</strong> Nutze die Schwimm-Fähigkeit unbedingt aus, sonst spielst du effektiv eine Fraktion ohne Spezialfähigkeit.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Fraktion: Crimea (Gelb)',
    difficulty: 'Fortgeschritten',
    tags: ['Fraktionen', 'Crimea'],
    sort_order: 80,
    content: `
      <ul>
        <li><strong>Fähigkeit:</strong> Einmal pro Zug kann eine Kampfkarte als beliebige Ressource genutzt werden.</li>
        <li><strong>Spielplan:</strong> Nutze Kampfkarten als flexible Wirtschaft. Dadurch werden teure Mechs, Gebäude und Rekruten viel früher möglich.</li>
        <li><strong>Tipps:</strong> Baue den ersten Rekruten bei der Aktion, die dir Kampfkarten gibt, um den Nachschub zu sichern. Finanziere teure Züge über die Kampfkarten.</li>
        <li><strong>Achtung:</strong> Das Handkarten-Management ist anspruchsvoll. Verschwende keine Kampfkarten sinnlos in Kämpfen, da du sonst Wirtschafts- UND Kampfkraft verlierst.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Fraktion: Polania (Weiß)',
    difficulty: 'Anfänger',
    tags: ['Fraktionen', 'Polania'],
    sort_order: 90,
    content: `
      <ul>
        <li><strong>Fähigkeiten:</strong> Zwei Optionen bei Begegnungen wählen; der "Camaraderie"-Mech verhindert Popularitätsverluste beim Verdrängen gegnerischer Arbeiter.</li>
        <li><strong>Spielplan:</strong> Fokussiere dich stark auf Begegnungen. Halte die Popularität hoch und nutze "Camaraderie" für gezielte Gebietskontrolle.</li>
        <li><strong>Tipps:</strong> Plane die Route deines Anführers so, dass er viele Encounters mitnimmt; die doppelten Belohnungen bauen eine mächtige Engine. Eine hohe Popularität zahlt sich massiv aus.</li>
        <li><strong>Achtung:</strong> Wenn du Encounters ignorierst und ein normales Wirtschaftsspiel aufziehst, verlierst du den größten Vorteil deiner Fraktion.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Fraktion: Saxony (Schwarz)',
    difficulty: 'Fortgeschritten',
    tags: ['Fraktionen', 'Saxony'],
    sort_order: 100,
    content: `
      <ul>
        <li><strong>Fähigkeit:</strong> Kein Limit für Kampf- und Missionssterne.</li>
        <li><strong>Spielplan:</strong> Ein opportunistischer, aggressiver Spielstil. Sammle Ressourcen für eine starke Armee und schlage im Mid/Lategame mit mehreren Kämpfen gleichzeitig zu.</li>
        <li><strong>Tipps:</strong> Baue früh Stärke und Kampfkarten auf. Suche nach schwach verteidigten Feldern (z.B. einzelne Mechs oder Anführer) und schlage gezielt zu.</li>
        <li><strong>Achtung:</strong> Ignoriere niemals deine Popularität, sonst bringen dir die eroberten Gebiete am Ende nichts. Vermeide langwierige Stellungskriege und setze auf kurze, harte Schläge.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Player-Mats und Synergien',
    difficulty: 'Fortgeschritten',
    tags: ['Tableaus', 'Synergien'],
    sort_order: 110,
    content: `
      <ul>
        <li><strong>Wichtiger als die Fraktion:</strong> Die Kombination aus Spieler-Tableau (Mat) und Fraktion prägt deinen Spielplan meist stärker als die Fraktion allein.</li>
        <li><strong>Starke Synergien erkennen:</strong> Analysiere, welche obere Aktion mit welcher unteren Aktion gekoppelt ist.</li>
        <li><strong>Beispiel Move-Fokus:</strong> Wenn "Bewegen" oben an eine starke untere Aktion (z.B. Mechs bauen) gekoppelt ist, solltest du deine Strategie auf häufige Bewegungen auslegen.</li>
        <li><strong>Beispiel Trade-Fokus:</strong> Wenn "Handeln" mit einer starken unteren Aktion verbunden ist, kannst du früh auf den Handel umsteigen und "Produzieren" nur für den Spielstart nutzen.</li>
      </ul>
    `
  },
  {
    game_key: 'scythe',
    title: 'Lernpfad vom Anfänger zum Fortgeschrittenen',
    difficulty: 'Allgemein',
    tags: ['Lernpfad'],
    sort_order: 120,
    content: `
      <h3>Erste Partien</h3>
      <ul>
        <li>Nutze zunächst nur das Grundspiel ohne Erweiterungen.</li>
        <li><strong>Gute Anfängerfraktionen:</strong> Rusviet, Nordic, Polania. Spare dir Crimea und Saxony auf, bis die Kernmechaniken sitzen.</li>
        <li><strong>Fokus:</strong> Versuche, fast immer die obere UND untere Aktion pro Zug auszuführen. Setze das Produzieren nicht zu exzessiv ein.</li>
      </ul>
      <h3>Schritte für High-Level Play</h3>
      <ul>
        <li><strong>Analyse nach dem Spiel:</strong> Welche Sterne waren zu aufwendig? Welche Aktion hast du kaum genutzt?</li>
        <li><strong>Experimentieren:</strong> Teste Spiele mit genau 5 Arbeitern und im Vergleich dazu mit 8 Arbeitern. Beobachte, wie sich das auf deine Strategie auswirkt.</li>
        <li><strong>Öffnungen lernen:</strong> Schaue dir für deine Lieblings-Tableau/Fraktions-Kombination etablierte "Openings" an (z.B. aus der kompetitiven Community), um die ersten 8–10 Züge zu perfektionieren.</li>
      </ul>
    `
  }
];

async function run() {
  try {
    await pb.collection('_superusers').authWithPassword(PB_EMAIL, PB_PASS);
    console.log('✅ Angemeldet als Superuser.');
  } catch (err) {
    try {
      await pb.admins.authWithPassword(PB_EMAIL, PB_PASS);
      console.log('✅ Angemeldet als Admin.');
    } catch (e) {
      console.error('❌ Login fehlgeschlagen:', e.message);
      process.exit(1);
    }
  }

  console.log(`Starte Upload von ${tips.length} Tipps für Scythe...`);

  for (const tip of tips) {
    try {
      // Optional: Check if already exists by title
      const existing = await pb.collection('wiki_tips').getList(1, 1, {
        filter: `game_key = "scythe" && title = "${tip.title}"`
      });

      if (existing.items.length > 0) {
        // Update
        const record = await pb.collection('wiki_tips').update(existing.items[0].id, tip);
        console.log(`✅ Tipp aktualisiert: ${tip.title}`);
      } else {
        // Create
        const record = await pb.collection('wiki_tips').create(tip);
        console.log(`✅ Tipp erstellt: ${tip.title}`);
      }
    } catch (err) {
      console.error(`❌ Fehler bei Tipp "${tip.title}":`, err.message);
    }
  }

  console.log('🎉 Alle Tipps verarbeitet!');
}

run();
