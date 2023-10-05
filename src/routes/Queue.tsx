import {
  Button,
  Modal,
  Progress as ProgressBar,
  Table,
  TableColumnProps,
} from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconInfo,
  IconLoop,
  IconMore,
  IconPause,
  IconPauseCircle,
  IconPlayArrow,
  IconStop,
} from "@arco-design/web-react/icon";
import { useMemo, useState } from "react";
import { Task, TaskState, useTaskStore } from "../store/task";
import { getMediaMetadata, pauseTask, resumeTask, startTask, stopTask } from "../tauri/task";

type TableData = {
  task: Task;
  inputs: string[];
  outputs: string[];
};

const StartButton = ({ task }: { task: Task }) => {
  const updateTask = useTaskStore((state) => state.updateTask);
  const start = () => {
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    startTask(task.id, task.params).finally(() => {
      updateTask(task.id, { commanding: false });
    });
  };

  return (
    <Button
      className="mr-2"
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
  const pause = () => {
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    pauseTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
  };

  return (
    <Button
      className="mr-2"
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
  const resume = () => {
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    resumeTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
  };

  return (
    <Button
      className="mr-2"
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
  const stop = () => {
    if (task.commanding) return;

    updateTask(task.id, { commanding: true });
    stopTask(task.id).finally(() => {
      updateTask(task.id, { commanding: false });
    });
  };

  return (
    <Button
      className="mr-2"
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
      className="mr-2"
      shape="circle"
      size="mini"
      type="primary"
      icon={<IconLoop />}
      onClick={() => resetTask(task.id)}
    ></Button>
  );
};

const InfoButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button
      className="mr-2"
      shape="circle"
      size="mini"
      type="secondary"
      icon={<IconInfo />}
      onClick={onClick}
    ></Button>
  );
};

const Operations = ({ task, onDetails }: { task: Task; onDetails: () => void }) => {
  if (task.message) {
    // task running
    switch (task.message.type) {
      case TaskState.Running: {
        return (
          <>
            <PauseButton task={task} />
            <StopButton task={task} />
            <InfoButton onClick={onDetails} />
          </>
        );
      }
      case TaskState.Pausing: {
        return (
          <>
            <ResumeButton task={task} />
            <StopButton task={task} />
            <InfoButton onClick={onDetails} />
          </>
        );
      }
      case TaskState.Stopped:
        return (
          <>
            <ResetButton task={task} />
            <InfoButton onClick={onDetails} />
          </>
        );
      case TaskState.Finished:
      default:
        return <InfoButton onClick={onDetails} />;
    }
  } else {
    // task not start
    return (
      <>
        <StartButton task={task} />
        <InfoButton onClick={onDetails} />
      </>
    );
  }
};

const Progress = ({ task }: { task: Task }) => {
  const progress = useMemo(() => {
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
  }, [task]);

  return (
    <>
      <div>{progress}</div>
    </>
  );
};

const DetailsContent = ({ taskId }: { taskId?: string }) => {
  const tasks = useTaskStore((state) => state.tasks);
  const task = useMemo(
    () => (taskId ? tasks.find((task) => task.id === taskId) : undefined),
    [tasks, taskId]
  );

  const updateTask = useTaskStore((state) => state.updateTask);

  if (!task) return <></>;

  if (task.metadata) {
    return <div>{JSON.stringify(task.metadata)}</div>;
  } else {
    if (task.metadataLoading) return <></>;

    updateTask(task.id, { metadataLoading: true });
    const promises = task.params.inputs.map((input) => getMediaMetadata(input.path));
    Promise.all(promises)
      .then((metadata) => updateTask(task.id, { metadata, metadataLoading: false }))
      .catch(() => {
        updateTask(task.id, { metadataLoading: false });
      });

    return <></>;
  }
};

const Details = ({ taskId, onClose }: { taskId?: string; onClose: () => void }) => {
  const visible = useMemo(() => !!taskId, [taskId]);

  return (
    <Modal
      title="Task Details"
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
    >
      <DetailsContent taskId={taskId} />
    </Modal>
  );
};

export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [detailsTaskId, setDetailsTaskId] = useState<undefined | string>(undefined);

  const tableCols: TableColumnProps[] = [
    {
      title: "Inputs",
      dataIndex: "inputs",
    },
    {
      title: "Outputs",
      dataIndex: "outputs",
    },
    {
      title: "Progress",
      dataIndex: "progress",
      width: "18rem",
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, record: TableData) => <Progress task={record.task} />,
    },
    {
      title: "Operations",
      dataIndex: "operations",
      fixed: "right",
      width: "12rem",
      render: (_, record: TableData) => (
        <Operations
          task={record.task}
          onDetails={() => {
            setDetailsTaskId(record.task.id);
          }}
        />
      ),
    },
  ];

  const tableData = useMemo(() => {
    return tasks.map((task) => {
      return {
        task,
        inputs: task.params.inputs.map((input) => input.path),
        outputs: task.params.outputs.map((output) => output.path ?? "NULL"),
      } as TableData;
    });
  }, [tasks]);

  return (
    <>
      {/* <div className="mb-4">
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          type="primary"
          icon={<IconPlayArrow />}
          onClick={start}
        ></Button>
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          status="warning"
          type="primary"
          icon={<IconPause />}
          onClick={transcodePaused ? resume : pause}
        ></Button>
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          status="danger"
          type="primary"
          icon={<IconRecordStop />}
          onClick={stop}
        ></Button>
      </div> */}
      <Table stripe size="small" columns={tableCols} data={tableData}></Table>
      <Details taskId={detailsTaskId} onClose={() => setDetailsTaskId(undefined)} />
    </>
  );
}
