import {
  Button,
  Progress as ProgressBar,
  Space,
  Table,
  TableColumnProps,
  Tooltip,
} from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconDown,
  IconMore,
  IconNav,
  IconPauseCircle,
  IconRight,
  IconStop,
} from "@arco-design/web-react/icon";
import { useState } from "react";
import { Task, TaskInputParams, TaskOutputParams, TaskState, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import Operations from "./Operations";
import Settings from "./Settings";

/**
 * Inputs & Outputs files list component
 */
const FilesList = ({ params }: { params: (TaskInputParams | TaskOutputParams)[] }) => {
  if (params.length === 1) {
    return <div>{params[0].path ?? "NULL"}</div>;
  } else {
    const paths = params.map((input, index) => <li key={index}>{input.path ?? "NULL"}</li>);
    return <ul className="list-disc list-inside">{paths}</ul>;
  }
};

const Progress = ({ task }: { task: Task }) => {
  if (task.lastMessage) {
    switch (task.lastMessage.state) {
      case TaskState.Running: {
        const total = task.lastMessage.total_duration;
        const output = (task.lastMessage.output_time_ms ?? 0) / 1000000;
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
};

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [taskEditorVisible, setTaskEditorVisible] = useState(false);

  const tableCols: TableColumnProps<Task>[] = [
    {
      title: "Inputs",
      render: (_, record) => <FilesList params={record.params.inputs} />,
    },
    {
      title: "Outputs",
      render: (_, record) => <FilesList params={record.params.outputs} />,
    },
    {
      title: "Progress",
      width: "12rem",
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, record) => <Progress task={record} />,
    },
    {
      title: "Operations",
      fixed: "right",
      align: "center",
      width: "10rem",
      render: (_, record) => <Operations task={record} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Buttons */}
      <Space>
        {/* Add Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            type="primary"
            icon={<IconNav />}
            onClick={() => setTaskEditorVisible(true)}
          ></Button>
        </Tooltip>
      </Space>

      {/* Tasks Table */}
      <Table
        stripe
        pagination={false}
        size="mini"
        rowKey="id"
        columns={tableCols}
        data={tasks}
        expandedRowRender={(record) => <Settings task={record} />}
        expandProps={{
          icon: ({ expanded, ...restProps }) =>
            expanded ? (
              <button {...restProps}>
                <IconDown />
              </button>
            ) : (
              <button {...restProps}>
                <IconRight />
              </button>
            ),
          expandRowByClick: true,
        }}
      ></Table>

      {/* Complex Task Editor Dialog */}
      <ComplexTaskEditor
        visible={taskEditorVisible}
        onVisibleChange={(visible) => setTaskEditorVisible(visible)}
      ></ComplexTaskEditor>

      {/* Model Displaying Task Details */}
      {/* <Details onClosed={() => setDetailsTaskId(undefined)} taskId={detailsTaskId}></Details> */}
    </div>
  );
}
