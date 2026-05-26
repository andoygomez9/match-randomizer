export type Player = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  playerIds: [string, string];
  playerNames: [string, string];
};

export type DoublesMatch = {
  id: string;
  teamA: Team;
  teamB: Team | null;
  result: 'A' | 'B' | null;
};

export type MatchRound = {
  id: string;
  createdAt: string;
  matches: DoublesMatch[];
  repeatScore: number;
};

const STORAGE_PLAYERS_KEY = 'pickleball.players';
const STORAGE_ROUNDS_KEY = 'pickleball.rounds';

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function makeTeam(playerA: Player, playerB: Player): Team {
  return {
    id: [playerA.id, playerB.id].sort().join('::'),
    playerIds: [playerA.id, playerB.id],
    playerNames: [playerA.name, playerB.name],
  };
}

function getMatchKey(teamA: Team, teamB: Team): string {
  return [teamA.id, teamB.id].sort().join('::');
}

function createPartnerCountMap(rounds: MatchRound[]) {
  const counts: Record<string, number> = {};

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      [match.teamA, match.teamB].forEach((team) => {
        if (!team) return;
        const pairKey = [team.playerIds[0], team.playerIds[1]].sort().join('::');
        counts[pairKey] = (counts[pairKey] ?? 0) + 1;
      });
    });
  });

  return counts;
}

function createMatchCountMap(rounds: MatchRound[]) {
  const counts: Record<string, number> = {};

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.teamB) {
        const key = getMatchKey(match.teamA, match.teamB);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
  });

  return counts;
}

function buildTeams(players: Player[], partnerCounts: Record<string, number>) {
  if (players.length % 2 !== 0) {
    throw new Error('An even number of players is required for doubles.');
  }

  const remaining = shuffle(players);
  const teams: Team[] = [];

  while (remaining.length >= 2) {
    const playerA = remaining.shift() as Player;
    let bestIndex = 0;
    let bestScore: number | null = null;

    for (let i = 0; i < remaining.length; i += 1) {
      const playerB = remaining[i];
      const pairKey = [playerA.id, playerB.id].sort().join('::');
      const score = partnerCounts[pairKey] ?? 0;
      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const playerB = remaining.splice(bestIndex, 1)[0];
    teams.push(makeTeam(playerA, playerB));
  }

  return teams;
}

function buildMatches(teams: Team[], counts: Record<string, number>) {
  const remaining = [...teams];
  const matches: DoublesMatch[] = [];

  while (remaining.length > 1) {
    const teamA = remaining.shift() as Team;
    let bestIndex = 0;
    let bestScore: number | null = null;

    for (let i = 0; i < remaining.length; i += 1) {
      const teamB = remaining[i];
      const key = getMatchKey(teamA, teamB);
      const score = counts[key] ?? 0;
      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const teamB = remaining.splice(bestIndex, 1)[0];
    matches.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      teamA,
      teamB,
      result: null,
    });
  }

  if (remaining.length === 1) {
    matches.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      teamA: remaining[0],
      teamB: null,
      result: 'A',
    });
  }

  return matches;
}

function scoreMatches(matches: DoublesMatch[], counts: Record<string, number>) {
  return matches.reduce((sum, match) => {
    if (!match.teamB) {
      return sum;
    }
    const key = getMatchKey(match.teamA, match.teamB);
    return sum + (counts[key] ?? 0);
  }, 0);
}

function buildNextRound(teams: Team[], previousRounds: MatchRound[]) {
  const counts = createMatchCountMap(previousRounds);
  const matches = buildMatches(teams, counts);
  const repeatScore = scoreMatches(matches, counts);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    matches,
    repeatScore,
  };
}

function extractPlayersFromTeam(team: Team): Player[] {
  return [
    { id: team.playerIds[0], name: team.playerNames[0] },
    { id: team.playerIds[1], name: team.playerNames[1] },
  ];
}

export function isRoundComplete(round: MatchRound) {
  return round.matches.every((match) => match.result !== null);
}

export function generateFirstRound(players: Player[], previousRounds: MatchRound[]) {
  if (players.length < 4) {
    throw new Error('At least 4 players are required for doubles matches.');
  }
  if (players.length % 2 !== 0) {
    throw new Error('Please add an even number of players for doubles.');
  }

  const partnerCounts = createPartnerCountMap(previousRounds);
  const teams = buildTeams(players, partnerCounts);
  return buildNextRound(teams, previousRounds);
}

export function generateNextRound(lastRound: MatchRound, previousRounds: MatchRound[]) {
  if (!isRoundComplete(lastRound)) {
    throw new Error('Finish recording the previous round before generating the next one.');
  }

  const winners: Player[] = [];
  const losers: Player[] = [];

  lastRound.matches.forEach((match) => {
    if (!match.teamB) {
      winners.push(...extractPlayersFromTeam(match.teamA));
      return;
    }

    if (match.result === 'A') {
      winners.push(...extractPlayersFromTeam(match.teamA));
      losers.push(...extractPlayersFromTeam(match.teamB));
    } else if (match.result === 'B') {
      winners.push(...extractPlayersFromTeam(match.teamB));
      losers.push(...extractPlayersFromTeam(match.teamA));
    }
  });

  if (winners.length % 2 !== 0 || losers.length % 2 !== 0) {
    throw new Error('Winner and loser groups must have an even number of players for doubles.');
  }

  const partnerCounts = createPartnerCountMap(previousRounds);
  const winnerTeams = buildTeams(winners, partnerCounts);
  const loserTeams = buildTeams(losers, partnerCounts);

  const winnerRound = buildNextRound(winnerTeams, previousRounds);
  const loserRound = buildNextRound(loserTeams, previousRounds);

  return {
    ...winnerRound,
    matches: [...winnerRound.matches, ...loserRound.matches],
    repeatScore: winnerRound.repeatScore + loserRound.repeatScore,
  };
}

export function generateRound(players: Player[], previousRounds: MatchRound[]) {
  if (previousRounds.length === 0) {
    return generateFirstRound(players, previousRounds);
  }

  return generateNextRound(previousRounds[0], previousRounds);
}

export function loadPlayers(): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_PLAYERS_KEY);
    return stored ? (JSON.parse(stored) as Player[]) : [];
  } catch {
    return [];
  }
}

export function loadRounds(): MatchRound[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_ROUNDS_KEY);
    return stored ? (JSON.parse(stored) as MatchRound[]) : [];
  } catch {
    return [];
  }
}

export function savePlayers(players: Player[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(players));
}

export function saveRounds(rounds: MatchRound[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_ROUNDS_KEY, JSON.stringify(rounds));
}

export type PlayerStanding = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  played: number;
};

export function computeStandings(rounds: MatchRound[]): PlayerStanding[] {
  const map: Record<string, PlayerStanding> = {};

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      // Bye: teamA advances and counts as a win
      if (!match.teamB) {
        match.teamA.playerIds.forEach((pid, idx) => {
          const name = match.teamA.playerNames[idx];
          if (!map[pid]) map[pid] = { playerId: pid, name, wins: 0, losses: 0, played: 0 };
          map[pid].wins += 1;
          map[pid].played += 1;
        });
        return;
      }

      if (match.result === null) return; // skip unfinished

      const winners = match.result === 'A' ? match.teamA : match.teamB!;
      const losers = match.result === 'A' ? match.teamB! : match.teamA;

      winners.playerIds.forEach((pid, idx) => {
        const name = winners.playerNames[idx];
        if (!map[pid]) map[pid] = { playerId: pid, name, wins: 0, losses: 0, played: 0 };
        map[pid].wins += 1;
        map[pid].played += 1;
      });

      losers.playerIds.forEach((pid, idx) => {
        const name = losers.playerNames[idx];
        if (!map[pid]) map[pid] = { playerId: pid, name, wins: 0, losses: 0, played: 0 };
        map[pid].losses += 1;
        map[pid].played += 1;
      });
    });
  });

  return Object.values(map).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.played - a.played;
  });
}
