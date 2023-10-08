import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDown, IconNav, IconRight } from "@arco-design/web-react/icon";
import { useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import Operations from "./Operations";
import Progress from "./Progress";
import Settings from "./Settings";

export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [taskEditorVisible, setTaskEditorVisible] = useState(false);

  const tableCols: TableColumnProps[] = [
    {
      title: "Inputs",
      render: (_, record: Task) => {
        if (record.params.inputs.length === 1) {
          return <div>{record.params.inputs[0].path}</div>;
        } else {
          const paths = record.params.inputs.map((input, index) => (
            <li key={index}>{input.path}</li>
          ));
          return <ul className="list-disc list-inside">{paths}</ul>;
        }
      },
    },
    {
      title: "Outputs",
      render: (_, record: Task) => {
        if (record.params.outputs.length === 1) {
          return <div>{record.params.outputs[0].path}</div>;
        } else {
          const paths = record.params.outputs.map((output, index) => (
            <li key={index}>{output.path}</li>
          ));
          return <ul className="list-disc list-inside">{paths}</ul>;
        }
      },
    },
    {
      title: "Progress",
      width: "12rem",
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, record: Task) => <Progress task={record} />,
    },
    {
      title: "Operations",
      fixed: "right",
      align: "center",
      width: "10rem",
      render: (_, record: Task) => <Operations task={record} />,
    },
  ];

  return (
    <Space className="w-full" direction="vertical">
      {/* Buttons */}
      <Space>
        {/* Add Complex Task Button */}
        <Tooltip content="Add Complex Task">
          <Button
            shape="circle"
            size="small"
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
        onVisibleChanged={(visible) => setTaskEditorVisible(visible)}
      ></ComplexTaskEditor>

      {/* Model Displaying Task Details */}
      {/* <Details onClosed={() => setDetailsTaskId(undefined)} taskId={detailsTaskId}></Details> */}
    </Space>
  );
}
