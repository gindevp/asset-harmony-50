import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { apiPost, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
import type { Equipment } from '@/data/mockData';
import { filterEquipmentWithDepartmentPeers } from '@/utils/myEquipment';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { useEmployees, useEnrichedEquipmentList } from '@/hooks/useEntityApi';
import { requestsListPath } from './requestNewPaths';

function requireEmployeeId(): number | null {
  const id = resolveEmployeeIdForRequests();
  const n = id != null ? Number(id) : NaN;
  if (!Number.isFinite(n)) {
    toast.error('Tài khoản chưa liên kết nhân viên. Admin: Quản lý user → gán nhân viên cho tài khoản đăng nhập.');
    return null;
  }
  return n;
}

export default function RequestNewReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('return', isAdminArea);

  const eqQ = useEnrichedEquipmentList();
  const allEmpQ = useEmployees();
  const equipments = eqQ.data ?? [];
  const myEmpIdStr = resolveEmployeeIdForRequests();
  const myDeptIdStr = useMemo(() => {
    if (!myEmpIdStr || !allEmpQ.data) return null;
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    return me?.department?.id != null ? String(me.department.id) : null;
  }, [myEmpIdStr, allEmpQ.data]);
  const myLocIdStr = resolveEmployeeLocationIdForRequests();

  const deptPeerIds = useMemo(() => {
    if (!myDeptIdStr || !allEmpQ.data) return [] as string[];
    return allEmpQ.data
      .filter(e => String(e.department?.id ?? '') === myDeptIdStr)
      .map(e => String(e.id ?? ''));
  }, [myDeptIdStr, allEmpQ.data]);

  const isDeptCoordinator = hasAnyAuthority(getStoredToken(), ['ROLE_DEPARTMENT_COORDINATOR']);

  const myEquipment: Equipment[] = useMemo(
    () =>
      filterEquipmentWithDepartmentPeers(
        equipments,
        myEmpIdStr,
        myDeptIdStr,
        myLocIdStr,
        isDeptCoordinator ? deptPeerIds : [],
      ),
    [equipments, myEmpIdStr, myDeptIdStr, myLocIdStr, isDeptCoordinator, deptPeerIds],
  );

  const [retNote, setRetNote] = useState('');
  const [retSelected, setRetSelected] = useState<Record<string, boolean>>({});
  const [retBusy, setRetBusy] = useState(false);
  const toggleRet = (id: string) => setRetSelected(p => ({ ...p, [id]: !p[id] }));

  const submitReturn = async () => {
    const ids = Object.entries(retSelected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return toast.error('Chọn ít nhất một thiết bị');
    const retEid = requireEmployeeId();
    if (retEid == null) return;
    setRetBusy(true);
    try {
      const created = await apiPost<{ id: number }>('/api/return-requests', {
        code: makeBizCode('RT'),
        requestDate: new Date().toISOString(),
        note: retNote.trim() || undefined,
        status: 'PENDING',
        requester: { id: retEid },
      });
      let lineNo = 1;
      for (const eqId of ids) {
        const eq = myEquipment.find(e => e.id === eqId);
        if (!eq) continue;
        await apiPost('/api/return-request-lines', {
          lineNo: lineNo++,
          lineType: 'DEVICE',
          quantity: 1,
          selected: true,
          request: { id: created.id },
          equipment: { id: Number(eqId) },
          assetItem: { id: Number(eq.itemId) },
        });
      }
      toast.success('Đã gửi yêu cầu thu hồi');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(backTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setRetBusy(false);
    }
  };

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="space-y-2 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="page-title">Tạo yêu cầu thu hồi</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-5xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu thu hồi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {myEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị đang gán.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={retNote} onChange={e => setRetNote(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto border rounded-md p-2">
                {myEquipment.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input type="checkbox" checked={!!retSelected[e.id]} onChange={() => toggleRet(e.id)} />
                    <span className="font-mono">{formatEquipmentCodeDisplay(e.equipmentCode)}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" asChild disabled={retBusy}>
                  <Link to={backTo}>Hủy</Link>
                </Button>
                <Button onClick={() => void submitReturn()} disabled={retBusy || myEquipment.length === 0}>
                  {retBusy ? 'Đang gửi…' : 'Gửi'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
