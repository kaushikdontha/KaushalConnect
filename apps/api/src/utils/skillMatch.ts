export function matchSkills(candidateSkills: string[], requiredSkills: string[]) {
  const candidateSet = new Set(candidateSkills.map((skill) => skill.trim().toLocaleLowerCase()).filter(Boolean));
  const uniqueRequired = [...new Map(requiredSkills.map((skill) => [skill.trim().toLocaleLowerCase(), skill.trim()])).values()].filter(Boolean);
  const matchingSkills = uniqueRequired.filter((skill) => candidateSet.has(skill.toLocaleLowerCase()));
  const missingSkills = uniqueRequired.filter((skill) => !candidateSet.has(skill.toLocaleLowerCase()));
  const matchScore = uniqueRequired.length === 0 ? 100 : Math.round((100 * matchingSkills.length) / uniqueRequired.length);
  return { matchScore, matchingSkills, missingSkills };
}
