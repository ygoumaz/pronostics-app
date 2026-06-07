import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Types miroirs des enums Prisma (évite les divergences d'export selon la version du client)
type Phase = 'GROUP' | 'KNOCKOUT';
type Stage =
  | 'GROUP_DAY_1'
  | 'GROUP_DAY_2'
  | 'GROUP_DAY_3'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

const DATA_DIR = join(__dirname, '..', 'data');
const BCRYPT_COST = 12;

// === Types des fichiers de données ===

interface TeamData {
  name: string;
  code: string;
  group: string;
  flagUrl: string;
}

interface MatchData {
  matchNumber: number;
  phase: Phase;
  stage: Stage;
  groupCode?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  kickoffTime: string; // ISO UTC
}

interface PlayerData {
  name: string;
  teamCode: string;
  position: string;
}

function loadJson<T>(fileName: string): T {
  const filePath = join(DATA_DIR, fileName);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

async function seedTeams(teams: TeamData[]): Promise<void> {
  for (const team of teams) {
    await prisma.team.upsert({
      where: { code: team.code },
      update: {
        name: team.name,
        group: team.group,
        flagUrl: team.flagUrl,
      },
      create: {
        name: team.name,
        code: team.code,
        group: team.group,
        flagUrl: team.flagUrl,
      },
    });
  }
  console.log(`  ✓ ${teams.length} équipes insérées/mises à jour`);
}

async function seedMatches(matches: MatchData[]): Promise<void> {
  let groupCount = 0;
  let knockoutCount = 0;

  for (const match of matches) {
    const data = {
      phase: match.phase,
      stage: match.stage,
      groupCode: match.groupCode ?? null,
      homeTeamCode: match.homeTeamCode ?? null,
      awayTeamCode: match.awayTeamCode ?? null,
      homePlaceholder: match.homePlaceholder ?? null,
      awayPlaceholder: match.awayPlaceholder ?? null,
      kickoffTime: new Date(match.kickoffTime),
    };

    await prisma.match.upsert({
      where: { matchNumber: match.matchNumber },
      update: data,
      create: { matchNumber: match.matchNumber, ...data },
    });

    if (match.phase === 'GROUP') groupCount += 1;
    else knockoutCount += 1;
  }
  console.log(
    `  ✓ ${matches.length} matchs insérés/mis à jour (${groupCount} phase de groupes, ${knockoutCount} phase éliminatoire)`,
  );
}

async function seedPlayers(players: PlayerData[]): Promise<void> {
  // Pas de clé unique naturelle sur Player : on réinitialise puis on insère
  // afin de garder l'opération idempotente.
  await prisma.player.deleteMany({});
  await prisma.player.createMany({
    data: players.map((p) => ({
      name: p.name,
      teamCode: p.teamCode,
      position: p.position,
    })),
  });
  console.log(`  ✓ ${players.length} joueurs insérés`);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@pronostics.local';
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Administrateur';
  const password = process.env.ADMIN_PASSWORD ?? 'changeme-admin-2026';

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await prisma.participant.upsert({
    where: { email },
    update: {
      displayName,
      passwordHash,
      isAdmin: true,
    },
    create: {
      email,
      displayName,
      passwordHash,
      isAdmin: true,
    },
  });
  console.log(`  ✓ Participant administrateur configuré (${email})`);
}

async function seedRegistrationStatus(): Promise<void> {
  await prisma.registrationStatus.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', isClosed: false },
  });
  console.log('  ✓ Statut des inscriptions initialisé');
}

async function main(): Promise<void> {
  console.log('🌱 Démarrage du seed...');

  const teams = loadJson<TeamData[]>('teams.json');
  const matches = loadJson<MatchData[]>('matches.json');
  const players = loadJson<PlayerData[]>('players.json');

  await seedTeams(teams);
  await seedMatches(matches);
  await seedPlayers(players);
  await seedAdmin();
  await seedRegistrationStatus();

  console.log('✅ Seed terminé avec succès');
}

main()
  .catch((error) => {
    console.error('❌ Échec du seed :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
