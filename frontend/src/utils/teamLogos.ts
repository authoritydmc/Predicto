// Team Logo Mapping Utility
// Maps team names to their corresponding SVG logo files

export const TEAM_LOGO_MAP: Record<string, string> = {
  'chennai super kings': 'Chennai_Super_Kings.svg',
  'csk': 'Chennai_Super_Kings.svg',
  'delhi capitals': 'Delhi_Capitals.svg',
  'dc': 'Delhi_Capitals.svg',
  'gujarat titans': 'Gujarat_Titans.svg',
  'gt': 'Gujarat_Titans.svg',
  'kolkata knight riders': 'Kolkata_Knight_Riders.svg',
  'kkr': 'Kolkata_Knight_Riders.svg',
  'lucknow super giants': 'Lucknow_Super_Giants.svg',
  'lsg': 'Lucknow_Super_Giants.svg',
  'mumbai indians': 'Mumbai_Indians.svg',
  'mi': 'Mumbai_Indians.svg',
  'punjab kings': 'Punjab_Kings.svg',
  'pbks': 'Punjab_Kings.svg',
  'rajasthan royals': 'Rajasthan_Royals.svg',
  'rr': 'Rajasthan_Royals.svg',
  'royal challengers bengaluru': 'Royal_Challengers_Bengaluru.svg',
  'rcb': 'Royal_Challengers_Bengaluru.svg',
  'sunrisers hyderabad': 'Sunrisers_Hyderabad.svg',
  'srh': 'Sunrisers_Hyderabad.svg',
};

export const getTeamLogo = (teamName: string): string | null => {
  if (!teamName) return null;
  const normalizedName = teamName.toLowerCase().trim();
  return TEAM_LOGO_MAP[normalizedName] || null;
};

export const getTeamLogoUrl = (teamName: string, basePath: string = '/assets/team-logos'): string | null => {
  const logoFile = getTeamLogo(teamName);
  return logoFile ? `${basePath}/${logoFile}` : null;
};
