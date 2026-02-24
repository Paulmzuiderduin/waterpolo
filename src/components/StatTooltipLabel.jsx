import React from 'react';

const StatTooltipLabel = ({ label, tooltip, enabled }) => {
  if (!enabled || !tooltip) return <span>{label}</span>;
  return (
    <span className="stat-label" tabIndex={0}>
      {label}
      <span className="stat-info" aria-hidden="true">
        i
      </span>
      <span role="tooltip" className="stat-tooltip">
        {tooltip}
      </span>
    </span>
  );
};

export default StatTooltipLabel;

