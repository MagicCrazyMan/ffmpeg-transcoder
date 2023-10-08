import { Button, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDown, IconPlus, IconRight } from "@arco-design/web-react/icon";
import { useMemo, useState } from "react";
import { Task, useTaskStore } from "../../store/task";
import Operations from "./Operations";
import Progress from "./Progress";
import Settings from "./Settings";
import TaskEditor from "./ComplexTaskEditor";

type TableData = {
  key: string;
  task: Task;
  inputs: string[];
  outputs: string[];
};

export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [_detailsTaskId, setDetailsTaskId] = useState<undefined | string>(undefined);

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
        key: task.id,
        task,
        inputs: task.params.inputs.map((input) => input.path),
        outputs: task.params.outputs.map((output) => output.path ?? "NULL"),
      } as TableData;
    });
  }, [tasks]);

  return (
    <>
      <div className="mb-4">
        <Button
          className="mr-2"
          shape="circle"
          size="small"
          type="primary"
          icon={<IconPlus />}
          onClick={() => setTaskEditorVisible(true)}
        ></Button>
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
      </div>
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

      <TaskEditor
        visible={taskEditorVisible}
        onOk={() => setTaskEditorVisible(false)}
        onCancel={() => setTaskEditorVisible(false)}
      ></TaskEditor>

      {/* Model Displaying Task Details */}
      {/* <Details onClosed={() => setDetailsTaskId(undefined)} taskId={detailsTaskId}></Details> */}
    </>
  );
}
