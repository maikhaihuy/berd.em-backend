// Monday (1) is default
const defaultWeekStartOn = 1;
export function getStartAndEndInWeek(
  date: Date,
  weekStartOn: number = defaultWeekStartOn,
) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay() + weekStartOn);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(date);
  endOfWeek.setDate(date.getDate() + (6 - date.getDay() + weekStartOn));
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: startOfWeek,
    end: endOfWeek,
  };
}

export function getDateInWeek(
  date: Date,
  weekStartOn: number = defaultWeekStartOn,
) {
  const getDateInWeek: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const iDate = new Date(date);
    iDate.setDate(date.getDate() - date.getDay() + weekStartOn + i);
    iDate.setHours(0, 0, 0, 0);
    getDateInWeek.push(iDate);
  }
  return getDateInWeek;
}
