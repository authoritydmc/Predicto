import { getTeamLogoUrl } from '../../utils/teamLogos';

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
          {teams.map((team) => {
            const logoUrl = getTeamLogoUrl(team);
            return (
              <button 
                key={team} 
                className="team-btn" 
                onClick={() => onSelectTeam(team)}
              >
                {logoUrl && (
                  <img 
                    src={logoUrl} 
                    alt={team} 
                    className="team-logo"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="team-name">{team}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
