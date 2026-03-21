import { Ad, MatchStatus } from '../types';

export const getMatchKey = (offer: Ad, demand: Ad) => 
  `${offer.url || offer.id}__${demand.url || demand.id}`;

export const statusLabel: Record<MatchStatus, string> = {
  new: 'Nové',
  review: 'Prověřit',
  contacted: 'Kontaktováno',
  negotiation: 'Vyjednávání',
  closed: 'Uzavřeno',
};
