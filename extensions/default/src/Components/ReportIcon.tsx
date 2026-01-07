import React from 'react';

/**
 * Simple "R" icon for Generate Report button
 */
export const ReportIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="currentColor"
      >
        R
      </text>
    </svg>
  );
};

export default ReportIcon;
