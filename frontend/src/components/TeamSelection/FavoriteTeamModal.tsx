import { getTeamLogoUrl } from '../../utils/teamLogos';

interface FavoriteTeamModalProps {
  onSelectTeam: (team: string) => void;
  teamChangeCount?: number;
}

export default function FavoriteTeamModal({ onSelectTeam, teamChangeCount = 0 }: FavoriteTeamModalProps) {
  const teams = ["CSK", "MI", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "LSG", "GT"];
  const remainingChanges = 3 - teamChangeCount;

  return (
    <div className="modal-overlay">
      <div className="modal-content team-selector-modal">
        <div className="modal-header">
          <h2>Choose Your Favorite Team</h2>
          <p>
            {teamChangeCount === 0 
              ? "Select your favorite IPL team (you can change it up to 3 times)"
              : `Select your favorite IPL team (${remainingChanges} change${remainingChanges !== 1 ? 's' : ''} remaining)`
            }
          </p>
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
