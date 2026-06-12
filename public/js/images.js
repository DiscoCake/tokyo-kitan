// Wikimedia Commons Special:FilePath redirects — server resolves to correct CDN URL,
// no hash-path math needed. onerror in ui.js shows dark gradient if a file 404s.
const W = 'https://commons.wikimedia.org/wiki/Special:FilePath';
const TOKYO_IMAGES = {
  station: `${W}/Shinjuku_station_south_entrance_2012.JPG`,
  night:   `${W}/Kabukicho_2009.jpg`,
  temple:  `${W}/Sensoji_2010.jpg`,
  street:  `${W}/Takeshita-dori,_Harajuku,_Tokyo.jpg`,
  cafe:    `${W}/Doutor_Coffee_Shop_Exterior.jpg`,
  market:  `${W}/Tsukiji_outer_market.jpg`,
  rain:    `${W}/Rainy_Day_Tokyo_(4017805749).jpg`,
  default: `${W}/Kabukicho_2009.jpg`
};

export function pickImage(q) {
  q = (q || '').toLowerCase();
  if (q.includes('station') || q.includes('train') || q.includes('subway')) return TOKYO_IMAGES.station;
  if (q.includes('temple') || q.includes('shrine') || q.includes('asakusa')) return TOKYO_IMAGES.temple;
  if (q.includes('rain')) return TOKYO_IMAGES.rain;
  if (q.includes('market') || q.includes('shop') || q.includes('store')) return TOKYO_IMAGES.market;
  if (q.includes('cafe') || q.includes('coffee') || q.includes('restaurant')) return TOKYO_IMAGES.cafe;
  if (q.includes('night') || q.includes('neon') || q.includes('shinjuku') || q.includes('shibuya')) return TOKYO_IMAGES.night;
  if (q.includes('street') || q.includes('alley') || q.includes('walk')) return TOKYO_IMAGES.street;
  return TOKYO_IMAGES.default;
}
