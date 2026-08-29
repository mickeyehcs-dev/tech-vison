import { useState, useMemo } from 'react';

export function usePagination(initialPage: number = 1, initialLimit: number = 10) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  const nextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const prevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
  };

  return {
    page,
    limit,
    total,
    totalPages,
    setPage,
    setLimit,
    setTotal,
    nextPage,
    prevPage,
    goToPage
  };
}
