import { Button, Space } from "@arco-design/web-react";
import {
  IconDelete,
  IconLoop,
  IconPause,
  IconPlayArrow,
  IconSettings,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task, TaskMessageErrored, TaskState, useTaskStore } from "../../store/task";
import {
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  TaskNotFoundError,
  toMessage,
} from "../../tauri/error";
import { pauseTask, resumeTask, startTask, stopTask } from "../../tauri/task";

const StartButton = ({ task }: { task: Task }) => {
  const updateTask = useTaskStore((state) => state.updateTask);

  const start = (e: Event) => {
    e.stopPropagation();
    if (task.state !== TaskState.Idle) return;

    updateTask(task.id, { state: TaskState.Commanding });
    startTask(task.id, task.params)
      .finally(() => {
        updateTask(task.id, { state: TaskState.Running });
      })
      .catch(
        (
          err:
            | FFmpegNotFoundError
            | FFprobeNotFoundError
            | FFmpegUnavailableError
            | FFprobeUnavailableError
        ) => {
          console.error(err);
          updateTask(task.id, {
            state: TaskState.Errored,
            lastMessage: {
              state: TaskState.Errored,
              id: task.id,
              reason: toMessage({ type: err.type }),
            } as TaskMessageErrored,
          });
        }
      );
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
    if (task.state !== TaskState.Running) return;

    updateTask(task.id, { state: TaskState.Commanding });
    pauseTask(task.id)
      .catch((err: TaskNotFoundError) => {
        console.error(err);
        updateTask(task.id, {
          state: TaskState.Errored,
          lastMessage: {
            state: TaskState.Errored,
            id: task.id,
            reason: toMessage({ type: err.type }),
          } as TaskMessageErrored,
        });
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
    if (task.state !== TaskState.Pausing) return;

    updateTask(task.id, { state: TaskState.Commanding });
    resumeTask(task.id)
      .finally(() => {
        updateTask(task.id, { state: TaskState.Running });
      })
      .catch((err: TaskNotFoundError) => {
        console.error(err);
        updateTask(task.id, {
          state: TaskState.Errored,
          lastMessage: {
            state: TaskState.Errored,
            id: task.id,
            reason: toMessage({ type: err.type }),
          } as TaskMessageErrored,
        });
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
    if (task.state !== TaskState.Running) return;

    updateTask(task.id, { state: TaskState.Commanding });
    stopTask(task.id)
      .finally(() => {
        updateTask(task.id, { state: TaskState.Stopped });
      })
      .catch((err: TaskNotFoundError) => {
        console.error(err);
        updateTask(task.id, {
          state: TaskState.Errored,
          lastMessage: {
            state: TaskState.Errored,
            id: task.id,
            reason: toMessage({ type: err.type }),
          } as TaskMessageErrored,
        });
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
  if (task.lastMessage) {
    // task running
    switch (task.lastMessage.state) {
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
