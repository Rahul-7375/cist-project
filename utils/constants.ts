
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
