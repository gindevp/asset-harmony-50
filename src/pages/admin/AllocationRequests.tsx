import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { AllocationRequest, AllocationRequestLine, AssetItem, Equipment } from '@/data/mockData';
import {
  allocationStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getItemName,
  getItemCode,
  getAssetLineDisplay,
  formatDate,
} from '@/data/mockData';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { ApiError, apiDelete, apiPatch, getApiErrorMessage, getStoredToken, parseProblemDetailJson } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import {
  mapAssetItemDto,
  useAllocationRequestsView,
  useAssetItems,
  useAssetLines,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';
import {
  type AllocationDetailRow,
  buildAllocationDetailRows,
  formatAllocationRequestAssetNamesSummary,
  getAllocationListKindLabel,
} from '@/utils/allocationDisplayRows';
import { canDeleteAllocationRequest, canEditAllocationRequestFields } from '@/utils/requestRecordActions';
import { PageLoading } from '@/components/shared/page-loading';

/** QLTS không có quyền sửa/xóa phiếu (Admin / GĐ vẫn có). */
function hideAllocationEditDeleteForQlts(): boolean {
  const t = getStoredToken();
  return hasAnyAuthority(t, ['ROLE_ASSET_MANAGER']) && !hasAnyAuthority(t, ['ROLE_ADMIN', 'ROLE_GD']);
}
/** TB tồn kho khớp dòng / item (cùng logic với phiếu). */
function stockEquipmentsForLine(r: AllocationRequestLine, assetItems: AssetItem[], equipments: Equipment[]): Equipment[] {
  const lineId = r.assetLineId ?? '';
  const itemId = r.itemId;
  const itemIds = new Set<string>();
  if (lineId) {
    assetItems.filter(i => i.lineId === lineId).forEach(i => itemIds.add(i.id));
  } else if (itemId) {
    itemIds.add(itemId);
  }
  return equipments.filter(e => itemIds.has(e.itemId) && e.status === 'IN_STOCK');
}

function consumableItemOptionsForLine(r: AllocationRequestLine, assetItems: AssetItem[]) {
  const lid = r.assetLineId ?? '';
  return assetItems
    .filter(i => i.managementType === 'CONSUMABLE' && (!lid || i.lineId === lid))
    .map(i => ({
      value: String(i.id),
      label: `${i.code} — ${i.name}`,
      searchText: `${i.code} ${i.name}`,
    }));
}

/** Mã hàng (danh mục) thiết bị trên dòng tài sản — cùng kiểu chọn một lần như vật tư. */
function deviceCatalogOptionsForAssetLine(assetLineId: string, assetItems: AssetItem[]) {
  return assetItems
    .filter(i => i.managementType === 'DEVICE' && i.lineId === assetLineId)
    .map(i => ({
      value: String(i.id),
      label: `${i.code} — ${i.name}`,
      searchText: `${i.code} ${i.name}`,
    }));
}

/** Chọn N thiết bị tồn kho cùng mã (catalog), không trùng thiết bị đã gán cho dòng khác trong YC. */
function pickEquipmentsForCatalogGroup(
  group: AllocationRequestLine[],
  assetItemId: string,
  allRequestLines: AllocationRequestLine[],
  equipments: Equipment[],
): Equipment[] | null {
  const groupIds = new Set(group.map(l => String(l.id)));
  const blocked = new Set<string>();
  for (const l of allRequestLines) {
    if (groupIds.has(String(l.id))) continue;
    if (l.equipmentId) blocked.add(String(l.equipmentId));
  }
  const pool = equipments
    .filter(e => String(e.itemId) === assetItemId && e.status === 'IN_STOCK')
    .filter(e => !blocked.has(String(e.id)))
    .sort((a, b) =>
      formatEquipmentCodeDisplay(a.equipmentCode).localeCompare(formatEquipmentCodeDisplay(b.equipmentCode), 'vi'),
    );
  if (pool.length < group.length) return null;
  return pool.slice(0, group.length);
}

const AllocationRequests = () => {
  const qc = useQueryClient();
  const hideRowEditDelete = hideAllocationEditDeleteForQlts();
  const arQ = useAllocationRequestsView();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const iQ = useAssetItems();
  const alQ = useAssetLines();
  const eqQ = useEnrichedEquipmentList();
  const allocationRequests = arQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const assetLinesApi = alQ.data ?? [];
  const equipments = eqQ.data ?? [];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AllocationRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [editReason, setEditReason] = useState('');
  const [editAttach, setEditAttach] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AllocationRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const listLoading =
    arQ.isLoading || empQ.isLoading || depQ.isLoading || iQ.isLoading || alQ.isLoading || eqQ.isLoading;

  useEffect(() => {
    if (!selected || dialogMode !== 'edit') return;
    setEditReason(selected.reason ?? '');
    setEditAttach(selected.attachmentNote ?? '');
  }, [selected?.id, dialogMode, selected?.reason, selected?.attachmentNote]);

  const filtered = allocationRequests
    .filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const codeHit = r.code.toLowerCase().includes(s);
        const kindHit = getAllocationListKindLabel(r.lines).toLowerCase().includes(s);
        const namesHit = formatAllocationRequestAssetNamesSummary(r.lines, assetItems, equipments)
          .toLowerCase()
          .includes(s);
        if (!codeHit && !kindHit && !namesHit) return false;
      }
      if (filters.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<AllocationRequest>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>,
    },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    {
      key: 'assetKind',
      label: 'Loại',
      render: r => getAllocationListKindLabel(r.lines),
    },
    {
      key: 'assetNames',
      label: 'Tên tài sản',
      render: r => (
        <span className="max-w-md truncate block" title={formatAllocationRequestAssetNamesSummary(r.lines, assetItems, equipments)}>
          {formatAllocationRequestAssetNamesSummary(r.lines, assetItems, equipments)}
        </span>
      ),
    },
    {
      key: 'assignee',
      label: 'Đối tượng nhận',
      render: r => <span className="max-w-[12rem] truncate block" title={r.assigneeSummary}>{r.assigneeSummary}</span>,
    },
    {
      key: 'stockIssue',
      label: 'Phiếu xuất',
      render: r =>
        r.stockIssueCode ? (
          <span className="font-mono text-xs">{r.stockIssueCode}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={allocationStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'w-[9rem]',
      render: r => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Xem"
            onClick={() => {
              setDialogMode('view');
              setSelected(r);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!hideRowEditDelete && canEditAllocationRequestFields(r.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Sửa"
              onClick={() => {
                setDialogMode('edit');
                setSelected(r);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {!hideRowEditDelete && canDeleteAllocationRequest(r.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Xóa"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, loại, tên tài sản…' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(allocationStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'allocation-request-lines'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  }, [qc]);

  const saveAllocationContent = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${selected.id}`, {
        id: Number(selected.id),
        reason: editReason.trim() || undefined,
        attachmentNote: editAttach.trim() || undefined,
      });
      toast.success('Đã lưu thay đổi');
      setDialogMode('view');
      setSelected(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAllocation = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiDelete(`/api/allocation-requests/${deleteTarget.id}`);
      toast.success('Đã xóa yêu cầu');
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setDialogMode('view');
      }
      setDeleteTarget(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const saveLineEquipment = useCallback(
    async (lineId: number, equipmentId: number) => {
      setBusy(true);
      try {
        await apiPatch(`/api/allocation-request-lines/${lineId}`, { id: lineId, equipment: { id: equipmentId } });
        toast.success('Đã gán thiết bị cho dòng');
        setSelected(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            lines: prev.lines.map(l =>
              String(l.id) === String(lineId) ? { ...l, equipmentId: String(equipmentId) } : l,
            ),
          };
        });
        invalidate();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật dòng');
      } finally {
        setBusy(false);
      }
    },
    [invalidate],
  );

  const saveLineConsumableItem = useCallback(
    async (lineId: number, assetItemId: number) => {
      setBusy(true);
      try {
        await apiPatch(`/api/allocation-request-lines/${lineId}`, { id: lineId, assetItem: { id: assetItemId } });
        toast.success('Đã gán mã vật tư cho dòng');
        setSelected(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            lines: prev.lines.map(l =>
              String(l.id) === String(lineId) ? { ...l, itemId: String(assetItemId) } : l,
            ),
          };
        });
        invalidate();
      } catch (e) {
        toast.error(getApiErrorMessage(e), { duration: 24_000 });
      } finally {
        setBusy(false);
      }
    },
    [invalidate],
  );

  const saveGroupDevicesByCatalog = useCallback(
    async (group: AllocationRequestLine[], assetItemId: number) => {
      if (!selected) return;
      const picks = pickEquipmentsForCatalogGroup(group, String(assetItemId), selected.lines, equipments);
      if (!picks) {
        toast.error(
          `Không đủ thiết bị tồn kho cùng mã đã chọn (cần ${group.length} thiết bị còn tồn, không trùng dòng khác trong phiếu)`,
        );
        return;
      }
      setBusy(true);
      try {
        for (let i = 0; i < group.length; i++) {
          await apiPatch(`/api/allocation-request-lines/${group[i].id}`, {
            id: Number(group[i].id),
            equipment: { id: Number(picks[i].id) },
          });
        }
        toast.success('Đã gán thiết bị theo mã đã chọn');
        setSelected(prev => {
          if (!prev) return prev;
          const map = new Map(group.map((l, i) => [String(l.id), String(picks[i].id)]));
          return {
            ...prev,
            lines: prev.lines.map(l => (map.has(String(l.id)) ? { ...l, equipmentId: map.get(String(l.id))! } : l)),
          };
        });
        invalidate();
      } catch (e) {
        toast.error(getApiErrorMessage(e), { duration: 24_000 });
      } finally {
        setBusy(false);
      }
    },
    [selected, equipments, invalidate],
  );

  const setStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${selected.id}`, {
        id: Number(selected.id),
        status,
      });
      toast.success('Đã cập nhật trạng thái yêu cầu');
      setSelected(null);
      invalidate();
    } catch (e) {
      toast.error(getApiErrorMessage(e), { duration: 24_000 });
    } finally {
      setBusy(false);
    }
  };

  const submitRejectAllocation = async () => {
    if (!selected) return;
    const t = rejectReason.trim();
    if (!t) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${selected.id}`, {
        id: Number(selected.id),
        status: 'REJECTED',
        rejectionReason: t,
      });
      toast.success('Đã từ chối yêu cầu');
      setRejectOpen(false);
      setRejectReason('');
      setSelected(null);
      invalidate();
    } catch (e) {
      toast.error(getApiErrorMessage(e), { duration: 24_000 });
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    for (const l of selected.lines) {
      const lt = String(l.lineType ?? 'DEVICE').toUpperCase();
      if (lt === 'CONSUMABLE') {
        if (!l.itemId || !String(l.itemId).trim()) {
          toast.error('Chọn mã vật tư (tài sản) cho mọi dòng vật tư trước khi duyệt');
          return;
        }
        continue;
      }
      if (lt === 'DEVICE' && (!l.equipmentId || !String(l.equipmentId).trim())) {
        toast.error('Chọn thiết bị tồn kho cho tất cả dòng thiết bị trước khi duyệt');
        return;
      }
    }
    await setStatus('APPROVED');
  };

  const allocationDetailRows = useMemo(
    () => (selected ? buildAllocationDetailRows(selected.lines) : []),
    [selected],
  );

  const detailColumns = useMemo((): Column<AllocationDetailRow>[] => {
    if (!selected) return [];
    return [
      {
        key: 'assetLineCol',
        label: 'Dòng tài sản',
        render: (row: AllocationDetailRow) => {
          if (row.kind === 'device_group') {
            const al = assetLinesApi.find(l => String(l.id) === row.assetLineId);
            return al?.name?.trim() || getAssetLineDisplay(row.assetLineId, assetLinesApi);
          }
          const r = row.line;
          const lt = (r.lineType ?? '').toUpperCase();
          if (lt === 'CONSUMABLE') {
            if (r.assetLineId) {
              const al = assetLinesApi.find(l => String(l.id) === r.assetLineId);
              return al?.name?.trim() || getAssetLineDisplay(r.assetLineId, assetLinesApi);
            }
            const item = assetItems.find(i => String(i.id) === String(r.itemId));
            const lid = item?.lineId;
            if (lid) {
              const al = assetLinesApi.find(l => String(l.id) === lid);
              return al?.name?.trim() || getAssetLineDisplay(lid, assetLinesApi);
            }
            return '—';
          }
          if (r.assetLineId) {
            const al = assetLinesApi.find(l => String(l.id) === r.assetLineId);
            return al?.name?.trim() || getAssetLineDisplay(r.assetLineId, assetLinesApi);
          }
          return '—';
        },
      },
      {
        key: 'item',
        label: 'Tên tài sản',
        render: (row: AllocationDetailRow) => {
          if (row.kind === 'device_group') {
            const itemIds = row.lines.map(l => {
              const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
              return eq?.itemId;
            });
            const first = itemIds.find(Boolean);
            if (first && itemIds.every(id => id && id === first)) {
              return getItemName(first, assetItems);
            }
            return '—';
          }
          const r = row.line;
          const lt = (r.lineType ?? '').toUpperCase();
          if (lt === 'CONSUMABLE') {
            if (!r.itemId || !String(r.itemId).trim()) return '—';
            return getItemName(r.itemId, assetItems);
          }
          const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
          if (eq) return getItemName(eq.itemId, assetItems);
          return '—';
        },
      },
      {
        key: 'assetCode',
        label: 'Mã tài sản',
        render: (row: AllocationDetailRow) => {
          if (row.kind === 'device_group') {
            const itemIds = row.lines.map(l => {
              const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
              return eq?.itemId;
            });
            const first = itemIds.find(Boolean);
            if (first && itemIds.every(id => id && id === first)) {
              const fromCatalog = assetItems.find(i => String(i.id) === String(first))?.code?.trim() ?? '';
              return fromCatalog ? formatBizCodeDisplay(fromCatalog) : '—';
            }
            return '—';
          }
          const r = row.line;
          const lt = (r.lineType ?? '').toUpperCase();
          if (lt === 'CONSUMABLE') {
            if (!r.itemId || !String(r.itemId).trim()) return '—';
            const fromCatalog = assetItems.find(i => String(i.id) === String(r.itemId))?.code?.trim() ?? '';
            const code = fromCatalog || r.itemCode?.trim() || (r.itemId ? getItemCode(r.itemId, assetItems) : '');
            return code ? formatBizCodeDisplay(code) : '—';
          }
          const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
          return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : '—';
        },
      },
      {
        key: 'quantity',
        label: 'Số lượng',
        className: 'text-right',
        render: (row: AllocationDetailRow) => (row.kind === 'device_group' ? row.lines.length : row.line.quantity),
      },
      {
        key: 'pick',
        label: 'Chọn tài sản',
        className: 'min-w-[14rem]',
        render: (row: AllocationDetailRow) => {
          if (row.kind === 'device_group') {
            const itemIds = row.lines.map(l => {
              const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
              return eq?.itemId;
            });
            const first = itemIds.find(Boolean);
            const allSameCatalog =
              Boolean(first) && itemIds.every(id => id && id === first);
            const curCatalog = allSameCatalog && first ? String(first) : '';
            const opts = deviceCatalogOptionsForAssetLine(row.assetLineId, assetItems);
            if (selected.status !== 'PENDING') {
              if (!first || !allSameCatalog) {
                return <span className="text-muted-foreground text-sm">Đã gán thiết bị ({row.lines.length})</span>;
              }
              const nm = getItemName(first, assetItems);
              const code =
                assetItems.find(i => String(i.id) === String(first))?.code?.trim() || getItemCode(first, assetItems);
              return (
                <span className="text-sm">
                  {nm}
                  {code ? ` — ${formatBizCodeDisplay(code)}` : ''}
                </span>
              );
            }
            return (
              <SearchableSelect
                value={curCatalog}
                onValueChange={v => void saveGroupDevicesByCatalog(row.lines, Number(v))}
                options={opts}
                placeholder="Chọn mã thiết bị (danh mục)…"
                searchPlaceholder="Tìm mã, tên…"
                emptyText={opts.length === 0 ? 'Không có mã trên dòng này' : 'Không khớp'}
                disabled={busy}
                triggerClassName="w-full min-w-[12rem] max-w-[20rem]"
              />
            );
          }
          const r = row.line;
          const lt = (r.lineType ?? '').toUpperCase();
          if (lt === 'CONSUMABLE') {
            const opts = consumableItemOptionsForLine(r, assetItems);
            if (selected.status !== 'PENDING') {
              if (!r.itemId?.trim()) return <span className="text-muted-foreground">—</span>;
              const nm = getItemName(r.itemId, assetItems);
              const code =
                assetItems.find(i => String(i.id) === String(r.itemId))?.code?.trim() ||
                r.itemCode?.trim() ||
                getItemCode(r.itemId, assetItems);
              return (
                <span className="text-sm">
                  {nm}
                  {code ? ` — ${formatBizCodeDisplay(code)}` : ''}
                </span>
              );
            }
            const cur = r.itemId?.trim() ? String(r.itemId) : '';
            return (
              <SearchableSelect
                value={cur}
                onValueChange={v => void saveLineConsumableItem(Number(r.id), Number(v))}
                options={opts}
                placeholder="Chọn mã vật tư…"
                searchPlaceholder="Tìm mã, tên…"
                emptyText={opts.length === 0 ? 'Không có mã trên dòng này' : 'Không khớp'}
                disabled={busy}
                triggerClassName="w-full min-w-[12rem] max-w-[20rem]"
              />
            );
          }
          if (selected.status !== 'PENDING') {
            const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
            if (!eq) return <span className="text-muted-foreground">—</span>;
            const nm = getItemName(eq.itemId, assetItems);
            const code = formatEquipmentCodeDisplay(eq.equipmentCode);
            return (
              <span className="text-sm">
                {nm} — {code}
              </span>
            );
          }
          const avail = stockEquipmentsForLine(r, assetItems, equipments);
          const equipOptions = avail.map(e => ({
            value: String(e.id),
            label: `${getItemName(e.itemId, assetItems)} — ${formatEquipmentCodeDisplay(e.equipmentCode)}`,
            searchText: `${getItemName(e.itemId, assetItems)} ${e.equipmentCode} ${e.serial} ${e.itemId}`,
          }));
          const cur = r.equipmentId?.trim() ? String(r.equipmentId) : '';
          return (
            <SearchableSelect
              value={cur}
              onValueChange={v => void saveLineEquipment(Number(r.id), Number(v))}
              options={equipOptions}
              placeholder="Chọn TB tồn kho…"
              searchPlaceholder="Tìm mã, tên…"
              emptyText={avail.length === 0 ? 'Không có TB tồn kho' : 'Không khớp'}
              disabled={busy}
              triggerClassName="w-full min-w-[12rem] max-w-[20rem]"
            />
          );
        },
      },
    ];
  }, [selected, busy, assetItems, equipments, assetLinesApi, saveLineEquipment, saveLineConsumableItem, saveGroupDevicesByCatalog]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu cấp phát</h1>
        </div>
      </div>

      {listLoading ? (
        <PageLoading minHeight="min-h-[45vh]" />
      ) : (
        <>
      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={open => {
          if (!open) {
            setSelected(null);
            setDialogMode('view');
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' && !hideRowEditDelete && canEditAllocationRequestFields(selected?.status ?? '') ? (
                <>Sửa yêu cầu {selected ? formatBizCodeDisplay(selected.code) : ''}</>
              ) : (
                <>Chi tiết yêu cầu {selected ? formatBizCodeDisplay(selected.code) : ''}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <RequesterEmployeeInfo
                requesterId={selected.requesterId}
                employees={employees}
                hideLocation
                appendRows={[
                  { label: 'Ngày tạo', value: formatDate(selected.createdAt) },
                  {
                    label: 'Trạng thái',
                    value: <StatusBadge status={selected.status} label={allocationStatusLabels[selected.status]} />,
                  },
                ]}
              />
              {/* Đối tượng / lý do từ chối — không «Phòng ban trên phiếu»; giống nhau khi Xem và Sửa */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.status === 'REJECTED' && selected.rejectionReason?.trim() ? (
                  <div className="col-span-2 rounded-md border border-destructive/25 bg-destructive/5 p-3">
                    <span className="text-muted-foreground">Lý do từ chối:</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{selected.rejectionReason}</p>
                  </div>
                ) : null}
                <div className="col-span-2">
                  <span className="text-muted-foreground">Đối tượng được cấp:</span>{' '}
                  <span className="font-medium">{selected.assigneeSummary}</span>
                  {selected.assigneeType !== 'EMPLOYEE' && (
                    <span className="text-muted-foreground text-xs ml-2">({selected.assigneeType})</span>
                  )}
                </div>
              </div>
              {dialogMode === 'edit' && !hideRowEditDelete && canEditAllocationRequestFields(selected.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20 text-sm">
                  <div className="space-y-2">
                    <Label>Lý do</Label>
                    <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={3} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ghi chú</Label>
                    <Textarea value={editAttach} onChange={e => setEditAttach(e.target.value)} rows={2} disabled={busy} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" disabled={busy} onClick={() => void saveAllocationContent()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialogMode('view')}>
                      Xem (thoát sửa)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
                  {selected.attachmentNote ? (
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Đính kèm</div>
                      <AttachmentNoteView text={selected.attachmentNote} showCaption={false} />
                    </div>
                  ) : null}
                </div>
              )}
              {selected.stockIssueCode ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">Phiếu xuất kho:</span>{' '}
                  <span className="font-mono text-sm font-medium">{selected.stockIssueCode}</span>
                </div>
              ) : null}

              <DataTable
                columns={detailColumns}
                data={allocationDetailRows}
                pageSize={Math.max(1, allocationDetailRows.length)}
              />
              {selected.status === 'PENDING' && (
                <ApprovalActionBar
                  disabled={busy}
                  onApprove={() => void handleApprove()}
                  onReject={() => {
                    setRejectReason('');
                    setRejectOpen(true);
                  }}
                  onPrint={() => toast.info('In (theo template nội bộ)')}
                  onExport={() => toast.info('Xuất CSV từ bảng')}
                />
              )}
              {selected.status === 'APPROVED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    title="Tạo phiếu xuất kho, bàn giao thiết bị, trừ tồn vật tư (không cần bấm Hoàn thành trước)"
                    onClick={() => void setStatus('EXPORT_SLIP_CREATED')}
                  >
                    Ghi nhận xuất cấp phát
                  </Button>
                </div>
              )}
              {selected.status === 'EXPORT_SLIP_CREATED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void setStatus('COMPLETED')}>
                    Hoàn thành cấp phát
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={open => { setRejectOpen(open); if (!open) setRejectReason(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu cấp phát</DialogTitle>
            <DialogDescription>Nhập lý do từ chối — nhân viên sẽ xem được trong chi tiết yêu cầu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="alloc-reject-reason">Lý do từ chối</Label>
            <Textarea
              id="alloc-reject-reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Bắt buộc"
              disabled={busy}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setRejectOpen(false)}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void submitRejectAllocation()}>
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa yêu cầu cấp phát?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `Không hoàn tác. Mã: ${formatBizCodeDisplay(deleteTarget.code)}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={e => {
                e.preventDefault();
                void confirmDeleteAllocation();
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AllocationRequests;
