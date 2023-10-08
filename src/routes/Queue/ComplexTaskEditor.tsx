import { Button, InputTag, Modal, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { useState } from "react";
import { Task, TaskInputParams, TaskOutputParams } from "../../store/task";

export type TaskEditorProps = {
  visible: boolean;
  onCancel: () => void;
  onOk: () => void;
  task?: Task;
};

/**
 * Input media files and params table
 */
const InputTable = ({
  inputs,
  onChanged,
}: {
  inputs: TaskInputParams[];
  onChanged: (inputs: TaskInputParams[]) => void;
}) => {
  const tableCols: TableColumnProps[] = [
    {
      title: "Input Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Decode Params",
      dataIndex: "params",
      ellipsis: true,
      render: (_col, item: TaskInputParams, index) => {
        const save = (params: string[]) => {
          inputs[index] = { ...inputs[index], params: [...params] };
          onChanged(inputs);
        };

        return <InputTag allowClear saveOnBlur value={item.params} onChange={save}></InputTag>;
      },
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      render: (_col, _item, index) => {
        const remove = () => {
          inputs.splice(index, 1);
          onChanged(inputs);
        };

        return (
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={remove}
          ></Button>
        );
      },
    },
  ];

  /**
   * Add input files vis Tauri
   */
  const addInputFiles = async () => {
    const files = await open({
      title: "Add Input Files",
      directory: false,
      multiple: true,
    });

    if (files) {
      inputs.push(...(files as string[]).map((file) => ({ path: file })));
      onChanged(inputs);
    }
  };

  return (
    <>
      {/* Input Buttons */}
      <Button type="primary" className="mb-4" onClick={addInputFiles}>
        Add Input Media Files
      </Button>

      {/* Input Files Table */}
      <Table stripe size="small" pagination={false} columns={tableCols} data={inputs}></Table>
    </>
  );
};

/**
 * Output media files and params table
 */
const OutputTable = ({
  outputs,
  onChanged,
}: {
  outputs: TaskOutputParams[];
  onChanged: (inputs: TaskOutputParams[]) => void;
}) => {
  const tableCols: TableColumnProps[] = [
    {
      title: "Output Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Encode Params",
      dataIndex: "params",
      ellipsis: true,
      render: (_col, item: TaskInputParams, index) => {
        const save = (params: string[]) => {
          outputs[index] = { ...outputs[index], params: [...params] };
          onChanged(outputs);
        };

        return <InputTag allowClear saveOnBlur value={item.params} onChange={save}></InputTag>;
      },
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      render: (_col, _item, index) => {
        const remove = () => {
          outputs.splice(index, 1);
          onChanged(outputs);
        };

        return (
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={remove}
          ></Button>
        );
      },
    },
  ];

  /**
   * Add output files vis Tauri
   */
  const addOutputFile = async () => {
    const file = await save({
      title: "Add Output File",
    });

    if (file) {
      outputs.push({
        path: file,
      });
      onChanged(outputs);
    }
  };

  return (
    <>
      {/* Input Buttons */}
      <Button type="primary" className="mb-4" onClick={addOutputFile}>
        Add Output Media Files
      </Button>

      {/* Input Files Table */}
      <Table stripe size="small" pagination={false} columns={tableCols} data={outputs}></Table>
    </>
  );
};

export default function ComplexTaskEditor({ visible, onCancel, onOk, task }: TaskEditorProps) {
  const [inputs, setInputs] = useState<TaskInputParams[]>(task?.params.inputs ?? []);
  const [outputs, setOutputs] = useState<TaskOutputParams[]>(task?.params.outputs ?? []);

  return (
    <Modal
      simple
      unmountOnExit
      maskClosable={false}
      style={{
        width: "60%",
        height: "80%",
        overflowY: "auto",
      }}
      visible={visible}
      onCancel={onCancel}
      okText="Add Task"
      onOk={onOk}
    >
      {/* Input Table */}
      <InputTable inputs={inputs} onChanged={() => setInputs([...inputs])}></InputTable>
      {/* Output Table */}
      <OutputTable outputs={outputs} onChanged={() => setOutputs([...outputs])}></OutputTable>
    </Modal>
  );
}
