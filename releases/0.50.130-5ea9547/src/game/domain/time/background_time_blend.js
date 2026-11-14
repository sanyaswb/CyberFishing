export function backgroundTimeBlend(time, output) {
  let evening = 0;
  let night = 0;
  if (time >= 17 && time < 19) evening = (time - 17) / 2;
  else if (time >= 19 && time < 21) { evening = 1; night = (time - 19) / 2; }
  else if (time >= 21 || time < 5) { evening = 1; night = 1; }
  else if (time >= 5 && time < 7) { evening = 1; night = 1 - (time - 5) / 2; }
  else if (time >= 7 && time < 9) evening = 1 - (time - 7) / 2;
  output.evening = evening;
  output.night = night;
  return output;
}
