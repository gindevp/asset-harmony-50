import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, PAGE_ALL } from '@/api/http';
import type {
  AllocationRequestDto,
  AllocationRequestLineDto,
  AssetGroupDto,
  AssetItemDto,
  AssetLineDto,
  ConsumableStockDto,
  DepartmentDto,
  EmployeeDto,
  EquipmentAssignmentDto,
  EquipmentDto,
  LocationDto,
  RepairRequestDto,
  ReturnRequestDto,
  ReturnRequestLineDto,
  StockIssueDto,
  StockIssueLineDto,
  StockReceiptDto,
  StockReceiptLineDto,
  SupplierDto,
} from '@/api/types';
import {
  buildAllocationRequests,
  buildReturnRequests,
  buildStockIns,
  buildStockOuts,
  mapConsumableStockDto,
  mapEquipmentDto,
  mapRepairDto,
} from '@/api/viewModels';
import type { AssetItem } from '@/data/mockData';
import { pickAssignmentForEquipment } from '@/utils/equipmentJoin';

export function useDepartments() {
  return useQuery({
    queryKey: ['api', 'departments'],
    queryFn: () => apiGet<DepartmentDto[]>(`/api/departments?${PAGE_ALL}`),
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ['api', 'employees'],
    queryFn: () => apiGet<EmployeeDto[]>(`/api/employees?${PAGE_ALL}`),
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['api', 'locations'],
    queryFn: () => apiGet<LocationDto[]>(`/api/locations?${PAGE_ALL}`),
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['api', 'suppliers'],
    queryFn: () => apiGet<SupplierDto[]>(`/api/suppliers?${PAGE_ALL}`),
  });
}

// AssetType table has been removed; use enum Asssettype instead.

export function useAssetGroups() {
  return useQuery({
    queryKey: ['api', 'asset-groups'],
    queryFn: () => apiGet<AssetGroupDto[]>(`/api/asset-groups?${PAGE_ALL}`),
  });
}

export function useAssetLines() {
  return useQuery({
    queryKey: ['api', 'asset-lines'],
    queryFn: () => apiGet<AssetLineDto[]>(`/api/asset-lines?${PAGE_ALL}`),
  });
}

export function useAssetItems() {
  return useQuery({
    queryKey: ['api', 'asset-items'],
    queryFn: async () => {
      const raw = await apiGet<unknown>(`/api/asset-items?${PAGE_ALL}`);
      return normalizeListResponse<AssetItemDto>(raw);
    },
  });
}

/** Map API DTO → AssetItem dùng cho UI danh mục */
export function mapAssetItemDto(i: AssetItemDto): AssetItem {
  const lineId = String(i.assetLine?.id ?? '');
  const groupId = String(i.assetLine?.assetGroup?.id ?? '');
  const rawType = String(i.assetLine?.assetType ?? i.assetLine?.assetGroup?.assetType ?? '')
    .trim()
    .toUpperCase();
  const typeId: AssetItem['managementType'] = rawType === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEVICE';
  return {
    id: String(i.id),
    code: i.code ?? '',
    name: i.name ?? '',
    managementType: (i.managementType ?? 'DEVICE') as AssetItem['managementType'],
    unit: i.unit ?? '',
    lineId,
    groupId,
    typeId,
    enableDepreciation: Boolean(i.depreciationEnabled),
    enableSerial: Boolean(i.serialTrackingRequired),
    description: i.note ?? '',
  };
}

/** Một số proxy/BE có thể trả Spring Page `{ content: [] }` thay vì mảng thuần — tránh .map lỗi / list trống sai. */
export function normalizeListResponse<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown }).content)) {
    return (raw as { content: T[] }).content;
  }
  if (raw != null && typeof raw !== 'object') {
    console.warn('[useEntityApi] Expected JSON array for list API, got', typeof raw);
  }
  return [];
}

export function useEquipment() {
  return useQuery({
    queryKey: ['api', 'equipment'],
    queryFn: async () => {
      const raw = await apiGet<unknown>(`/api/equipment?${PAGE_ALL}`);
      return normalizeListResponse<EquipmentDto>(raw);
    },
  });
}

export function useEquipmentAssignments() {
  return useQuery({
    queryKey: ['api', 'equipment-assignments'],
    /** BE trả toàn bộ list, không phân trang — tránh tham số page/size thừa */
    queryFn: async () => {
      const raw = await apiGet<unknown>('/api/equipment-assignments');
      return normalizeListResponse<EquipmentAssignmentDto>(raw);
    },
  });
}

/** Thiết bị + gán hiện tại (equipment-assignments chưa trả — ưu tiên bản ghi id lớn nhất).
 *  Ghép theo equipmentId (FK phẳng từ BE) hoặc equipmentCode — tránh lỗi khi object equipment lồng nhau thiếu id.
 *  Nếu assignments lỗi/chưa có, vẫn hiển thị thiết bị (chưa gán). */
export function useEnrichedEquipmentList() {
  const qe = useEquipment();
  const qa = useEquipmentAssignments();
  const list = useMemo(() => {
    if (qe.data == null) return undefined;
    const assigns = qa.data ?? [];
    return qe.data.map(e => mapEquipmentDto(e, pickAssignmentForEquipment(e, assigns)));
  }, [qe.data, qa.data]);
  return {
    data: list,
    isLoading: qe.isLoading,
    isError: qe.isError,
    error: qe.error,
    refetch: () => {
      void qe.refetch();
      void qa.refetch();
    },
  };
}

export function useConsumableStocksView() {
  return useQuery({
    queryKey: ['api', 'consumable-stocks-view'],
    queryFn: async () => {
      const raw = await apiGet<unknown>(`/api/consumable-stocks?${PAGE_ALL}`);
      const rows = normalizeListResponse<ConsumableStockDto>(raw);
      return rows.map(mapConsumableStockDto);
    },
  });
}

export function useStockInsView() {
  return useQuery({
    queryKey: ['api', 'stock-ins-view'],
    queryFn: async () => {
      const [receipts, lines] = await Promise.all([
        apiGet<StockReceiptDto[]>(`/api/stock-receipts?${PAGE_ALL}`),
        apiGet<StockReceiptLineDto[]>(`/api/stock-receipt-lines?${PAGE_ALL}`),
      ]);
      return buildStockIns(receipts, lines);
    },
  });
}

export function useStockOutsView() {
  return useQuery({
    queryKey: ['api', 'stock-outs-view'],
    queryFn: async () => {
      const [issues, lines] = await Promise.all([
        apiGet<StockIssueDto[]>(`/api/stock-issues?${PAGE_ALL}`),
        apiGet<StockIssueLineDto[]>(`/api/stock-issue-lines?${PAGE_ALL}`),
      ]);
      return buildStockOuts(issues, lines);
    },
  });
}

export function useAllocationRequestsView() {
  return useQuery({
    queryKey: ['api', 'allocation-requests-view'],
    queryFn: async () => {
      const [reqs, lines] = await Promise.all([
        apiGet<AllocationRequestDto[]>(`/api/allocation-requests?${PAGE_ALL}`),
        apiGet<AllocationRequestLineDto[]>(`/api/allocation-request-lines?${PAGE_ALL}`),
      ]);
      return buildAllocationRequests(reqs, lines);
    },
  });
}

export function useRepairRequestsView() {
  return useQuery({
    queryKey: ['api', 'repair-requests-view'],
    queryFn: async () => {
      const rows = await apiGet<RepairRequestDto[]>(`/api/repair-requests?${PAGE_ALL}`);
      return rows.map(mapRepairDto);
    },
  });
}

export function useReturnRequestsView() {
  return useQuery({
    queryKey: ['api', 'return-requests-view'],
    queryFn: async () => {
      const [reqs, lines] = await Promise.all([
        apiGet<ReturnRequestDto[]>(`/api/return-requests?${PAGE_ALL}`),
        apiGet<ReturnRequestLineDto[]>(`/api/return-request-lines?${PAGE_ALL}`),
      ]);
      return buildReturnRequests(reqs, lines);
    },
  });
}
