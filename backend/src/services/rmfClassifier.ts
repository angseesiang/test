export function classifyRmf(text: string): 'Govern' | 'Map' | 'Measure' | 'Manage' {
  const t = text.toLowerCase();
  if (/(policy|accountability|role|access|audit)/.test(t)) return 'Govern';
  if (/(context|stakeholder|purpose|impact|use case)/.test(t)) return 'Map';
  if (/(metric|score|test|performance|bias|evaluate)/.test(t)) return 'Measure';
  return 'Manage';
}
