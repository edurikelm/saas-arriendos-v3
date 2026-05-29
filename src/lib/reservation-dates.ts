type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getDateParts(date: string | Date): DateParts {
  if (typeof date === "string") {
    const isoDate = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return {
        year: Number(isoDate[1]),
        month: Number(isoDate[2]),
        day: Number(isoDate[3]),
      };
    }
  }

  const value = new Date(date);
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  };
}

export function getInclusiveMonths(startDate: string | Date, endDate: string | Date): number {
  const start = getDateParts(startDate);
  const end = getDateParts(endDate);
  const monthDiff = (end.year - start.year) * 12 + (end.month - start.month);
  const months = monthDiff + (end.day >= start.day ? 1 : 0);

  return Math.max(1, months);
}
