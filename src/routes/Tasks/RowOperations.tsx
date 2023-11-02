import { Button, Space } from "@arco-design/web-react";
import {
  IconDelete,
  IconLoop,
  IconPause,
  IconPlayArrow,
  IconSettings,
  IconStop,
} from "@arco-design/web-react/icon";
import { useCallback } from "react";
import TableIconPlaceholder from "../../components/TableIconPlaceholder";
import { Task } from "../../libs/task";
import { useTaskStore } from "../../store/task";

const StartButton = ({ task }: { task: Task }) => {
  const startTask = useTaskStore((state) => state.startTask);
  const start = useCallback(
    (e: Event) => {
      e.stopPropagation();
      startTask(task.id);
    },
    [task, startTask]
  );

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
  const pause = useCallback(
    (e: Event) => {
      e.stopPropagation();
      pauseTask(task.id);
    },
    [task, pauseTask]
  );

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
  const stop = useCallback(
    (e: Event) => {
      e.stopPropagation();
      stopTask(task.id);
    },
    [task, stopTask]
  );

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
  const reset = useCallback(
    (e: Event) => {
      e.stopPropagation();
      resetTask(task.id);
    },
    [task, resetTask]
  );

  return (
    <Button shape="circle" size="mini" type="primary" icon={<IconLoop />} onClick={reset}></Button>
  );
};

const RemoveButton = ({ task }: { task: Task }) => {
  const removeTask = useTaskStore((state) => state.removeTask);
  const remove = useCallback(
    (e: Event) => {
      e.stopPropagation();
      removeTask(task.id);
    },
    [task, removeTask]
  );

  return (
    <Button
      shape="circle"
      size="mini"
      type="primary"
      status="danger"
      icon={<IconDelete />}
      onClick={remove}
    ></Button>
  );
};

const ModifyButton = ({ task, onModify }: { task: Task; onModify: (task: Task) => void }) => {
  return (
    <Button
      shape="circle"
      size="mini"
      type="secondary"
      icon={<IconSettings />}
      onClick={(e) => {
        e.stopPropagation();
        onModify(task);
      }}
    ></Button>
  );
};

export default function Operations({
  task,
  onModify,
}: {
  task: Task;
  onModify: (task: Task) => void;
}) {
  if (task.data.commanding) {
    return <></>;
  } else {
    return (
      <Space>
        {task.state.startable ? <StartButton task={task} /> : <TableIconPlaceholder />}
        {task.state.pauseable ? <PauseButton task={task} /> : <TableIconPlaceholder />}
        {task.state.stoppable ? <StopButton task={task} /> : <TableIconPlaceholder />}
        {task.state.removable ? <RemoveButton task={task} /> : <TableIconPlaceholder />}
        {task.state.resetable ? <ResetButton task={task} /> : <TableIconPlaceholder />}
        {task.state.editable ? (
          <ModifyButton task={task} onModify={onModify} />
        ) : (
          <TableIconPlaceholder />
        )}
      </Space>
    );
  }
}
