import { Button, Space } from "@arco-design/web-react";
import {
  IconDelete,
  IconLoop,
  IconPause,
  IconPlayArrow,
  IconSettings,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task, useTaskStore } from "../../store/task";

const StartButton = ({ task }: { task: Task }) => {
  const startTask = useTaskStore((state) => state.startTask);
  const start = (e: Event) => {
    e.stopPropagation();
    startTask(task.id);
  };

  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      icon={<IconPlayArrow />}
      onClick={start}
    ></Button>
  );
};

const PauseButton = ({ task }: { task: Task }) => {
  const pauseTask = useTaskStore((state) => state.pauseTask);
  const pause = (e: Event) => {
    e.stopPropagation();
    pauseTask(task.id);
  };

  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      status="warning"
      icon={<IconPause />}
      onClick={pause}
    ></Button>
  );
};

const StopButton = ({ task }: { task: Task }) => {
  const stopTask = useTaskStore((state) => state.stopTask);
  const stop = (e: Event) => {
    e.stopPropagation();
    stopTask(task.id);
  };

  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      status="danger"
      icon={<IconStop />}
      onClick={stop}
    ></Button>
  );
};

const ResetButton = ({ task }: { task: Task }) => {
  const resetTask = useTaskStore((state) => state.resetTask);
  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      icon={<IconLoop />}
      onClick={() => resetTask(task.id)}
    ></Button>
  );
};

const RemoveButton = ({ task }: { task: Task }) => {
  const removeTask = useTaskStore((state) => state.removeTask);
  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      status="danger"
      icon={<IconDelete />}
      onClick={() => removeTask(task.id)}
    ></Button>
  );
};

const SettingsButton = () => {
  return (
    <Button
      shape="circle"
      size="mini"
      type="secondary"
      icon={<IconSettings />}
      onClick={(e) => e.stopPropagation()}
    ></Button>
  );
};

export default function Operations({ task }: { task: Task }) {
  switch (task.state.type) {
    case "Idle": {
      return (
        <Space>
          <StartButton task={task} />
          <RemoveButton task={task} />
          <SettingsButton />
        </Space>
      );
    }
    case "Commanding": {
      return <></>;
    }
    case "Queueing": {
      return (
        <Space>
          <PauseButton task={task} />
          <StopButton task={task} />
        </Space>
      );
    }
    case "Running": {
      return (
        <Space>
          <PauseButton task={task} />
          <StopButton task={task} />
        </Space>
      );
    }
    case "Pausing": {
      return (
        <Space>
          <StartButton task={task} />
          <StopButton task={task} />
        </Space>
      );
    }
    case "Stopped":
    case "Finished":
    case "Errored":
      return (
        <Space>
          <ResetButton task={task} />
          <RemoveButton task={task} />
        </Space>
      );
  }
}
