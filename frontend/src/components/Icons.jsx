import React from 'react';

/**
 * Premium Neon Pulse Icon Design System
 * Features:
 * - Consistent strokeWidth (1.5)
 * - Integrated pulse/heartbeat lines
 * - Sophisticated iconography
 * - Glow-ready path definitions
 */

const baseSvgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "neon-svg"
};

/**
 * Logo / Home Pulse
 */
export const IconPulse = () => (
    <svg {...baseSvgProps}>
        <path d="M2 12h3l2-6 3 12 3-9 2 3h7" />
    </svg>
);

/**
 * Upload / Drop Zone (Pulse + Arrow)
 */
export const IconUpload = () => (
    <svg {...baseSvgProps}>
        <path d="M5 15v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" opacity="0.4" />
        <path d="M15 8l-3-3l-3 3M12 5v8" />
    </svg>
);

/**
 * Dashboard / Results (Pulse + Report)
 */
export const IconResults = () => (
    <svg {...baseSvgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" opacity="0.6" />
    </svg>
);

/**
 * Match Score (Pulse + Gauge)
 */
export const IconScore = () => (
    <svg {...baseSvgProps}>
        <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" opacity="0.3" />
        <path d="M12 12l3-3" />
        <path d="M20 12l2 2M2 12l2-2M12 2l2 2M12 22l-2-2" opacity="0.5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
);

/**
 * Skills / Network (Pulse + Nodes)
 */
export const IconSkills = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <circle cx="5" cy="5" r="2" />
        <path d="M12 9V5M12 15v4M9 12H5M15 12h4" opacity="0.6" />
    </svg>
);

/**
 * Roadmap / Timeline (Pulse + Flags)
 */
export const IconRoadmap = () => (
    <svg {...baseSvgProps}>
        <path d="M2 12h3l2-6 4 11 2-5h9" opacity="0.3" />
        <path d="M4 20v-7M4 13l5-2l5 2l6-2v7l-6 2l-5-2l-5 2z" />
    </svg>
);

/**
 * Scout / Job Search (Pulse + Magnifier)
 */
export const IconScout = () => (
    <svg {...baseSvgProps}>
        <path d="M2 12h3l2-4 4 10 2-6h9" opacity="0.3" />
        <circle cx="11" cy="11" r="5" />
        <path d="M15 15l4 4" />
    </svg>
);

/**
 * Alert / Gaps (Pulse + Warning)
 */
export const IconAlert = () => (
    <svg {...baseSvgProps}>
        <path d="M12 8v4M12 16h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" opacity="0.4" />
    </svg>
);

/**
 * Check / Success (Pulse + Check)
 */
export const IconCheck = () => (
    <svg {...baseSvgProps}>
        <path d="M20 6L9 17l-5-5" strokeWidth="2" />
    </svg>
);

/**
 * AI / Sparkles (Pulse + Stars)
 */
export const IconSparkles = () => (
    <svg {...baseSvgProps}>
        <path d="M12 3l1 2l2 1l-2 1l-1 2l-1-2l-2-1l2-1zM19 8l.5 1l1 .5l-1 .5l-.5 1l-.5-1l-1-.5l1-.5zM5 16l.5 1l1 .5l-1 .5l-.5 1l-.5-1l-1-.5l1-.5z" fill="currentColor" />
    </svg>
);

/**
 * Target / Strategy (Pulse + Aim)
 */
export const IconTarget = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
);

/**
 * Clock / Time (Pulse + ClockFace)
 */
export const IconClock = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="10" opacity="0.4" />
        <path d="M12 6v6l4 2" />
        <path d="M2 12h3" opacity="0.2" />
    </svg>
);

/**
 * Education / Book (Pulse + Book)
 */
export const IconBook = () => (
    <svg {...baseSvgProps}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

/**
 * Download Icon (Tray + Down Arrow)
 */
export const IconDownload = () => (
    <svg {...baseSvgProps}>
        <path d="M9 10l3 3l3-3M12 5v8" />
        <path d="M5 15v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" opacity="0.4" />
    </svg>
);

/**
 * Skills Analytics (Brain / Cognitive Map)
 */
export const IconBrain = () => (
    <svg {...baseSvgProps}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1 0-4.88 2.5 2.5 0 0 1 0-4.88A2.5 2.5 0 0 1 9.5 2z" opacity="0.4" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 0-4.88 2.5 2.5 0 0 0 0-4.88A2.5 2.5 0 0 0 14.5 2z" />
        <path d="M12 7h.01M12 12h.01M12 17h.01" />
    </svg>
);

/**
 * Visual Analysis (Dashboard / Analytics Card)
 */
export const IconPresentation = () => (
    <svg {...baseSvgProps}>
        <rect x="2" y="3" width="20" height="14" rx="2" opacity="0.4" />
        <path d="M8 21l4-4 4 4" />
        <path d="M12 17v4" />
        <path d="M7 10v2M12 8v4M17 6v6" />
    </svg>
);

/**
 * Microphone (active/on)
 */
export const IconMic = () => (
    <svg {...baseSvgProps}>
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M19 10a7 7 0 0 1-14 0" />
        <path d="M12 19v3M8 22h8" opacity="0.5" />
    </svg>
);

/**
 * Microphone Off / Muted
 */
export const IconMicOff = () => (
    <svg {...baseSvgProps}>
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M18.89 13.23A7 7 0 0 0 19 10" opacity="0.5" />
        <path d="M5 10a7 7 0 0 0 10.17 6.33" opacity="0.5" />
        <path d="M12 19v3M8 22h8" opacity="0.5" />
        <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    </svg>
);

/**
 * Play / Start
 */
export const IconPlay = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="10" opacity="0.3" />
        <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none" />
    </svg>
);

/**
 * Stop / End
 */
export const IconStop = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="10" opacity="0.3" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
);

/**
 * Refresh / Retake
 */
export const IconRefresh = () => (
    <svg {...baseSvgProps}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" opacity="0.5" />
        <path d="M3 21v-5h5" opacity="0.5" />
    </svg>
);

/**
 * Interview / Person with speech bubble
 */
export const IconInterview = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" opacity="0.4" />
        <path d="M16 3h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-5l-2 2V4a1 1 0 0 1 1-1z" opacity="0.6" />
    </svg>
);

/** Video / Course */
export const IconVideo = () => (
    <svg {...baseSvgProps}>
        <rect x="2" y="5" width="15" height="14" rx="2" opacity="0.4" />
        <path d="M17 9l5-3v12l-5-3V9z" />
    </svg>
);

/** Wrench / Tool */
export const IconWrench = () => (
    <svg {...baseSvgProps}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
);

/** External Link */
export const IconExternalLink = () => (
    <svg {...baseSvgProps}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" opacity="0.4" />
        <path d="M15 3h6v6M10 14L21 3" />
    </svg>
);

/** Lightbulb / Practice */
export const IconLightbulb = () => (
    <svg {...baseSvgProps}>
        <path d="M12 2a7 7 0 0 1 7 7c0 2.9-1.75 5.4-4.28 6.54L14 17H10l-.72-1.46A7 7 0 0 1 12 2z" opacity="0.5" />
        <path d="M10 17v1a2 2 0 0 0 4 0v-1" />
        <path d="M9 12h6" opacity="0.4" />
    </svg>
);

/** Flag / Milestone */
export const IconFlag = () => (
    <svg {...baseSvgProps}>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
);

/** Sun / Morning */
export const IconSun = () => (
    <svg {...baseSvgProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" opacity="0.5" />
    </svg>
);

/** Moon / Evening */
export const IconMoon = () => (
    <svg {...baseSvgProps}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

/** Calendar / Weekdays */
export const IconCalendar = () => (
    <svg {...baseSvgProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" opacity="0.4" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

/** Bar Chart / Total */
export const IconBarChart = () => (
    <svg {...baseSvgProps}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" opacity="0.4" />
    </svg>
);

/** Pin / Generic resource */
export const IconPin = () => (
    <svg {...baseSvgProps}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" opacity="0.4" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

/** Article / Docs */
export const IconArticle = () => (
    <svg {...baseSvgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" opacity="0.4" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
);

