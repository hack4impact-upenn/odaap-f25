import type { Module, Submission } from '../types';

/**
 * Course overall grade: average of each posted module's percentage
 * (module points earned / module points possible). Modules with no graded
 * work yet are omitted so the average matches "equal weight per module"
 * among modules that have grades.
 */
export function equalModuleOverallPercent(
  modules: Module[],
  submissionsByModuleId: Record<number, Submission[]>
): number | null {
  const posted = modules.filter((m) => m.is_posted);
  const percents: number[] = [];
  for (const m of posted) {
    const subs = submissionsByModuleId[m.id] ?? [];
    let totalScore = 0;
    let totalPossible = 0;
    for (const sub of subs) {
      if (sub.grade) {
        totalScore += sub.grade.score ?? 0;
        totalPossible += sub.grade.total ?? 0;
      }
    }
    if (totalPossible > 0) {
      percents.push((totalScore / totalPossible) * 100);
    }
  }
  if (percents.length === 0) return null;
  const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
  return Math.round(avg);
}
