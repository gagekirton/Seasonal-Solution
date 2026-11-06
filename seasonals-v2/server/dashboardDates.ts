const timeZone = "America/Winnipeg";

/** UTC instant for local midnight, including DST transition days. */
export function winnipegDayStart(day: string): Date {
  const target = Date.parse(`${day}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let i = 0; i < 3; i += 1) {
    const values = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map(part => [part.type, part.value])
    );
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    instant += target - represented;
  }
  return new Date(instant);
}
