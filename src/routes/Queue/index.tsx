import { Button, Space, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconDown, IconNav, IconRight } from "@arco-design/web-react/icon";
import { useState } from "react";
import { Task, TaskInputParams, TaskOutputParams, useTaskStore } from "../../store/task";
import ComplexTaskEditor from "./ComplexTaskEditor";
import Operations from "./Operations";
import Progress from "./Progress";
import Settings from "./Settings";

/**
 * Inputs & Outputs files list component
 */
const FilesList = ({ params }: { params: (TaskInputParams | TaskOutputParams)[] }) => {
  if (params.length === 1) {
    return <div>{params[0].path}</div>;
  } else {
    const paths = params.map((input, index) => <li key={index}>{input.path}</li>);
    return <ul className="list-disc list-inside">{paths}</ul>;
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
    <Space size="medium" direction="vertical">
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
    </Space>
  );
}
