import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, type FilterField } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Plus } from 'lucide-react';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { getItemName, formatDate } from '@/data/mockData';
import { lossReportKindLabels, lossReportStatusLabels } from '@/data/mockData';
import type { LossReportRequestDto } from '@/api/types';
import { mapAssetItemDto, useAssetItems, useEnrichedEquipmentList, useLossReportRequests } from '@/hooks/useEntityApi';
import { formatCombinedLossSummary } from '@/utils/lossReportCombinedDisplay';
import { LossReportRequestNarrativeFields } from '@/components/shared/LossReportRequestNarrativeFields';
import { PageLoading } from '@/components/shared/page-loading';
import type { AssetItem, Equipment } from '@/data/mockData';

function lossKindUpper(r: LossReportRequestDto): string {
  return String(r.lossKind ?? '').toUpperCase();
}

function lossRowMatchesSearch(
  r: LossReportRequestDto,
  assetItems: AssetItem[],
  equipments: Equipment[],
  q: string,
): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const parts: string[] = [
    r.code ?? '',
    formatBizCodeDisplay(r.code ?? ''),
    r.reason ?? '',
    r.lossDescription ?? '',
    lossReportKindLabels[r.lossKind ?? ''] ?? '',
    lossReportStatusLabels[r.status ?? ''] ?? '',
    r.status ?? '',
  ];
  if (r.equipment) {
    parts.push(r.equipment.equipmentCode ?? '');
    const iid = r.equipment.assetItem?.id;
    if (iid != null) parts.push(getItemName(String(iid), assetItems));
  }
  if (r.consumableAssignment?.assetItem?.id != null) {
    parts.push(getItemName(String(r.consumableAssignment.assetItem.id), assetItems));
  }
  if (lossKindUpper(r) === 'COMBINED') {
    parts.push(formatCombinedLossSummary(r, assetItems, equipments));
  }
  return parts.join(' ').toLowerCase().includes(s);
}

/** Danh sách YC báo mất của tài khoản (API đã lọc theo người gửi). */
const EmployeeLossReports = () => {
  const navigate = useNavigate();
  const lrQ = useLossReportRequests();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const rows = lrQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = (eqQ.data ?? []) as Equipment[];
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LossReportRequestDto | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.requestDate ?? '').localeCompare(a.requestDate ?? '')),
    [rows],
  );

  const [filters, setFilters] = useState({ search: '', status: '' });

  const pageLoading = lrQ.isLoading || iQ.isLoading || eqQ.isLoading;

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: 'search',
        label: 'Tìm kiếm',
        type: 'text',
        placeholder: 'Mã, lý do, tài sản, loại…',
        inputClassName: 'min-w-[12rem] max-w-xl w-full sm:w-72 md:w-96',
      },
      {
        key: 'status',
        label: 'Trạng thái',
        type: 'select',
        options: Object.entries(lossReportStatusLabels).map(([value, label]) => ({ value, label })),
      },
    ],
    [],
  );

  const filteredSorted = useMemo(() => {
    let list = sorted;
    if (filters.status) list = list.filter(r => String(r.status ?? '') === filters.status);
    if (filters.search.trim()) list = list.filter(r => lossRowMatchesSearch(r, assetItems, equipments, filters.search));
    return list;
  }, [sorted, filters, assetItems, equipments]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status]);

  const columns: Column<LossReportRequestDto>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code ?? '')}</span>,
    },
    {
      key: 'kind',
      label: 'Loại',
      render: r => lossReportKindLabels[r.lossKind ?? ''] ?? r.lossKind,
    },
    {
      key: 'target',
      label: 'Tài sản',
      render: r => {
        const k = lossKindUpper(r);
        if (k === 'EQUIPMENT' && r.equipment) {
          const itemId = r.equipment.assetItem?.id != null ? String(r.equipment.assetItem.id) : '';
          return (
            <span className="text-sm">
              {formatEquipmentCodeDisplay(r.equipment.equipmentCode)}
              {itemId ? ` — ${getItemName(itemId, assetItems)}` : ''}
            </span>
          );
        }
        if (k === 'CONSUMABLE' && r.consumableAssignment?.assetItem?.id != null) {
          return (
            <span className="text-sm">
              {getItemName(String(r.consumableAssignment.assetItem.id), assetItems)} — SL: {r.quantity ?? '—'}
            </span>
          );
        }
        if (k === 'COMBINED' && r.lossEntries?.length) {
          const summary = formatCombinedLossSummary(r, assetItems, equipments);
          return summary ? (
            <span className="text-sm break-words max-w-[min(28rem,55vw)] inline-block align-top">{summary}</span>
          ) : (
            '—'
          );
        }
        return '—';
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => <StatusBadge status={r.status ?? ''} label={lossReportStatusLabels[r.status ?? ''] ?? r.status} />,
    },
    {
      key: 'requestDate',
      label: 'Ngày gửi',
      render: r => formatDate(r.requestDate ?? ''),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[3rem]',
      render: r => (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Xem" onClick={() => setSelected(r)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 w-full">
          <div>
            <h1 className="page-title">Yêu cầu báo mất</h1>
          </div>
          <Button
            type="button"
            className="shrink-0 w-full sm:w-auto"
            onClick={() => navigate('/employee/request-new/loss')}
          >
            <Plus className="h-4 w-4 mr-1 shrink-0" />
            Tạo yêu cầu báo mất
          </Button>
        </div>
      </div>

      {pageLoading ? (
        <PageLoading minHeight="min-h-[45vh]" />
      ) : (
        <>
      <div className="mb-4">
        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setFilters({ search: '', status: '' })}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredSorted}
        currentPage={page}
        onPageChange={setPage}
        emptyMessage={
          rows.length === 0
            ? 'Chưa có yêu cầu báo mất.'
            : 'Không có yêu cầu nào khớp tìm kiếm hoặc lọc trạng thái.'
        }
      />
        </>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết {selected?.code ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground">Trạng thái:</span>{' '}
                <StatusBadge status={selected.status ?? ''} label={lossReportStatusLabels[selected.status ?? ''] ?? selected.status} />
              </div>
              <div>
                <span className="text-muted-foreground">Loại:</span>{' '}
                {lossReportKindLabels[selected.lossKind ?? ''] ?? selected.lossKind}
              </div>
              {lossKindUpper(selected) === 'EQUIPMENT' && selected.equipment && (
                <div>
                  <span className="text-muted-foreground">Thiết bị:</span>{' '}
                  <span className="font-mono">{formatEquipmentCodeDisplay(selected.equipment.equipmentCode)}</span>
                  {selected.equipment.assetItem?.id != null && (
                    <span className="ml-1">— {getItemName(String(selected.equipment.assetItem.id), assetItems)}</span>
                  )}
                </div>
              )}
              {lossKindUpper(selected) === 'CONSUMABLE' && selected.consumableAssignment?.assetItem?.id != null && (
                <div>
                  <span className="text-muted-foreground">Vật tư:</span>{' '}
                  {getItemName(String(selected.consumableAssignment.assetItem.id), assetItems)} — SL báo mất:{' '}
                  <span className="font-medium tabular-nums">{selected.quantity ?? '—'}</span>
                </div>
              )}
              {lossKindUpper(selected) === 'COMBINED' && selected.lossEntries?.length ? (
                <div>
                  <span className="text-muted-foreground">Tài sản trong phiếu:</span>
                  <p className="mt-1 whitespace-pre-wrap break-words">{formatCombinedLossSummary(selected, assetItems, equipments)}</p>
                </div>
              ) : null}
              <LossReportRequestNarrativeFields row={selected} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLossReports;
