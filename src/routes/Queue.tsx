import { Button, Progress as ProgressBar, Table, TableColumnProps } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconMore,
  IconPause,
  IconPauseCircle,
  IconPlayArrow,
  IconStop,
} from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { Task, TaskState, useTaskStore } from "../store/task";
import { pauseTask, resumeTask, startTask, stopTask } from "../tauri/task";

type TableData = {
  task: Task;
  inputs: string[];
  outputs: string[];
};

const StartButton = ({ onClick }: { onClick: () => Promise<void> }) => {
  return (
    <Button
      className="mr-2"
      shape="circle"
      size="mini"
      type="primary"
      icon={<IconPlayArrow />}
      onClick={onClick}
    ></Button>
  );
};

const PauseButton = ({ onClick }: { onClick: () => Promise<void> }) => {
  return (
    <Button
      className="mr-2"
      shape="circle"
      size="mini"
      type="primary"
      status="warning"
      icon={<IconPause />}
      onClick={onClick}
    ></Button>
  );
};

const StopButton = ({ onClick }: { onClick: () => Promise<void> }) => {
  return (
    <Button
      className="mr-2"
      shape="circle"
      size="mini"
      type="primary"
      status="danger"
      icon={<IconStop />}
      onClick={onClick}
    ></Button>
  );
};

const Operations = ({ task }: { task: Task }) => {
  if (task.message) {
    switch (task.message.type) {
      case TaskState.Running: {
        const pause = async () => {
          await pauseTask(task.id);
        };
        const stop = async () => {
          await stopTask(task.id);
        };

        return (
          <>
            <PauseButton onClick={pause} />
            <StopButton onClick={stop} />
          </>
        );
      }
      case TaskState.Pausing: {
        const resume = async () => {
          await resumeTask(task.id);
        };
        const stop = async () => {
          await stopTask(task.id);
        };

        return (
          <>
            <StartButton onClick={resume} />
            <StopButton onClick={stop} />
          </>
        );
      }
      default:
        return <></>;
    }
  } else {
    const start = async () => {
      // await getMediaMetadata(task.params.inputs.)
      await startTask(task.id, task.params);
    };

    return <StartButton onClick={start} />;
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

export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

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
      render: (_, record: TableData) => <Operations task={record.task} />,
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
    </>
  );
}
