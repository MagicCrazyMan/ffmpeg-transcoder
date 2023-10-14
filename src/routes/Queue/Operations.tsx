import { Button, Space } from "@arco-design/web-react";
import {
  IconDelete,
  IconLoop,
  IconPause,
  IconPlayArrow,
  IconSettings,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task, TaskState, useTaskStore } from "../../store/task";
import { pauseTask, resumeTask, startTask, stopTask } from "../../tauri/task";

const StartButton = ({ task }: { task: Task }) => {
  const updateTask = useTaskStore((state) => state.updateTask);

  const start = (e: Event) => {
    e.stopPropagation();
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    startTask(task.id, task.params).finally(() => {
      updateTask(task.id, { commanding: false });
    });
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
  const updateTask = useTaskStore((state) => state.updateTask);

  const pause = (e: Event) => {
    e.stopPropagation();
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    pauseTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
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

const ResumeButton = ({ task }: { task: Task }) => {
  const updateTask = useTaskStore((state) => state.updateTask);

  const resume = (e: Event) => {
    e.stopPropagation();
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    resumeTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
  };

  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      icon={<IconPlayArrow />}
      onClick={resume}
    ></Button>
  );
};

const StopButton = ({ task }: { task: Task }) => {
  const updateTask = useTaskStore((state) => state.updateTask);
  const stop = (e: Event) => {
    e.stopPropagation();
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    stopTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
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
  if (task.message) {
    // task running
    switch (task.message.type) {
      case TaskState.Running: {
        return (
          <Space>
            <PauseButton task={task} />
            <StopButton task={task} />
            <SettingsButton />
          </Space>
        );
      }
      case TaskState.Pausing: {
        return (
          <Space>
            <ResumeButton task={task} />
            <StopButton task={task} />
            <SettingsButton />
          </Space>
        );
      }
      case TaskState.Stopped:
        return (
          <Space>
            <ResetButton task={task} />
            <RemoveButton task={task} />
            <SettingsButton />
          </Space>
        );
      case TaskState.Finished:
      default:
        return (
          <Space>
            <RemoveButton task={task} />
            <SettingsButton />
          </Space>
        );
    }
  } else {
    // task not start
    return (
      <Space>
        <StartButton task={task} />
        <RemoveButton task={task} />
        <SettingsButton />
      </Space>
    );
  }
}
