import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LossReportCreateForm } from '@/components/shared/LossReportCreateForm';
import { requestsListPath } from './requestNewPaths';

/** `navigate(..., { state })` từ «Tài sản của tôi» hoặc mở rộng sau này */
export type RequestNewLossLocationState = {
  initialKind?: 'EQUIPMENT' | 'CONSUMABLE';
  initialEquipmentId?: string;
  initialConsumableAssetItemId?: string;
  /** Quay lại / Hủy — chỉ chấp nhận path cùng khu vực admin|employee */
  backTo?: string;
};

function safeBackTo(
  candidate: string | undefined,
  isAdminArea: boolean,
  fallback: string,
): string {
  if (!candidate?.startsWith('/')) return fallback;
  const ok = isAdminArea ? candidate.startsWith('/admin') : candidate.startsWith('/employee');
  return ok ? candidate : fallback;
}

export default function RequestNewLoss() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/admin');
  const defaultList = requestsListPath('loss', isAdminArea);
  const st = (location.state ?? null) as RequestNewLossLocationState | null;
  const backTo = safeBackTo(st?.backTo, isAdminArea, defaultList);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="space-y-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit"
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại danh sách
          </Button>
          <h1 className="page-title">Tạo yêu cầu báo mất</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu báo mất</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LossReportCreateForm
            backTo={backTo}
            onCancelClick={() => setCancelConfirmOpen(true)}
            onSuccess={() => navigate(backTo)}
            initialKind={st?.initialKind}
            initialEquipmentId={st?.initialEquipmentId}
            initialConsumableAssetItemId={st?.initialConsumableAssetItemId}
          />
        </CardContent>
      </Card>
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
            <AlertDialogDescription>Mọi thay đổi sẽ mất.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(backTo)}>Thoát</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
