"use client";

import { useMemo, useState } from "react";

type UsePaginationOptions<T> = {
  items: T[];
  pageSize: number;
  resetKeys?: readonly unknown[];
};

export function usePagination<T>({
  items,
  pageSize,
  resetKeys = []
}: UsePaginationOptions<T>) {
  const resetToken = useMemo(() => JSON.stringify(resetKeys), [resetKeys]);
  const [paginationState, setPaginationState] = useState(() => ({
    page: 0,
    resetToken
  }));
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const basePage = paginationState.resetToken === resetToken ? paginationState.page : 0;
  const currentPage = Math.min(basePage, pageCount - 1);

  const paginatedItems = useMemo(
    () => items.slice(
      currentPage * pageSize,
      currentPage * pageSize + pageSize
    ),
    [currentPage, items, pageSize]
  );

  const pageStart = items.length === 0 ? 0 : currentPage * pageSize + 1;
  const pageEnd = Math.min((currentPage + 1) * pageSize, items.length);

  const setPage = (nextPage: number | ((current: number) => number)) => {
    setPaginationState((currentState) => {
      const currentBasePage = currentState.resetToken === resetToken ? currentState.page : 0;
      const resolvedPage = typeof nextPage === "function"
        ? nextPage(currentBasePage)
        : nextPage;

      return {
        page: Math.max(0, resolvedPage),
        resetToken
      };
    });
  };

  return {
    page: currentPage,
    setPage,
    currentPage,
    pageCount,
    pageStart,
    pageEnd,
    totalCount: items.length,
    paginatedItems,
    hasPreviousPage: currentPage > 0,
    hasNextPage: currentPage < pageCount - 1,
    goToPreviousPage: () => setPage((current) => Math.max(0, current - 1)),
    goToNextPage: () => setPage((current) => Math.min(pageCount - 1, current + 1))
  };
}
