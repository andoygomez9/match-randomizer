import { useEffect, useMemo, useState } from 'react';
import {
  generateFirstRound,
  generateNextRound,
  isRoundComplete,
  loadPlayers,
  loadRounds,
  Player,
  savePlayers,
  saveRounds,
  Team,
  MatchRound,
} from './utils/pairing';
import { computeStandings } from './utils/pairing';

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString));
}

function teamLabel(team: Team) {
  return `${team.playerNames[0]} / ${team.playerNames[1]}`;
}

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<MatchRound[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPlayers(loadPlayers());
    setRounds(loadRounds());
  }, []);

  useEffect(() => {
    savePlayers(players);
  }, [players]);

  useEffect(() => {
    saveRounds(rounds);
  }, [rounds]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  const lastRound = rounds[0] ?? null;
  const lastRoundComplete = lastRound ? isRoundComplete(lastRound) : false;
  const canGenerateFirstRound = players.length >= 4 && players.length % 2 === 0;

  const standings = useMemo(() => computeStandings(rounds), [rounds]);

  const handleAddPlayer = () => {
    const name = nameInput.trim();
    if (!name) {
      setError('Please enter a player name.');
      return;
    }

    if (players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      setError('Player already exists.');
      return;
    }

    setPlayers((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name },
    ]);
    setNameInput('');
    setError('');
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((current) => current.filter((player) => player.id !== id));
  };

  const handleGenerateFirstRound = () => {
    try {
      const round = generateFirstRound(players, rounds);
      setRounds((current) => [round, ...current]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate first round.');
    }
  };

  const handleGenerateNextRound = () => {
    if (!lastRound) return;
    try {
      const nextRound = generateNextRound(lastRound, rounds);
      setRounds((current) => [nextRound, ...current]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate next round.');
    }
  };

  const handleResultChange = (matchId: string, result: 'A' | 'B') => {
    if (!lastRound) return;
    setRounds((current) =>
      current.map((round, index) => {
        if (index !== 0) return round;
        return {
          ...round,
          matches: round.matches.map((match) =>
            match.id === matchId ? { ...match, result } : match
          ),
        };
      })
    );
  };

  const nextRoundAction = () => {
    if (rounds.length === 0) {
      handleGenerateFirstRound();
    } else if (lastRoundComplete) {
      handleGenerateNextRound();
    }
  };

  const nextRoundDisabled = rounds.length > 0 && !lastRoundComplete;

  const handleResetAll = () => {
    if (!window.confirm('Reset all players and rounds? This cannot be undone.')) return;
    setPlayers([]);
    setRounds([]);
    savePlayers([]);
    saveRounds([]);
    setError('');
  };

  const handleExportCSV = () => {
    const standings = computeStandings(rounds);
    if (standings.length === 0) {
      setError('No standings to export.');
      return;
    }

    const header = ['Player', 'Played', 'Wins', 'Losses'];
    const rows = standings.map((s) => [s.name, String(s.played), String(s.wins), String(s.losses)]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'standings.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Pickleball Doubles Match Randomizer</h1>
        <p>Encode all players, generate doubles matches, and advance winners against winners.</p>
      </header>

      <section className="panel">
        <h2>Standings</h2>
        {standings.length > 0 ? (
          <table className="standings-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Played</th>
                <th>Wins</th>
                <th>Losses</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr key={s.playerId}>
                  <td>{s.name}</td>
                  <td>{s.played}</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No completed matches yet.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-row">
          <label htmlFor="playerName">Player name</label>
          <div className="input-row">
            <input
              id="playerName"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Add a player"
            />
            <button type="button" onClick={handleAddPlayer}>
              Add
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="panel-row">
          <h2>Players ({players.length})</h2>
          <ul className="player-list">
            {sortedPlayers.map((player) => (
              <li key={player.id}>
                <span>{player.name}</span>
                <button type="button" onClick={() => handleRemovePlayer(player.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-row action-row">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={nextRoundAction} disabled={!canGenerateFirstRound || nextRoundDisabled}>
              {rounds.length === 0 ? 'Generate First Round' : 'Generate Next Round'}
            </button>
            <button type="button" className="secondary" onClick={handleExportCSV}>
              Export Standings CSV
            </button>
            <button type="button" className="secondary" onClick={handleResetAll}>
              Reset All
            </button>
          </div>
          <span className="hint">
            {rounds.length === 0
              ? 'Add at least 4 players and use an even count for doubles.'
              : lastRoundComplete
              ? 'Ready for the next round.'
              : 'Record all match winners before generating the next round.'}
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>Latest Round</h2>
        {lastRound ? (
          <div className="round-card">
            <div className="round-header">
              <span>{formatDate(lastRound.createdAt)}</span>
              <span>Repeat score: {lastRound.repeatScore}</span>
            </div>
            <ol className="pair-list">
              {lastRound.matches.map((match) => (
                <li key={match.id}>
                  <div>
                    <span className="team-label">{teamLabel(match.teamA)}</span>
                    <strong>vs.</strong>
                    <span className="team-label">
                      {match.teamB ? teamLabel(match.teamB) : 'Bye'}
                    </span>
                  </div>
                  <div className="result-buttons">
                    {match.teamB ? (
                      <>
                        <button
                          type="button"
                          className={match.result === 'A' ? 'selected' : ''}
                          onClick={() => handleResultChange(match.id, 'A')}
                        >
                          Winner: Team A
                        </button>
                        <button
                          type="button"
                          className={match.result === 'B' ? 'selected' : ''}
                          onClick={() => handleResultChange(match.id, 'B')}
                        >
                          Winner: Team B
                        </button>
                      </>
                    ) : (
                      <span className="bye-text">Team A advances by bye</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p>No rounds generated yet.</p>
        )}
      </section>
      

      <section className="panel">
        <h2>Round History</h2>
        {rounds.length > 0 ? (
          <div className="history-grid">
            {rounds.map((round) => (
              <article key={round.id} className="round-card summary-card">
                <div className="round-header">
                  <span>{formatDate(round.createdAt)}</span>
                  <span>Score: {round.repeatScore}</span>
                </div>
                <ol>
                  {round.matches.map((match) => (
                    <li key={match.id}>
                      <strong>{teamLabel(match.teamA)}</strong> vs. <strong>{match.teamB ? teamLabel(match.teamB) : 'Bye'}</strong>
                      {match.teamB && match.result ? (
                        <span> — Winner: {match.result === 'A' ? 'Team A' : 'Team B'}</span>
                      ) : match.teamB === null ? (
                        <span> — Advanced by bye</span>
                      ) : (
                        <span> — Pending</span>
                      )}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <p>Generate a round to start tracking history.</p>
        )}
      </section>
    </div>
  );
}

export default App;
