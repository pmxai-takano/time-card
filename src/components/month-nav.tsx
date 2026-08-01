type YearMonth = { year: number; month: number };

type Props = {
  prev: YearMonth;
  current: YearMonth;
  next: YearMonth;
};

function hrefFor({ year, month }: YearMonth): string {
  return `/?year=${year}&month=${month}`;
}

/**
 * Next.js 16.2 の同一パス + searchParams ソフトナビ不具合を避けるため、
 * 月移動はフルページ遷移の <a> を使う。
 */
export function MonthNav({ prev, current, next }: Props) {
  return (
    <nav className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
      <a
        href={hrefFor(prev)}
        className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
      >
        前の月
      </a>
      <a
        href={hrefFor(current)}
        className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
      >
        当月
      </a>
      <a
        href={hrefFor(next)}
        className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
      >
        次の月
      </a>
    </nav>
  );
}
