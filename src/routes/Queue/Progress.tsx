import { Progress as ProgressBar } from "@arco-design/web-react";
import { IconCheckCircle, IconMore, IconPauseCircle, IconStop } from "@arco-design/web-react/icon";
import { Task, TaskState } from "../../store/task";

export default function Progress({ task }: { task: Task }) {
  if (task.message) {
    switch (task.message.type) {
      case TaskState.Running: {
        const total = task.message.total_duration;
        const output = (task.message.output_time_ms ?? 0) / 1000000;
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
      case TaskState.Pausing:
        return <IconPauseCircle fontSize="24px" style={{ color: "orange" }} />;
      case TaskState.Stopped:
        return <IconStop fontSize="24px" style={{ color: "red" }} />;
      case TaskState.Finished:
        return <IconCheckCircle fontSize="24px" style={{ color: "green" }} />;
    }
  } else {
    return <IconMore fontSize="24px" style={{ color: "#86909C" }} />;
  }
}
