export const C = {
  bg: '#0B0A1F',
  bg2: '#16133A',
  surface: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  muted: '#A9A5C8',
  lilac: '#C9A7FF',
  pink: '#F3B5E3',
  hot: '#F06BB0',
  purple: '#7B5CFF',
  ink: '#1A1033',
  inkMuted: '#6E6890',
  card: '#FFFFFF',
  cardSoft: '#F5F2FF',
  green: '#3BC48A',
  danger: '#E5484D',
};

export const GRADIENT = [C.lilac, C.pink] as const;
export const NIGHT = ['#2A1E5C', '#0B0A1F'] as const;

export const SIGN_EMOJI: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};
