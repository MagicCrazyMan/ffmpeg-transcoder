import { Progress as ProgressBar, Typography } from "@arco-design/web-react";
import { Task } from "../../store/task";
import { sumCostTime, toDuration } from "../../utils";

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

      // prints eta and speed
      let etaHint = "";
      if (task.state.message.speed) {
        const speed = task.state.message.speed;
        const eta = (total - output) / speed;
        etaHint = `ETA ${toDuration(eta, false)} ${speed.toFixed(2)}x`;
      }

      // prints total cost time
      const costHint = toDuration(sumCostTime(task.workTimeDurations), false);

      return (
        <div>
          <ProgressBar
            animation
            className="my-1"
            strokeWidth={20}
            percent={percent}
            formatText={(percent) => `${percent.toFixed(2)}%`}
          />
          <div style={{ color: "var(--color-text-2)" }}>
            {costHint} {etaHint}
          </div>
        </div>
      );
    }
    case "Pausing": {
      if (task.state.lastRunningMessage) {
        const msg = task.state.lastRunningMessage;
        const total = msg.total_duration;
        const output = (msg.output_time_ms ?? 0) / 1000000;
        const percent = (output / total) * 100;
        const costHint = toDuration(sumCostTime(task.workTimeDurations), false);

        return (
          <div>
            <ProgressBar
              status="warning"
              className="my-1"
              strokeWidth={20}
              percent={percent}
              formatText={(percent) => `${percent.toFixed(2)}%`}
            />
            <div style={{ color: "var(--color-text-2)" }}>{costHint}</div>
          </div>
        );
      } else {
        return (
          <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>Pausing</Typography.Text>
        );
      }
    }
    case "Stopped": {
      const costHint = toDuration(sumCostTime(task.workTimeDurations), false);
      return (
        <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>Cost {costHint}</Typography.Text>
      );
    }
    case "Finished": {
      const costHint = toDuration(sumCostTime(task.workTimeDurations), false);
      return (
        <Typography.Text style={{ color: "rgb(var(--success-6))" }}>
          Cost {costHint}
        </Typography.Text>
      );
    }
    case "Errored":
      return (
        <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>
          {task.state.reason}
        </Typography.Text>
      );
  }
}
