import { Progress as ProgressBar, Spin } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconCloseCircle,
  IconMore,
  IconPauseCircle,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task } from "../../store/task";

export default function Progress({ task }: { task: Task }) {
  switch (task.state.type) {
    case "Idle":
      return <></>;
    case "Commanding":
      return <Spin size={24}></Spin>;
    case "Queueing":
      return <IconMore fontSize="24px" style={{ color: "rgb(var(--warning-6))" }} />;
    case "Running": {
      const total = task.state.message.total_duration;
      const output = (task.state.message.output_time_ms ?? 0) / 1000000;
      const percent = (output / total) * 100;
      return (
        <ProgressBar
          animation
          percent={percent}
          strokeWidth={20}
          formatText={(percent) => `${percent.toFixed(2)}%`}
        />
      );
    }
    case "Pausing":
      if (task.state.lastRunningMessage) {
        const msg = task.state.lastRunningMessage;
        const total = msg.total_duration;
        const output = (msg.output_time_ms ?? 0) / 1000000;
        const percent = (output / total) * 100;

        return (
          <div className="flex gap-2">
            <ProgressBar
              animation
              status="warning"
              percent={percent}
              strokeWidth={20}
              formatText={(percent) => `${percent.toFixed(2)}%`}
            />
          </div>
        );
      } else {
        return <IconPauseCircle fontSize="24px" style={{ color: "rgb(var(--warning-6))" }} />;
      }
    case "Stopped":
      return <IconStop fontSize="24px" style={{ color: "rgb(var(--danger-6))" }} />;
    case "Finished":
      return <IconCheckCircle fontSize="24px" style={{ color: "rgb(var(--success-6))" }} />;
    case "Errored":
      return <IconCloseCircle fontSize="24px" style={{ color: "rgb(var(--danger-6))" }} />;
  }
}
