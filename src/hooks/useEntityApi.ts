import { useQuery } from '@tanstack/react-query';
import { apiGet, PAGE_ALL } from '@/api/http';
import type {
  AllocationRequestDto,
  AllocationRequestLineDto,
  AssetGroupDto,
  AssetItemDto,
  AssetLineDto,
  AssetTypeDto,
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

export function useAssetTypes() {
  return useQuery({
    queryKey: ['api', 'asset-types'],
    queryFn: () => apiGet<AssetTypeDto[]>(`/api/asset-types?${PAGE_ALL}`),
  });
}

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
    queryFn: () => apiGet<AssetItemDto[]>(`/api/asset-items?${PAGE_ALL}`),
  });
}

/** Map API DTO → AssetItem dùng cho UI danh mục */
export function mapAssetItemDto(i: AssetItemDto): AssetItem {
  const lineId = String(i.assetLine?.id ?? '');
  const groupId = String(i.assetLine?.assetGroup?.id ?? '');
  const typeId = String(i.assetLine?.assetGroup?.assetType?.id ?? '');
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

export function useEquipment() {
  return useQuery({
    queryKey: ['api', 'equipment'],
    queryFn: () => apiGet<EquipmentDto[]>(`/api/equipment?${PAGE_ALL}`),
  });
}

export function useEquipmentAssignments() {
  return useQuery({
    queryKey: ['api', 'equipment-assignments'],
    queryFn: () => apiGet<EquipmentAssignmentDto[]>(`/api/equipment-assignments?${PAGE_ALL}`),
  });
}

/** Thiết bị + gán hiện tại (equipment-assignments chưa trả). */
export function useEnrichedEquipmentList() {
  const qe = useEquipment();
  const qa = useEquipmentAssignments();
  const list =
    qe.data && qa.data
      ? qe.data.map(e => {
          const a = qa.data!.find(x => !x.returnedDate && x.equipment?.id === e.id);
          return mapEquipmentDto(e, a);
        })
      : undefined;
  return {
    data: list,
    isLoading: qe.isLoading || qa.isLoading,
    isError: qe.isError || qa.isError,
    error: qe.error ?? qa.error,
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
      const rows = await apiGet<ConsumableStockDto[]>(`/api/consumable-stocks?${PAGE_ALL}`);
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
