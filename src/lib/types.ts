// Shared types for financial events

export interface IPOEvent {
  type: 'ipo';
  symbol: string;
  name: string;
  date: string;
  price: number | null;
  shares: number | null;
  exchange: string;
  status: 'expected' | 'priced' | 'filed' | 'withdrawn';
}

export interface DividendEvent {
  type: 'dividend';
  symbol: string;
  name: string;
  exDate: string;
  payDate: string | null;
  amount: number;
  frequency: 'annual' | 'quarterly' | 'monthly' | 'special';
}

export interface PriceMoverEvent {
  type: 'price_mover';
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  direction: 'up' | 'down';
}

export type FinancialEvent = IPOEvent | DividendEvent | PriceMoverEvent;

export interface FinancialEventsResponse {
  ipos: IPOEvent[];
  dividends: DividendEvent[];
  movers: PriceMoverEvent[];
  lastUpdated: number;
  gaps: string[];
}

export interface AlertDispatchRequest {
  events: FinancialEvent[];
  secret: string;
}
