import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ArrowLeft, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ApiError, apiPatch } from '@/api/http';
import { equipmentStatusLabels, formatCurrency, calculateDepreciation } from '@/data/mockData';
import type { Equipment } from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetItems,
  useDepartments,
  useEmployees,
  useEquipment,
  useEquipmentAssignments,
  useLocations,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  buildDeviceTableRows,
  equipmentDisplayName,
  statusOrderRank,
  type DeviceTableRow,
  uiDepartmentName,
  uiEmployeeName,
  uiLocationName,
} from '@/pages/admin/assetListDeviceShared';

const AssetCatalogDevicesPage = () => {
  const rawId = useParams().itemId ?? '';
  const itemId = useMemo(() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [rawId]);

  const qc = useQueryClient();
  const iQ = useAssetItems();
  const eqQ = useEquipment();
  const assignQ = useEquipmentAssignments();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const deviceRows = useMemo(
    () => buildDeviceTableRows(eqQ.data, assignQ.data),
    [eqQ.data, assignQ.data],
  );
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const locations = locQ.data ?? [];

  const catalogItem = useMemo(() => assetItems.find(i => i.id === itemId), [assetItems, itemId]);
  const isDeviceCatalog = catalogItem == null || catalogItem.managementType === 'DEVICE';

  const rowsInCatalog = useMemo(() => {
    if (!itemId || !isDeviceCatalog) return [];
    return [...deviceRows]
      .filter(r => r.equipment.itemId === itemId)
      .sort(
        (a, b) =>
          statusOrderRank(a.equipment.status) - statusOrderRank(b.equipment.status) ||
          (a.equipment.equipmentCode || '').localeCompare(b.equipment.equipmentCode || '', undefined, { numeric: true }),
      );
  }, [deviceRows, itemId, isDeviceCatalog]);

  const catalogMissing =
    Boolean(itemId) && catalogItem == null && rowsInCatalog.length === 0 && !eqQ.isLoading;

  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<DeviceTableRow | null>(null);
  const [eqStatusBusy, setEqStatusBusy] = useState<string | null>(null);

  const changeEquipmentStatus = async (eq: Equipment, newStatus: string) => {
    if (newStatus === eq.status) return;
    if (['DISPOSED', 'LOST', 'BROKEN'].includes(newStatus)) {
      if (!window.confirm(`Xác nhận đổi trạng thái thành «${equipmentStatusLabels[newStatus]}»?`)) return;
    }
    setEqStatusBusy(eq.id);
    try {
      await apiPatch(`/api/equipment/${eq.id}`, { id: Number(eq.id), status: newStatus });
      toast.success('Đã cập nhật trạng thái thiết bị');
      setSelectedRow(prev =>
        prev && prev.equipment.id === eq.id
          ? { ...prev, equipment: { ...prev.equipment, status: newStatus as Equipment['status'] } }
          : prev,
      );
      void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
      void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được trạng thái');
    } finally {
      setEqStatusBusy(null);
    }
  };

  const columns: Column<DeviceTableRow>[] = useMemo(
    () => [
      {
        key: 'equipmentCode',
        label: 'Mã TB',
        render: r => (
          <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipment.equipmentCode)}</span>
        ),
      },
      {
        key: 'name',
        label: 'Tên thiết bị',
        render: r => <span className="font-medium">{equipmentDisplayName(r.equipment, assetItems)}</span>,
      },
      {
        key: 'serial',
        label: 'Serial',
        render: r => <span className="font-mono text-sm text-muted-foreground">{r.equipment.serial || '—'}</span>,
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: r => (
          <StatusBadge status={r.equipment.status} label={equipmentStatusLabels[r.equipment.status] ?? r.equipment.status} />
        ),
      },
      {
        key: 'originalCost',
        label: 'Nguyên giá',
        className: 'text-right',
        render: r => formatCurrency(r.equipment.originalCost),
      },
      {
        key: 'remain',
        label: 'GT còn lại',
        className: 'text-right',
        render: r => {
          const dep = calculateDepreciation(
            r.equipment.originalCost,
            r.equipment.salvageValue,
            r.equipment.depreciationMonths,
            r.equipment.capitalizedDate,
          );
          return <span className="font-medium text-primary">{formatCurrency(dep.currentValue)}</span>;
        },
      },
      {
        key: 'actions',
        label: '',
        render: r => (
          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedRow(r); }}>
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [assetItems],
  );

  const titleCode = catalogItem?.code ?? (itemId || '—');
  const titleName = catalogItem?.name ?? (catalogMissing ? 'Mặt hàng không xác định' : 'Danh mục');

  return (
    <div className="page-container">
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="w-fit -ml-2 h-8 px-2" asChild>
            <Link to="/admin/assets">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Danh sách tài sản
            </Link>
          </Button>
          <div>
            <h1 className="page-title">Chi tiết mặt hàng (thiết bị)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-mono">{titleCode}</span>
              {' — '}
              {titleName}
              {isDeviceCatalog && (
                <span className="tabular-nums"> · {rowsInCatalog.length} chiếc</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {eqQ.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {eqQ.error instanceof ApiError && eqQ.error.status === 401
            ? 'API trả 401 — chưa đăng nhập hoặc JWT hết hạn.'
            : 'Không tải được danh sách thiết bị từ API.'}
          {eqQ.error instanceof Error ? ` ${eqQ.error.message}` : ''}
        </div>
      )}

      {!itemId && (
        <p className="text-sm text-muted-foreground">Thiếu mã mặt hàng trong URL.</p>
      )}

      {itemId && catalogItem != null && !isDeviceCatalog && (
        <p className="text-sm text-muted-foreground">
          Mặt hàng này không thuộc loại thiết bị (danh mục).{' '}
          <Link to="/admin/assets" className="text-primary underline-offset-4 hover:underline">Quay lại danh sách</Link>
        </p>
      )}

      {catalogMissing && (
        <p className="text-sm text-muted-foreground">
          Không tìm thấy mặt hàng trong danh mục và không có thiết bị gắn itemId này.{' '}
          <Link to="/admin/assets" className="text-primary underline-offset-4 hover:underline">Quay lại danh sách</Link>
        </p>
      )}

      {itemId && catalogItem == null && rowsInCatalog.length > 0 && !eqQ.isLoading && (
        <p className="text-xs text-muted-foreground border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2">
          Mặt hàng không còn trong danh mục nhưng vẫn có {rowsInCatalog.length} bản ghi thiết bị gắn mã này.
        </p>
      )}

      {eqQ.isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {isDeviceCatalog && itemId && !eqQ.isLoading && !eqQ.isError && (
        <DataTable
          columns={columns}
          data={rowsInCatalog}
          currentPage={page}
          onPageChange={setPage}
          pageSize={15}
          emptyMessage="Chưa có thiết bị nào thuộc mặt hàng này."
          onRowClick={r => setSelectedRow(r)}
        />
      )}

      <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết thiết bị</DialogTitle>
          </DialogHeader>
          {selectedRow && (() => {
            const eq = selectedRow.equipment;
            const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-muted-foreground">Mã TB</div>
                  <div className="font-mono font-medium">{formatEquipmentCodeDisplay(eq.equipmentCode)}</div>
                  <div className="text-muted-foreground">Tên thiết bị</div>
                  <div>{equipmentDisplayName(eq, assetItems)}</div>
                  <div className="text-muted-foreground">Serial</div>
                  <div className="font-mono">{eq.serial || '—'}</div>
                  <div className="text-muted-foreground">Trạng thái</div>
                  <div>
                    <Select
                      value={eq.status}
                      onValueChange={v => void changeEquipmentStatus(eq, v)}
                      disabled={eqStatusBusy === eq.id}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(equipmentStatusLabels).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground">Người sử dụng</div>
                  <div>{uiEmployeeName(selectedRow, employees)}</div>
                  <div className="text-muted-foreground">Phòng ban</div>
                  <div>{uiDepartmentName(selectedRow, employees, departments)}</div>
                  <div className="text-muted-foreground">Vị trí</div>
                  <div>{uiLocationName(selectedRow, employees, locations)}</div>
                  <div className="text-muted-foreground">Nguyên giá</div>
                  <div className="text-right">{formatCurrency(eq.originalCost)}</div>
                  <div className="text-muted-foreground">GT còn lại</div>
                  <div className="text-right font-medium text-primary">{formatCurrency(dep.currentValue)}</div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetCatalogDevicesPage;
