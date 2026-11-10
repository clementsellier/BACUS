// Catalogue des actifs suivis. Symboles Yahoo Finance.
// kind : index | stock | reit | macro   —   cur : devise de cotation

export const REGIONS = [
  { id: 'world', label: 'Monde' },
  { id: 'na', label: 'Amérique du Nord' },
  { id: 'eu', label: 'Europe' },
  { id: 'asia', label: 'Asie-Pacifique' },
  { id: 'em', label: 'Émergents' },
];

export const CURRENCIES = [
  { id: 'EUR', label: 'Euro (€)' },
  { id: 'USD', label: 'Dollar US ($)' },
  { id: 'GBP', label: 'Livre sterling (£)' },
  { id: 'CHF', label: 'Franc suisse' },
  { id: 'JPY', label: 'Yen (¥)' },
];

export const PERIODS = [
  { id: '1d', label: '1J', long: 'sur la séance' },
  { id: '5d', label: '1S', long: 'sur 1 semaine' },
  { id: '1mo', label: '1M', long: 'sur 1 mois' },
  { id: '3mo', label: '3M', long: 'sur 3 mois' },
  { id: '1y', label: '1A', long: 'sur 1 an' },
  { id: '5y', label: '5A', long: 'sur 5 ans' },
];

const i = (s, name, region, cur) => ({ id: s, s, name, region, cur, kind: 'index' });
const a = (s, name, region, cur, sector) => ({ id: s, s, name, region, cur, sector, kind: 'stock' });
const r = (s, name, region, cur) => ({ id: s, s, name, region, cur, sector: 'Immobilier', kind: 'reit' });
const m = (s, name, cur, hint) => ({ id: s, s, name, region: 'world', cur, hint, kind: 'macro' });

export const INDICES = [
  i('^GSPC', 'S&P 500', 'na', 'USD'),
  i('^IXIC', 'Nasdaq Composite', 'na', 'USD'),
  i('^DJI', 'Dow Jones', 'na', 'USD'),
  i('^RUT', 'Russell 2000', 'na', 'USD'),
  i('^GSPTSE', 'S&P/TSX (Canada)', 'na', 'CAD'),
  i('^FCHI', 'CAC 40', 'eu', 'EUR'),
  i('^GDAXI', 'DAX', 'eu', 'EUR'),
  i('^FTSE', 'FTSE 100', 'eu', 'GBP'),
  i('^STOXX50E', 'Euro Stoxx 50', 'eu', 'EUR'),
  i('^IBEX', 'IBEX 35', 'eu', 'EUR'),
  i('FTSEMIB.MI', 'FTSE MIB', 'eu', 'EUR'),
  i('^SSMI', 'SMI (Suisse)', 'eu', 'CHF'),
  i('^N225', 'Nikkei 225', 'asia', 'JPY'),
  i('^HSI', 'Hang Seng', 'asia', 'HKD'),
  i('000001.SS', 'Shanghai Composite', 'asia', 'CNY'),
  i('^KS11', 'KOSPI', 'asia', 'KRW'),
  i('^AXJO', 'S&P/ASX 200', 'asia', 'AUD'),
  i('^BSESN', 'Sensex (Inde)', 'em', 'INR'),
  i('^BVSP', 'Bovespa (Brésil)', 'em', 'BRL'),
  i('^MXX', 'IPC (Mexique)', 'em', 'MXN'),
  i('EEM', 'MSCI Émergents (ETF)', 'em', 'USD'),
];

export const STOCKS = [
  a('AAPL', 'Apple', 'na', 'USD', 'Technologie'),
  a('MSFT', 'Microsoft', 'na', 'USD', 'Technologie'),
  a('NVDA', 'Nvidia', 'na', 'USD', 'Technologie'),
  a('GOOGL', 'Alphabet', 'na', 'USD', 'Technologie'),
  a('AMZN', 'Amazon', 'na', 'USD', 'Consommation'),
  a('META', 'Meta', 'na', 'USD', 'Technologie'),
  a('TSLA', 'Tesla', 'na', 'USD', 'Automobile'),
  a('JPM', 'JPMorgan Chase', 'na', 'USD', 'Finance'),
  a('XOM', 'ExxonMobil', 'na', 'USD', 'Énergie'),
  a('LMT', 'Lockheed Martin', 'na', 'USD', 'Défense'),
  a('JNJ', 'Johnson & Johnson', 'na', 'USD', 'Santé'),
  a('MC.PA', 'LVMH', 'eu', 'EUR', 'Luxe'),
  a('OR.PA', "L'Oréal", 'eu', 'EUR', 'Consommation'),
  a('TTE.PA', 'TotalEnergies', 'eu', 'EUR', 'Énergie'),
  a('AIR.PA', 'Airbus', 'eu', 'EUR', 'Défense'),
  a('SAN.PA', 'Sanofi', 'eu', 'EUR', 'Santé'),
  a('BNP.PA', 'BNP Paribas', 'eu', 'EUR', 'Finance'),
  a('HO.PA', 'Thales', 'eu', 'EUR', 'Défense'),
  a('SAP.DE', 'SAP', 'eu', 'EUR', 'Technologie'),
  a('SIE.DE', 'Siemens', 'eu', 'EUR', 'Industrie'),
  a('RHM.DE', 'Rheinmetall', 'eu', 'EUR', 'Défense'),
  a('ASML.AS', 'ASML', 'eu', 'EUR', 'Technologie'),
  a('NESN.SW', 'Nestlé', 'eu', 'CHF', 'Consommation'),
  a('SHEL.L', 'Shell', 'eu', 'GBp', 'Énergie'),
  a('AZN.L', 'AstraZeneca', 'eu', 'GBp', 'Santé'),
  a('7203.T', 'Toyota', 'asia', 'JPY', 'Automobile'),
  a('6758.T', 'Sony', 'asia', 'JPY', 'Technologie'),
  a('005930.KS', 'Samsung Electronics', 'asia', 'KRW', 'Technologie'),
  a('0700.HK', 'Tencent', 'asia', 'HKD', 'Technologie'),
  a('9988.HK', 'Alibaba', 'asia', 'HKD', 'Consommation'),
  a('TSM', 'TSMC (ADR)', 'asia', 'USD', 'Technologie'),
  a('BHP.AX', 'BHP Group', 'asia', 'AUD', 'Matières premières'),
  a('RELIANCE.NS', 'Reliance Industries', 'em', 'INR', 'Énergie'),
  a('INFY', 'Infosys (ADR)', 'em', 'USD', 'Technologie'),
  a('VALE', 'Vale (ADR)', 'em', 'USD', 'Matières premières'),
  a('PBR', 'Petrobras (ADR)', 'em', 'USD', 'Énergie'),
  a('MELI', 'MercadoLibre', 'em', 'USD', 'Consommation'),
];

export const REITS = [
  r('REET', 'Immobilier coté mondial (ETF)', 'world', 'USD'),
  r('VNQ', 'Immobilier coté US (ETF Vanguard)', 'na', 'USD'),
  r('PLD', 'Prologis', 'na', 'USD'),
  r('AMT', 'American Tower', 'na', 'USD'),
  r('O', 'Realty Income', 'na', 'USD'),
  r('SPG', 'Simon Property', 'na', 'USD'),
  r('URW.PA', 'Unibail-Rodamco-Westfield', 'eu', 'EUR'),
  r('GFC.PA', 'Gecina', 'eu', 'EUR'),
  r('LI.PA', 'Klépierre', 'eu', 'EUR'),
  r('VNA.DE', 'Vonovia', 'eu', 'EUR'),
  r('SGRO.L', 'Segro', 'eu', 'GBp'),
  r('8801.T', 'Mitsui Fudosan', 'asia', 'JPY'),
  r('1113.HK', 'CK Asset', 'asia', 'HKD'),
  r('GMG.AX', 'Goodman Group', 'asia', 'AUD'),
  r('C38U.SI', 'CapitaLand Integrated', 'asia', 'SGD'),
];

// Facteurs clés transverses (macro)
export const MACRO = [
  m('^VIX', 'VIX — indice de la peur', null, 'Volatilité attendue du S&P 500. Au-dessus de 25 : marché nerveux.'),
  m('GC=F', 'Or (once)', 'USD', 'Valeur refuge : monte quand la tension géopolitique grimpe.'),
  m('BZ=F', 'Pétrole Brent', 'USD', 'Sensible aux conflits et aux décisions de l’OPEP.'),
  m('^TNX', 'Taux US 10 ans', null, 'Coût de l’argent : pèse sur les actions et l’immobilier.'),
  m('EURUSD=X', 'EUR / USD', null, 'Rapport de force euro-dollar.'),
  m('DX-Y.NYB', 'Indice dollar (DXY)', null, 'Force du dollar face aux grandes devises.'),
];

// Prix de l'immobilier résidentiel — indices BIS (2010 = 100) publiés par FRED, trimestriels.
const h = (cc, name, region) => ({
  id: `Q${cc}N628BIS`, s: `Q${cc}N628BIS`, name, region, cur: null, kind: 'housing', flag: cc,
});
export const HOUSING = [
  h('US', 'États-Unis', 'na'),
  h('CA', 'Canada', 'na'),
  h('FR', 'France', 'eu'),
  h('DE', 'Allemagne', 'eu'),
  h('GB', 'Royaume-Uni', 'eu'),
  h('ES', 'Espagne', 'eu'),
  h('IT', 'Italie', 'eu'),
  h('CH', 'Suisse', 'eu'),
  h('JP', 'Japon', 'asia'),
  h('KR', 'Corée du Sud', 'asia'),
  h('AU', 'Australie', 'asia'),
  h('CN', 'Chine', 'em'),
  h('IN', 'Inde', 'em'),
  h('BR', 'Brésil', 'em'),
  h('MX', 'Mexique', 'em'),
  h('ZA', 'Afrique du Sud', 'em'),
];

export const inRegion = (list, region) =>
  region === 'world' ? list : list.filter((x) => x.region === region || x.region === 'world');

export const flagEmoji = (cc) =>
  String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
