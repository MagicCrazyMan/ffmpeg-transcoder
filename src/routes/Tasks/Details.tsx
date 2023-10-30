import { Progress, Typography } from "@arco-design/web-react";
import { Task } from "../../libs/task";
import { TaskMessageRunning } from "../../libs/task/message";
import {
  Errored as ErroredState,
  Running as RunningState,
  TaskStateCode,
} from "../../libs/task/state_machine";
import { sumCostTime, toDuration } from "../../libs/utils";

const ProgressBar = ({
  task,
  pausing,
  message,
}: {
  task: Task;
  pausing?: boolean;
  message?: TaskMessageRunning;
}) => {
  if (!message)
    return <Typography.Text style={{ color: "rgb(var(--primary-5))" }}>Preparing</Typography.Text>;

  switch (message.progress_type.type) {
    case "Unspecified":
      return (
        <Progress
          animation={pausing ? false : true}
          status={pausing ? "warning" : "normal"}
          className="my-1"
          strokeWidth={20}
          percent={100}
        />
      );
    case "ByDuration": {
      const duration = message.progress_type.duration;
      const output_duration = (message.output_time_ms ?? 0) / 1000000;
      const percent = duration === 0 ? 0 : (output_duration / duration) * 100;

      // prints eta and speed
      let etaHint = "";
      if (message.speed) {
        const speed = message.speed;
        const eta = (duration - output_duration) / speed;
        etaHint = `ETA ${toDuration(eta, false)} ${speed.toFixed(2)}x`;
      }

      // prints total cost time
      const costHint = toDuration(sumCostTime(task.data.durations), false);

      return (
        <div>
          <Progress
            animation={pausing ? false : true}
            status={pausing ? "warning" : "normal"}
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
    case "ByFileSize": {
      const size = message.progress_type.size;
      const output_size = message.total_size ?? 0;
      const percent = size === 0 ? 0 : (output_size / size) * 100;

      // prints speed
      const speedHint = message.speed ? `${message.speed.toFixed(2)}x` : "";
      // prints total cost time
      const costHint = toDuration(sumCostTime(task.data.durations), false);

      return (
        <div>
          <Progress
            animation={pausing ? false : true}
            status={pausing ? "warning" : "normal"}
            className="my-1"
            strokeWidth={20}
            percent={percent}
            formatText={(percent) => `${percent.toFixed(2)}%`}
          />
          <div style={{ color: "var(--color-text-2)" }}>
            {costHint} {speedHint}
          </div>
        </div>
      );
    }
    case "Auto": {
      // for auto progress, prints the largest percentage
      const file_size = message.progress_type.file_size;
      const output_file_size = message.total_size ?? 0;
      const file_percent = file_size === 0 ? 0 : (output_file_size / file_size) * 100;

      const duration = message.progress_type.duration;
      const output_duration = (message.output_time_ms ?? 0) / 1000000;
      const duration_percent = duration === 0 ? 0 : (output_duration / duration) * 100;

      const percent = Math.max(file_percent, duration_percent);

      // prints speed
      const speedHint = message.speed ? `${message.speed.toFixed(2)}x` : "";
      // prints total cost time
      const costHint = toDuration(sumCostTime(task.data.durations), false);

      return (
        <div>
          <Progress
            animation={pausing ? false : true}
            status={pausing ? "warning" : "normal"}
            className="my-1"
            strokeWidth={20}
            percent={percent}
            formatText={(percent) => `${percent.toFixed(2)}%`}
          />
          <div style={{ color: "var(--color-text-2)" }}>
            {costHint} {speedHint}
          </div>
        </div>
      );
    }
  }
};

const Commanding = () => (
  <Typography.Text style={{ color: "rgb(var(--primary-5))" }}>Commanding</Typography.Text>
);

const Idle = () => <></>;

const Queueing = () => (
  <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>In Queue</Typography.Text>
);

const Running = ({ task }: { task: Task }) => (
  <ProgressBar task={task} message={(task.state as RunningState).lastMessage} />
);

const Pausing = ({ task }: { task: Task }) => (
  <ProgressBar pausing task={task} message={(task.state as RunningState).lastMessage} />
);

const Stopped = ({ task }: { task: Task }) => {
  const costHint = toDuration(sumCostTime(task.data.durations), false);
  return (
    <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>Cost {costHint}</Typography.Text>
  );
};

const Finished = ({ task }: { task: Task }) => {
  const costHint = toDuration(sumCostTime(task.data.durations), false);
  return (
    <Typography.Text style={{ color: "rgb(var(--success-6))" }}>Cost {costHint}</Typography.Text>
  );
};

const Errored = ({ task }: { task: Task }) => (
  <Typography.Text style={{ color: "rgb(var(--danger-6))" }}>
    {(task.state as ErroredState).reason}
  </Typography.Text>
);

export default function Details({ task }: { task: Task }) {
  if (task.data.commanding) {
    return <Commanding />;
  }

  switch (task.state.code) {
    case TaskStateCode.Idle:
      return <Idle />;
    case TaskStateCode.Queueing:
      return <Queueing />;
    case TaskStateCode.Running:
      return <Running task={task} />;
    case TaskStateCode.Pausing:
      return <Pausing task={task} />;
    case TaskStateCode.Stopped:
      return <Stopped task={task} />;
    case TaskStateCode.Finished:
      return <Finished task={task} />;
    case TaskStateCode.Errored:
      return <Errored task={task} />;
  }
}
