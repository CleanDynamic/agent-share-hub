/** Prompt 9 (G18): the join tick's opening words. With the minimum age set, the tick also confirms it; while it is open
    (null), the sentence is today's. Its own file so SignupForm.tsx exports only components. */
export function termsLead(age: number | null): string {
  return age === null ? "I agree to the" : `I am ${age} or over and agree to the`;
}
