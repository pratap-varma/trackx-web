/**
 * TrackX Attendance Intelligence Mathematical Engine
 * 
 * Strict Principle:
 * Attendance calculations must use actual attended/conducted counts.
 * Never invent attendance counts from a raw percentage.
 * 
 * Formulas:
 * A = attended
 * C = conducted
 * T = target percentage as decimal (e.g. 0.75 for 75%)
 * 
 * Required consecutive classes to reach target:
 * ceil((T * C - A) / (1 - T))
 * 
 * Maximum upcoming classes that can be skipped while maintaining target:
 * floor(A / T - C)
 */

export interface AttendanceMetrics {
  attended: number;
  conducted: number;
  percentage: number;
  target: number;
  safeBunks: number;
  requiredRecovery: number;
  riskStatus: 'healthy' | 'attention' | 'critical';
  insightText: string;
}

export function calculateAttendancePercentage(attended: number, conducted: number): number {
  if (conducted <= 0) return 0;
  return Number(((attended / conducted) * 100).toFixed(2));
}

export function calculateSafeBunks(
  attended: number,
  conducted: number,
  targetPercentage: number = 75
): number {
  if (conducted <= 0) return 0;
  const T = targetPercentage / 100;
  const currentRatio = attended / conducted;
  
  if (currentRatio < T) return 0;
  
  // Formula: floor(A / T - C)
  const maxBunks = Math.floor(attended / T - conducted);
  return Math.max(0, maxBunks);
}

export function calculateRequiredRecovery(
  attended: number,
  conducted: number,
  targetPercentage: number = 75
): number {
  if (conducted <= 0) return 0;
  const T = targetPercentage / 100;
  const currentRatio = attended / conducted;
  
  if (currentRatio >= T) return 0;
  if (T >= 1.0) return 0; // Avoid division by zero
  
  // Formula: ceil((T * C - A) / (1 - T))
  const required = Math.ceil((T * conducted - attended) / (1 - T));
  return Math.max(0, required);
}

export function calculateIfAttend(
  attended: number,
  conducted: number,
  sessions: number = 1
): number {
  const newConducted = conducted + sessions;
  if (newConducted <= 0) return 100;
  return Number((((attended + sessions) / newConducted) * 100).toFixed(2));
}

export function calculateIfBunk(
  attended: number,
  conducted: number,
  sessions: number = 1
): number {
  const newConducted = conducted + sessions;
  if (newConducted <= 0) return 0;
  return Number(((attended / newConducted) * 100).toFixed(2));
}

export function getRiskStatus(
  percentage: number,
  target: number = 75,
  conducted?: number
): 'healthy' | 'attention' | 'critical' {
  if (conducted !== undefined && conducted === 0) return 'healthy';
  if (percentage >= target) return 'healthy';
  if (percentage >= target - 5) return 'attention';
  return 'critical';
}

export function generateAttendanceInsight(
  attended: number,
  conducted: number,
  target: number = 75
): string {
  if (conducted <= 0) {
    return `No classes held yet. Maintain attendance at or above ${target}% as sessions begin.`;
  }
  
  const pct = calculateAttendancePercentage(attended, conducted);
  const safeBunks = calculateSafeBunks(attended, conducted, target);
  const recovery = calculateRequiredRecovery(attended, conducted, target);
  
  if (pct >= target) {
    if (safeBunks === 0) {
      return `You're exactly on track at ${pct}%. Missing the next class will drop you below your ${target}% target.`;
    }
    const plural = safeBunks === 1 ? 'class' : 'classes';
    return `You can safely skip ${safeBunks} ${plural} and remain above ${target}%.`;
  } else {
    const plural = recovery === 1 ? 'class' : 'classes';
    return `Attend the next ${recovery} consecutive ${plural} to reach ${target}%.`;
  }
}

export function computeMetrics(
  attended: number,
  conducted: number,
  target: number = 75,
  baselinePercentage?: number | null
): AttendanceMetrics {
  let percentage = calculateAttendancePercentage(attended, conducted);
  if (conducted <= 0 && baselinePercentage !== undefined && baselinePercentage !== null) {
    percentage = Number(baselinePercentage.toFixed(2));
  }
  const safeBunks = conducted > 0 ? calculateSafeBunks(attended, conducted, target) : 0;
  const requiredRecovery = conducted > 0 ? calculateRequiredRecovery(attended, conducted, target) : 0;
  const riskStatus = getRiskStatus(percentage, target, conducted > 0 ? conducted : undefined);
  let insightText = generateAttendanceInsight(attended, conducted, target);
  if (conducted <= 0 && baselinePercentage !== undefined && baselinePercentage !== null) {
    insightText = `Baseline attendance recorded at ${percentage}%. Attended/conducted counts were not visible in the uploaded image.`;
  }
  
  return {
    attended,
    conducted,
    percentage,
    target,
    safeBunks,
    requiredRecovery,
    riskStatus,
    insightText,
  };
}
