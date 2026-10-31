export function achievements(completedDates: string[], currentStreak: number) {
  const days = new Set(completedDates).size;
  return [
    {
      id: "first",
      symbol: "✦",
      en: "First step",
      es: "Primer paso",
      earned: days >= 1,
    },
    {
      id: "week",
      symbol: "🔥",
      en: "Seven-day streak",
      es: "Racha de siete días",
      earned: currentStreak >= 7,
    },
    {
      id: "half",
      symbol: "◒",
      en: "Halfway hero",
      es: "A mitad del camino",
      earned: days >= 15,
    },
    {
      id: "month",
      symbol: "★",
      en: "November finisher",
      es: "Noviembre completo",
      earned: days >= 30,
    },
  ];
}
