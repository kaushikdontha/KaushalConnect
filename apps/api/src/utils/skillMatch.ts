export function matchSkills(candidateSkills: string[], requiredSkills: string[]) {
  const candidateSet = new Set(candidateSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));
  const required = new Map<string, string>();
  for (const skill of requiredSkills) {
    const value = skill.trim();
    if (value && !required.has(value.toLowerCase())) required.set(value.toLowerCase(), value);
  }
  const uniqueRequired = [...required.values()];
  const matchingSkills = uniqueRequired.filter((skill) => candidateSet.has(skill.toLowerCase()));
  const missingSkills = uniqueRequired.filter((skill) => !candidateSet.has(skill.toLowerCase()));
  const matchScore = uniqueRequired.length === 0 ? 100 : Math.round((100 * matchingSkills.length) / uniqueRequired.length);
  return { matchScore, matchingSkills, missingSkills };
}
