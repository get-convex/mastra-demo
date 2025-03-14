import { formatDate } from 'date-fns';
import { RefreshCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useLogsByRunId } from '@/hooks/use-logs';

export function WorkflowLogs({ runId }: { runId: string }) {
  const { logs, isLoading, refetchLogs } = useLogsByRunId(runId);

  return (
    <ScrollArea className="h-[calc(100vh-126px)] px-4 pb-4 text-xs w-full">
      <div className="flex justify-end sticky top-0 py-2">
        <Button variant="outline" onClick={() => refetchLogs(runId)}>
          {isLoading ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />}
        </Button>
      </div>
      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-gray-300/60">
            No log drains. By default, logs are sent to the console. To configure log drains see{' '}
            <a
              href="https://mastra.ai/docs/reference/observability/create-logger#upstash-logger-remote-log-drain"
              target="_blank"
              rel="noopener"
              className=" hover:text-gray-100 underline"
            >
              docs.
            </a>
          </p>
        ) : (
          logs.map((log, idx) => {
            return (
              <div key={idx} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <p className="text-mastra-el-5">[{formatDate(new Date(log.time), 'yyyy-MM-dd HH:mm:ss')}]</p>
                  <p className="text-mastra-el-4">[{log.level}]</p>
                </div>
                <p className="text-mastra-el-5 whitespace-pre-wrap">
                  <code>{log.msg}</code>
                </p>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
