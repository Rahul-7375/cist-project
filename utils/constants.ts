
export const DEPARTMENTS = [
  "Computer Science and Engineering",
  "CSE-DS",
  "CSE-AIML",
  "Civil Engineering",
  "Electronics and Communications Engineering",
  "Mechanical Engineering"
];

export const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CSE-DS": ["ATCD", "PA", "WSMA", "NLP", "WSMA-LAB", "PA-LAB", "I&EE"],
  "CSE-AIML": ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Natural Language Processing", "Computer Vision"],
  "Civil Engineering": ["Structural Analysis", "Geotechnical Engineering", "Surveying", "Construction Mgmt"],
  "Electronics and Communications Engineering": ["Digital Electronics", "Signals & Systems", "Microprocessors", "VLSI Design", "Communication Systems"],
  "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design"]
};

// Validation & System Constants
export const SYSTEM_CONFIG = {
  GPS_RADIUS_METERS: 300,
  FACE_MATCH_THRESHOLD: 115, // 0-255 scale (Lower is stricter)
  SCAN_TIMEOUT_SECONDS: 45,
  QR_REFRESH_INTERVAL_MS: 10000,
  QR_TOKEN_VALIDITY_MS: 20000,
  SESSION_STALE_MINUTES: 90
};
