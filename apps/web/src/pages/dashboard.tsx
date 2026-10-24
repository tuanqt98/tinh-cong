import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Send,
  Users,
  UserRoundCheck,
} from 'lucide-react';
import { Card, CardContent, ErrorState, PageHeader, Skeleton } from '@tinh-cong/ui';
import { formatSeconds } from '../api.js';
import { useApiQuery } from '../use-api-query.js';
interface Dashboard {
  employees: number;
  employeesWithAttendance: number;
  totalWorkedSeconds: number;
  openExceptions: number;
  pendingPeriods: number;
  publishedTimesheets: number;
  openFeedback: number;
  tierSeconds: Record<string, number>;
}
export function DashboardPage() {
  const query = useApiQuery<Dashboard>(['dashboard'], '/dashboard');
  const cards = query.data
    ? ([
        ['Tổng nhân viên', query.data.employees, Users],
        ['Có công trong kỳ', query.data.employeesWithAttendance, UserRoundCheck],
        ['Tổng giờ công', formatSeconds(query.data.totalWorkedSeconds), Clock3],
        ['Ngoại lệ mở', query.data.openExceptions, AlertTriangle],
        ['Kỳ chờ duyệt', query.data.pendingPeriods, CalendarClock],
        ['Đã phát hành', query.data.publishedTimesheets, Send],
        ['Phản hồi mở', query.data.openFeedback, CheckCircle2],
      ] as const)
    : [];
  return (
    <>
      <PageHeader
        title="Tổng quan HR"
        description="Theo dõi nhanh tình trạng chấm công và các điểm cần xử lý."
      />
      {query.isError && <ErrorState message={query.error.message} />}
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon]) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card className="mt-6">
        <CardContent>
          <h2 className="font-semibold text-navy">Phân bổ mức công</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-6">
            {['tier100', 'tier130', 'tier150', 'tier200', 'tier210', 'tier230'].map((key) => (
              <div key={key} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {key.replace('tier', '')}%
                </p>
                <p className="mt-1 text-xl font-bold">
                  {formatSeconds(query.data?.tierSeconds[key])}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
