export interface Campus {
  id: string;
  name: string;
  city: string;
  short: string;
  buildings: string[];
}

// Blink launches at UNL only.
export const CAMPUSES: Campus[] = [
  {
    id: 'unl',
    name: 'University of Nebraska–Lincoln',
    city: 'Lincoln',
    short: 'UNL',
    buildings: [
      'Abel Hall',
      'Sandoz Hall',
      'Schramm Hall',
      'Smith Hall',
      'Harper Hall',
      'Selleck Quadrangle',
      'Knoll Residential Center',
      'University Suites',
      'Eastside Suites',
      'The Village',
      'Nebraska Union',
      'Love Library',
      'Kauffman Center',
      'Neihardt Hall',
      'Cather Dining',
      'Greek Row',
    ],
  },
];

export const UNL = CAMPUSES[0];

export function campusById(id: string): Campus {
  return CAMPUSES.find((c) => c.id === id) ?? CAMPUSES[0];
}
