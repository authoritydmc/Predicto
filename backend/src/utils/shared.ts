/**
 * Shared utilities for the Predictor Manager desktop app
 */

export const getAppMode = () => {
    // First check window.APP_MODE (set by environment variable)
    // @ts-ignore
    if (window.APP_MODE) {
        // @ts-ignore
        return window.APP_MODE;
    }
    // Fall back to URL search params
    const params = new URLSearchParams(window.location.search);
    return params.get('appMode') || 'prod';
};

export const getLocalBaseUrl = () => {
    // @ts-ignore
    return window.OVERLAY_LOCAL_URL || 'http://localhost:5173';
};

export const getProdBaseUrl = () => {
    // @ts-ignore
    return window.OVERLAY_PROD_URL || 'https://vrccim.com';
};

export const getAudienceUrl = (roomId: string, matchId?: string) => {
    const mode = getAppMode();
    const base = mode === 'local' ? getLocalBaseUrl() : getProdBaseUrl();
    // Use matchId if provided (new schema), otherwise fall back to roomId (legacy)
    const id = matchId || roomId;
    return `${base}/match/${id.toLowerCase()}`;
};

export const formatRelativeTime = (timestamp: number | string | any) => {
    if (!timestamp) return 'just now';
    const date = typeof timestamp === 'number' ? timestamp : (typeof timestamp === 'object' && timestamp?.seconds ? timestamp.seconds * 1000 : Date.now());
    const diffMs = Math.max(0, Date.now() - Number(date));
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${Math.floor(diffHour / 24)}d ago`;
};

export const escapeHtml = (v = '') =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const TEAM_COLORS: Record<string, { primary: string, alt: string }> = {
    'csk': { primary: '#FFCB05', alt: '#004BA0' },
    'mi': { primary: '#004BA0', alt: '#D1AB3E' },
    'rcb': { primary: '#EC1C24', alt: '#2B2A29' },
    'kkr': { primary: '#3A225D', alt: '#B3A123' },
    'dc': { primary: '#0078BC', alt: '#EF1B23' },
    'pbks': { primary: '#ED1B24', alt: '#D71920' },
    'rr': { primary: '#E91E63', alt: '#CBA052' }, // Fixed: RR pink color
    'srh': { primary: '#F26522', alt: '#ED1A3B' },
    'lsg': { primary: '#0057E7', alt: '#D1AB3E' },
    'gt': { primary: '#0B4973', alt: '#CBA052' }
};

export const getTeamTheme = (teamName: string) => {
    const key = (teamName || '').toLowerCase().trim();
    return TEAM_COLORS[key] || { primary: '#007AFF', alt: '#5856D6' };
};
