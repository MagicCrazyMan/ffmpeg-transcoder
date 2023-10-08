import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDown, IconNav, IconRight } from "@arco-design/web-react/icon";
import { useMemo, useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import Operations from "./Operations";
import Progress from "./Progress";
import Settings from "./Settings";

type TableData = {
  key: string;
  task: Task;
  inputs: string[];
  outputs: string[];
};

export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [taskEditorVisible, setTaskEditorVisible] = useState(false);

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
        key: task.id,
        task,
        inputs: task.params.inputs.map((input) => input.path),
        outputs: task.params.outputs.map((output) => output.path ?? "NULL"),
      } as TableData;
    });
  }, [tasks]);

  return (
    <>
      {/* Buttons */}
      <Space className="mb-4">
        {/* Add Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            className="mr-2"
            shape="circle"
            size="small"
            type="primary"
            icon={<IconNav />}
            onClick={() => setTaskEditorVisible(true)}
          ></Button>
        </Tooltip>
        {/* <Button
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
        ></Button> */}
      </Space>

      {/* Tasks Table */}
      <Table
        stripe
        pagination={false}
        size="mini"
        columns={tableCols}
        data={tableData}
        expandedRowRender={(record) => <Settings task={record.task} />}
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

      {/* Complex Task Editor */}
      <ComplexTaskEditor
        visible={taskEditorVisible}
        onVisibleChanged={(visible) => setTaskEditorVisible(visible)}
      ></ComplexTaskEditor>

      {/* Model Displaying Task Details */}
      {/* <Details onClosed={() => setDetailsTaskId(undefined)} taskId={detailsTaskId}></Details> */}
    </>
  );
}
