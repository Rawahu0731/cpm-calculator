export type Items = {
  score: boolean;
  coin: boolean;
  exp: boolean;
  timeItem: boolean;
  bomb: boolean;
  fivetofour: boolean;
}

export function computeCPM(opts: { time: string; coins: number; items?: Partial<Items> }): number {
  const { time, coins, items = {} } = opts;
  const timeParts = String(time).split(':');
  if (timeParts.length !== 2) return NaN;
  const minutes = Number(timeParts[0]);
  const seconds = Number(timeParts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return NaN;
  const totalMinutes = minutes + (seconds / 60);
  if (totalMinutes === 0) return NaN;

  let lastCoins = Number(coins);
  if (!Number.isFinite(lastCoins)) return NaN;

  if (items.score) lastCoins -= 500;
  if (items.coin) lastCoins -= 500;
  if (items.exp) lastCoins -= 500;
  if (items.timeItem) lastCoins -= 1000;
  if (items.bomb) lastCoins -= 1500;
  if (items.fivetofour) lastCoins -= 1800;

  let res = lastCoins / totalMinutes;
  // Mirror existing app behavior: if coin checkbox is set, apply 1.3 multiplier after subtraction
  if (items.coin) res = (lastCoins * 1.3) / totalMinutes;

  return res;
}

export default computeCPM;
