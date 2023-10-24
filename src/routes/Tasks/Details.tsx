import { Progress as ProgressBar, Typography } from "@arco-design/web-react";
import { Task } from "../../libs/task";
import {
  Errored as ErroredState,
  Pausing as PausingState,
  Running as RunningState,
  TaskStateCode,
} from "../../libs/task/state_machine";
import { toMessage } from "../../tauri/error";
import { sumCostTime, toDuration } from "../../utils";

const Commanding = () => (
  <Typography.Text style={{ color: "rgb(var(--primary-5))" }}>Commanding</Typography.Text>
);

const Idle = () => <></>;

const Queueing = () => (
  <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>In Queue</Typography.Text>
);

const Running = ({ task }: { task: Task }) => {
  const lastMessage = (task.state as RunningState).lastMessage;

  const total = lastMessage?.total_duration ?? 0;
  const output = (lastMessage?.output_time_ms ?? 0) / 1000000;
  const percent = total === 0 ? 0 : (output / total) * 100;

  // prints eta and speed
  let etaHint = "";
  if (lastMessage?.speed) {
    const speed = lastMessage.speed;
    const eta = (total - output) / speed;
    etaHint = `ETA ${toDuration(eta, false)} ${speed.toFixed(2)}x`;
  }

  // prints total cost time
  const costHint = toDuration(sumCostTime(task.data.durations), false);

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
};

const Pausing = ({ task }: { task: Task }) => {
  const lastMessage = (task.state as PausingState).lastMessage;
  if (lastMessage) {
    const total = lastMessage.total_duration ?? 0;
    const output = (lastMessage.output_time_ms ?? 0) / 1000000;
    const percent = total === 0 ? 0 : (output / total) * 100;
    const costHint = toDuration(sumCostTime(task.data.durations), false);

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
    return <Typography.Text style={{ color: "rgb(var(--warning-6))" }}>Pausing</Typography.Text>;
  }
};

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
    {toMessage((task.state as ErroredState).reason, true)}
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
