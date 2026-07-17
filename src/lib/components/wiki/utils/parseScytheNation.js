// @ts-check

/**
 * @typedef {{ name: string, text: string }} ScytheNationAbility
 * @typedef {{
 *   color: string,
 *   leader: string,
 *   nationalAbility: ScytheNationAbility,
 *   mechAbilitiesNote: string,
 *   mechAbilities: ScytheNationAbility[]
 * }} ParsedScytheNation
 */

/**
 * Parst die Scythe-Nationen-`summary` (Effekt-Konvention aus dem Extraktions-Plan:
 * "**Farbe**: X · **Anführer**: Y\n**Nationalfähigkeit — Name**: Text\n\n
 * **Mech-Fähigkeiten** (Hinweis):\n**Name** — Text\n…") in ihre Bestandteile,
 * damit sie als strukturierter Stat-Block statt als Fließtext dargestellt werden kann.
 * Gibt `null` zurück, wenn der Text nicht exakt diesem Schema folgt — der Aufrufer
 * soll dann auf die generische Markdown-Darstellung zurückfallen.
 * @param {string} summary
 * @returns {ParsedScytheNation | null}
 */
export function parseScytheNationSummary(summary) {
  if (!summary) return null;

  const blocks = summary.split('\n\n').map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 2) return null;

  const headLines = blocks[0].split('\n').map((l) => l.trim()).filter(Boolean);
  if (headLines.length < 2) return null;

  const colorLeaderMatch = headLines[0].match(/\*\*Farbe\*\*:\s*([^·]+?)\s*·\s*\*\*Anführer\*\*:\s*(.+)/);
  if (!colorLeaderMatch) return null;

  const nationalMatch = headLines[1].match(/\*\*Nationalfähigkeit\s*—\s*(.+?)\*\*:\s*(.+)/);
  if (!nationalMatch) return null;

  const mechBlock = blocks.find((b) => b.startsWith('**Mech-Fähigkeiten**'));
  if (!mechBlock) return null;

  const mechLines = mechBlock.split('\n').map((l) => l.trim()).filter(Boolean);
  const noteMatch = mechLines[0].match(/\*\*Mech-Fähigkeiten\*\*\s*\((.+?)\)/);

  /** @type {ScytheNationAbility[]} */
  const mechAbilities = [];
  for (const line of mechLines.slice(1)) {
    const abilityMatch = line.match(/\*\*(.+?)\*\*\s*—\s*(.+)/);
    if (!abilityMatch) return null;
    mechAbilities.push({ name: abilityMatch[1].trim(), text: abilityMatch[2].trim() });
  }
  if (mechAbilities.length === 0) return null;

  return {
    color: colorLeaderMatch[1].trim(),
    leader: colorLeaderMatch[2].trim(),
    nationalAbility: { name: nationalMatch[1].trim(), text: nationalMatch[2].trim() },
    mechAbilitiesNote: noteMatch ? noteMatch[1].trim() : '',
    mechAbilities
  };
}
