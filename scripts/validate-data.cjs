const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const teams = JSON.parse(fs.readFileSync(path.join(root, 'data', 'teams.json'), 'utf8'));
const matches = JSON.parse(fs.readFileSync(path.join(root, 'data', 'matches.json'), 'utf8'));
const players = JSON.parse(fs.readFileSync(path.join(root, 'data', 'players.json'), 'utf8'));

const errors = [];
const warns = [];

// ---- TEAMS ----
if (teams.length !== 48) errors.push(`teams: expected 48, got ${teams.length}`);
const groups = {};
const teamCodes = new Set();
const teamNames = new Set();
const validGroups = 'ABCDEFGHIJKL'.split('');
for (const t of teams) {
  if (!t.name || !t.code || !t.group || !t.flagUrl) errors.push(`team missing field: ${JSON.stringify(t)}`);
  if (!/^[A-Z]{3}$/.test(t.code)) errors.push(`team bad code: ${t.code}`);
  if (!validGroups.includes(t.group)) errors.push(`team bad group: ${t.group}`);
  if (teamCodes.has(t.code)) errors.push(`duplicate team code: ${t.code}`);
  if (teamNames.has(t.name)) errors.push(`duplicate team name: ${t.name}`);
  teamCodes.add(t.code);
  teamNames.add(t.name);
  groups[t.group] = (groups[t.group] || 0) + 1;
}
for (const g of validGroups) {
  if (groups[g] !== 4) errors.push(`group ${g} has ${groups[g] || 0} teams (expected 4)`);
}

// ---- MATCHES ----
if (matches.length !== 104) warns.push(`matches: expected 104 (48-team format), got ${matches.length}`);
const matchNums = new Set();
const groupMatchCounts = {};       // per group, count of group-stage matches
const groupPairings = {};          // per group, set of "A-B" pairs
const stageCounts = {};
const validStages = ['GROUP_DAY_1','GROUP_DAY_2','GROUP_DAY_3','ROUND_OF_32','ROUND_OF_16','QUARTER_FINAL','SEMI_FINAL','THIRD_PLACE','FINAL'];

for (const m of matches) {
  if (typeof m.matchNumber !== 'number') errors.push(`match missing matchNumber: ${JSON.stringify(m)}`);
  if (matchNums.has(m.matchNumber)) errors.push(`duplicate matchNumber: ${m.matchNumber}`);
  matchNums.add(m.matchNumber);
  if (!['GROUP','KNOCKOUT'].includes(m.phase)) errors.push(`bad phase M${m.matchNumber}: ${m.phase}`);
  if (!validStages.includes(m.stage)) errors.push(`bad stage M${m.matchNumber}: ${m.stage}`);
  stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1;

  // kickoff valid ISO + UTC (ends with Z)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(m.kickoffTime)) {
    errors.push(`bad kickoffTime M${m.matchNumber}: ${m.kickoffTime}`);
  } else if (isNaN(Date.parse(m.kickoffTime))) {
    errors.push(`unparseable kickoffTime M${m.matchNumber}: ${m.kickoffTime}`);
  }

  if (m.phase === 'GROUP') {
    if (!m.groupCode || !validGroups.includes(m.groupCode)) errors.push(`group match bad groupCode M${m.matchNumber}: ${m.groupCode}`);
    if (!teamCodes.has(m.homeTeamCode)) errors.push(`M${m.matchNumber} unknown homeTeamCode: ${m.homeTeamCode}`);
    if (!teamCodes.has(m.awayTeamCode)) errors.push(`M${m.matchNumber} unknown awayTeamCode: ${m.awayTeamCode}`);
    // teams belong to the stated group
    const ht = teams.find(t => t.code === m.homeTeamCode);
    const at = teams.find(t => t.code === m.awayTeamCode);
    if (ht && ht.group !== m.groupCode) errors.push(`M${m.matchNumber} home ${m.homeTeamCode} in group ${ht.group} not ${m.groupCode}`);
    if (at && at.group !== m.groupCode) errors.push(`M${m.matchNumber} away ${m.awayTeamCode} in group ${at.group} not ${m.groupCode}`);
    groupMatchCounts[m.groupCode] = (groupMatchCounts[m.groupCode] || 0) + 1;
    const pair = [m.homeTeamCode, m.awayTeamCode].sort().join('-');
    groupPairings[m.groupCode] = groupPairings[m.groupCode] || new Set();
    if (groupPairings[m.groupCode].has(pair)) errors.push(`group ${m.groupCode} duplicate pairing: ${pair}`);
    groupPairings[m.groupCode].add(pair);
  } else {
    if (!m.homePlaceholder || !m.awayPlaceholder) errors.push(`knockout M${m.matchNumber} missing placeholder`);
  }
}

// each group: 6 matches (round robin of 4), each team plays 3
for (const g of validGroups) {
  if (groupMatchCounts[g] !== 6) errors.push(`group ${g} has ${groupMatchCounts[g] || 0} group matches (expected 6)`);
}
// per-team group-match appearances == 3
const appearances = {};
for (const m of matches) {
  if (m.phase === 'GROUP') {
    appearances[m.homeTeamCode] = (appearances[m.homeTeamCode] || 0) + 1;
    appearances[m.awayTeamCode] = (appearances[m.awayTeamCode] || 0) + 1;
  }
}
for (const code of teamCodes) {
  if (appearances[code] !== 3) errors.push(`team ${code} appears in ${appearances[code] || 0} group matches (expected 3)`);
}

// matchNumber contiguity 1..N
for (let i = 1; i <= matches.length; i++) {
  if (!matchNums.has(i)) errors.push(`missing matchNumber ${i}`);
}

// ---- PLAYERS vs TEAMS ----
const playerTeamCodes = new Set(players.map(p => p.teamCode));
for (const code of playerTeamCodes) {
  if (!teamCodes.has(code)) errors.push(`player teamCode not in teams.json: ${code}`);
}
for (const code of teamCodes) {
  if (!playerTeamCodes.has(code)) errors.push(`team ${code} has no players`);
}

// ---- REPORT ----
console.log('=== TEAMS ===');
console.log('count:', teams.length);
console.log('groups:', JSON.stringify(groups));
console.log('=== MATCHES ===');
console.log('count:', matches.length);
console.log('stageCounts:', JSON.stringify(stageCounts));
console.log('groupMatchCounts:', JSON.stringify(groupMatchCounts));
console.log('=== PLAYERS ===');
console.log('count:', players.length, 'teamCodes:', playerTeamCodes.size);

console.log('\n=== WARNINGS (' + warns.length + ') ===');
warns.forEach(w => console.log('  ! ' + w));
console.log('\n=== ERRORS (' + errors.length + ') ===');
errors.forEach(e => console.log('  X ' + e));

if (errors.length === 0) console.log('\nALL VALIDATIONS PASSED');
process.exit(errors.length === 0 ? 0 : 1);
