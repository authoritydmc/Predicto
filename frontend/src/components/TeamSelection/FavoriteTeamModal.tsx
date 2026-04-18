export default function FavoriteTeamModal({ onSelectTeam }: { onSelectTeam: (team: string) => void }) {
  const teams = ["CSK", "MI", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "LSG", "GT"];

  return (
    <div className="modal-overlay">
      <div className="modal-content team-selector-modal">
        <div className="modal-header">
          <h2>Choose Your Favorite Team</h2>
          <p>Select your favorite IPL team (one-time choice)</p>
        </div>
        <div className="team-grid">
          {teams.map((team) => (
            <button 
              key={team} 
              className="team-btn" 
              onClick={() => onSelectTeam(team)}
            >
              {team}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
