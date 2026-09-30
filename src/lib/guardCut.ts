export type GuardCutSymbol = '□' | '☆';

export function addGuardCutSymbol(value: string, symbol: GuardCutSymbol): string {
  const match = /^(□*)(☆*)$/.exec(value);
  if (!match) return value;
  const [, squares, stars] = match;
  return symbol === '□' ? `${squares}□${stars}` : `${squares}${stars}☆`;
}
