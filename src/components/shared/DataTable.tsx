import { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, pageSize = 10, currentPage = 1, onPageChange, totalItems,
  onRowClick, emptyMessage = 'Không có dữ liệu', loading = false,
}: DataTableProps<T>) {
  const total = totalItems ?? data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const displayData = totalItems ? data : data.slice(startIdx, startIdx + pageSize);

  if (loading) {
    return (
      <div className="table-container">
        <div className="p-12 text-center text-muted-foreground">Đang tải dữ liệu...</div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map(col => (
              <TableHead key={col.key} className={col.className}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            displayData.map((row, idx) => (
              <TableRow
                key={row.id || idx}
                className={onRowClick ? 'cursor-pointer hover:bg-muted/30' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-sm text-muted-foreground">
            Hiển thị {startIdx + 1}–{Math.min(startIdx + pageSize, total)} / {total} bản ghi
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange?.(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange?.(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">Trang {currentPage}/{totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
