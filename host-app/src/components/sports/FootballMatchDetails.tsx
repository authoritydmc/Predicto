import React from 'react';

interface FootballMatchDetailsProps {
  fTeamA: string;
  fTeamB: string;
}

export const FootballMatchDetails: React.FC<FootballMatchDetailsProps> = ({
  fTeamA,
  fTeamB,
}) => {
  return (
    <div className="cp-form-row">
      <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
        Football match details configured. No sport-specific settings required.
      </p>
    </div>
  );
};
