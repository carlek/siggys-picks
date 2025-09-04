
export const teamColors: { [key: string]: string } = {
  'Boston Bruins': '#FFB81C',
  'Buffalo Sabres': '#002654',
  'Detroit Red Wings': '#CE1126',
  'Florida Panthers': '#C8102E',
  'Montréal Canadiens': '#AF1E2D',
  'Ottawa Senators': '#C52032',
  'Tampa Bay Lightning': '#002868',
  'Toronto Maple Leafs': '#00205B',
  'Carolina Hurricanes': '#CC0000',
  'Columbus Blue Jackets': '#002654',
  'New Jersey Devils': '#CE1126',
  'New York Islanders': '#00539B',
  'New York Rangers': '#0038A8',
  'Philadelphia Flyers': '#F74902',
  'Pittsburgh Penguins': '#FCB514',
  'Washington Capitals': '#C8102E',
  'Chicago Blackhawks': '#CF0A2C',
  'Colorado Avalanche': '#6F263D',
  'Dallas Stars': '#006847',
  'Minnesota Wild': '#154734',
  'Nashville Predators': '#FFB81C',
  'St. Louis Blues': '#002F87',
  'Winnipeg Jets': '#041E42',
  'Anaheim Ducks': '#F47A38',
  'Arizona Coyotes': '#8C2633',
  'Calgary Flames': '#C8102E',
  'Edmonton Oilers': '#FF4C00',
  'Los Angeles Kings': '#111111',
  'San Jose Sharks': '#006D75',
  'Seattle Kraken': '#001628',
  'Vancouver Canucks': '#00205B',
  'Vegas Golden Knights': '#B4975A',
};

export const getTeamCity = (teamName: string) => {
  if (!teamName) return 'Unknown';
  const parts = teamName.split(' ');
  if (parts.length <= 1) return teamName;
  if (parts.length > 2) {
    if (['New', 'Tampa', 'St.', 'San', 'Los'].includes(parts[0])) {
      return `${parts[0]} ${parts[1]}`;
    }
  }
  return parts.slice(0, -1).join(' ');
};

export const getTeamName = (teamName: string) => {
  if (!teamName) return 'Team';
  const parts = teamName.split(' ');
  return parts[parts.length - 1];
};
