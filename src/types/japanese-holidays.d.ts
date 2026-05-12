declare module "japanese-holidays" {
  const JapaneseHolidays: {
    isHolidayAt(date: Date, furikae?: boolean): string | false | undefined;
    getHolidaysOf(year: number, furikae?: boolean): unknown;
  };
  export default JapaneseHolidays;
}
