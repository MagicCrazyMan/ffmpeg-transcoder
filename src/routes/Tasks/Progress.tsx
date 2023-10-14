import { Progress as ProgressBar, Typography } from "@arco-design/web-react";
import { Task } from "../../store/task";
import { toDuration } from "../../utils";

export default function Progress({ task }: { task: Task }) {
  switch (task.state.type) {
    case "Idle":
      return <Typography.Text>Idle</Typography.Text>;
    case "Commanding":
      return (
        <Typography.Text style={{ color: "rgb(var(--primary-5))" }}>Commanding</Typography.Text>
      );
    case "Queueing":
      return <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>In Queue</Typography.Text>;
    case "Running": {
      const total = task.state.message.total_duration;
      const output = (task.state.message.output_time_ms ?? 0) / 1000000;
      const percent = (output / total) * 100;

      let hint = "";
      if (task.state.message.speed) {
        const speed = task.state.message.speed;
        const eta = (total - output) / speed;
        hint = `${speed.toFixed(2)}x ${toDuration(eta, false)}`;
      }
      return (
        <div>
          <ProgressBar
            animation
            percent={percent}
            strokeWidth={20}
            formatText={(percent) => `${percent.toFixed(2)}%`}
          />
          <div style={{ color: "var(--color-text-2)" }}>{hint}</div>
        </div>
      );
    }
    case "Pausing":
      if (task.state.lastRunningMessage) {
        const msg = task.state.lastRunningMessage;
        const total = msg.total_duration;
        const output = (msg.output_time_ms ?? 0) / 1000000;
        const percent = (output / total) * 100;

        return (
          <ProgressBar
            status="warning"
            percent={percent}
            strokeWidth={20}
            formatText={(percent) => `${percent.toFixed(2)}%`}
          />
        );
      } else {
        return (
          <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>Pausing</Typography.Text>
        );
      }
    case "Stopped":
      return <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>Stopped</Typography.Text>;
    case "Finished":
      return <Typography.Text style={{ color: "rgb(var(--success-6))" }}>Finished</Typography.Text>;
    case "Errored":
      return (
        <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>
          {task.state.reason}
        </Typography.Text>
      );
  }
}
