import React from 'react';

// World Aquatics, February 2026: Part Six, 20.2, 16.2 and Appendix 1.
// https://www.worldaquatics.com/news/3090417/competition-regulations
// The existing shot coordinates span the attacking half of a 25 m field.
const HALF_LENGTH_METRES = 12.5;
const guides = [
  { metres: 2, label: '2 m line', kind: 'two', side: 'left' },
  { metres: 5, label: '5 m · Penalties', kind: 'penalty', side: 'left' },
  { metres: 6, label: '6 m line', kind: 'six', side: 'right' },
  { metres: HALF_LENGTH_METRES, label: 'Halfway · 12.5 m', kind: 'halfway', side: 'left' }
];

const FieldMarkings = () => (
  <div className="wp-field-markings" aria-label="Attacking half: official distance markings for a 25 metre field">
    <div className="wp-field-goal-line" />
    <div className="wp-field-goal" aria-label="Goal" />
    {['left', 'right'].map((side) => (
      <div key={side} className={`wp-field-rope wp-field-rope-${side}`}>
        <div style={{ height: '16%', background: '#ef4444' }} />
        <div style={{ height: '32%', background: '#facc15' }} />
        <div style={{ height: '52%', background: '#65a30d' }} />
      </div>
    ))}
    {guides.map(({ metres, label, kind, side }) => (
      <div
        key={kind}
        data-testid={`field-line-${kind}`}
        className={`wp-field-guide wp-field-guide-${kind}`}
        style={{ top: `${(metres / HALF_LENGTH_METRES) * 100}%` }}
      >
        <span className={`wp-field-guide-label wp-field-label-${side}`}>{label}</span>
      </div>
    ))}
  </div>
);

export default FieldMarkings;
